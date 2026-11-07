const http = require('node:http');
const { createInference, buildMessages, visibleText } = require('../../src/drracoon/inference');
const { createToolRegistry } = require('../../src/drracoon/tools');
const { loadDrracoonEnvironment } = require('../../src/drracoon/config');
const config = loadDrracoonEnvironment({
  DRRACOON_TOKEN: 'test',
  DRRACOON_GUILD_IDS: '123456789012345678'
});
const answer = (message, finish_reason = 'stop') =>
  new Response(JSON.stringify({ choices: [{ message, finish_reason }] }), {
    headers: { 'content-type': 'application/json' }
  });
const call = (id = 'call1', name = 'lookup', args = '{"value":"hello"}') => ({
  id,
  type: 'function',
  function: { name, arguments: args }
});
const tool = {
  name: 'lookup',
  description: 'simulated lookup',
  parameters: {
    type: 'object',
    properties: { value: { type: 'string' } },
    required: ['value'],
    additionalProperties: false
  },
  allowed: (context) => context.scope === 'user',
  validate: (args) => Object.keys(args).length === 1 && typeof args.value === 'string',
  execute: jest.fn(async (args) => ({ result: args.value }))
};
const context = { scope: 'user' };

test('real fake HTTP provider receives endpoint, model and optional credentials', async () => {
  let received;
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    received = { url: req.url, authorization: req.headers.authorization, body: JSON.parse(body) };
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({ choices: [{ message: { content: 'Ciao!' }, finish_reason: 'stop' }] })
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const infer = createInference({
      config: {
        ...config,
        baseUrl: `http://127.0.0.1:${server.address().port}/v1`,
        apiKey: 'fake',
        tokenParameter: 'max_completion_tokens'
      }
    });
    expect((await infer({ prompt: 'system', input: 'hello' })).output).toBe('Ciao!');
    expect(received).toMatchObject({
      url: '/v1/chat/completions',
      authorization: 'Bearer fake',
      body: { model: 'gsbot-gemma', max_completion_tokens: 1024 }
    });
    expect(received.body.tools).toBeUndefined();
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('preserves tool IDs/order and preliminary text across multiple rounds', async () => {
  const fetchImpl = jest
    .fn()
    .mockResolvedValueOnce(
      answer(
        { content: 'Controllo.', reasoning_content: 'hidden', tool_calls: [call('a'), call('b')] },
        'tool_calls'
      )
    )
    .mockResolvedValueOnce(answer({ content: null, tool_calls: [call('c')] }, 'tool_calls'))
    .mockResolvedValueOnce(answer({ content: 'Risposta.' }));
  const onTurn = jest.fn();
  const infer = createInference({ config, registry: createToolRegistry([tool]), fetchImpl });
  expect(await infer({ prompt: 'system', input: 'hello', context, onTurn })).toEqual({
    segments: ['Controllo.', 'Risposta.'],
    output: 'Controllo.\n\nRisposta.'
  });
  const request = JSON.parse(fetchImpl.mock.calls[1][1].body);
  expect(request.tool_choice).toBe('auto');
  expect(request.messages.slice(-3)).toMatchObject([
    { role: 'assistant', content: 'Controllo.', tool_calls: [call('a'), call('b')] },
    { role: 'tool', tool_call_id: 'a', content: '{"result":"hello"}' },
    { role: 'tool', tool_call_id: 'b', content: '{"result":"hello"}' }
  ]);
  expect(JSON.stringify(request)).not.toContain('hidden');
  expect(onTurn.mock.calls[0]).toEqual([['Controllo.'], false]);
});

test.each([
  [call('a', 'unknown'), 'tool_not_allowed'],
  [call('a', 'lookup', '{broken'), 'invalid_tool_arguments'],
  [call('a', 'lookup', '{"value":1}'), 'invalid_tool_arguments']
])('handles unsupported/malformed tool safely', async (request, error) => {
  const fetchImpl = jest
    .fn()
    .mockResolvedValueOnce(answer({ tool_calls: [request] }, 'tool_calls'))
    .mockResolvedValueOnce(answer({ content: 'done' }));
  await createInference({ config, registry: createToolRegistry([tool]), fetchImpl })({
    prompt: 'system',
    input: 'hello',
    context
  });
  expect(JSON.parse(fetchImpl.mock.calls[1][1].body).messages.at(-1).content).toContain(error);
});

test('streamed fragmented tools and reasoning are separated from visible text', async () => {
  const frames =
    [
      { content: '<thi' },
      { content: 'nk>secret</think>Ciao' },
      {
        tool_calls: [
          {
            index: 0,
            id: 'a',
            type: 'function',
            function: { name: 'look', arguments: '{"value":' }
          }
        ]
      },
      {
        tool_calls: [{ index: 0, function: { name: 'up', arguments: '"hello"}' } }],
        reasoning_content: 'hidden'
      }
    ]
      .map((delta) => `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`)
      .join('') +
    `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] })}\n\ndata: [DONE]\n\n`;
  const fetchImpl = jest
    .fn()
    .mockResolvedValueOnce(
      new Response(frames, { headers: { 'content-type': 'text/event-stream' } })
    )
    .mockResolvedValueOnce(answer({ content: 'Fine' }));
  const onText = jest.fn();
  const result = await createInference({
    config: { ...config, stream: true },
    registry: createToolRegistry([tool]),
    fetchImpl
  })({ prompt: 'system', input: 'hello', context, onText });
  expect(result.output).toBe('Ciao\n\nFine');
  expect(onText.mock.calls.map(([text]) => text)).toEqual(['', 'Ciao']);
});

test.each([
  [() => answer({ content: '' }), 'provider_empty'],
  [() => answer({ tool_calls: [call('a'), call('a')] }), 'provider_protocol'],
  [() => answer({ content: 'partial' }, 'length'), 'provider_incomplete'],
  [() => new Response('bad', { status: 503 }), 'provider_unavailable'],
  [() => new Response('bad', { status: 401 }), 'provider_rejected'],
  [
    () =>
      new Response('data: {"choices":[]}\n\n', {
        headers: { 'content-type': 'text/event-stream' }
      }),
    'provider_interrupted'
  ]
])('handles provider failure path', async (response, code) => {
  const infer = createInference({ config, fetchImpl: jest.fn(async () => response()) });
  await expect(infer({ prompt: 'system', input: 'hello' })).rejects.toThrow(code);
});

test('bounds timeout, tool rounds and context without dropping current input', async () => {
  await expect(
    createInference({
      config: { ...config, requestTimeoutMs: 10 },
      fetchImpl: () => new Promise(() => {})
    })({ prompt: 's', input: 'i' })
  ).rejects.toThrow('request_timeout');
  const infer = createInference({
    config: { ...config, maxToolRounds: 0 },
    fetchImpl: async () => answer({ tool_calls: [call()] })
  });
  await expect(infer({ prompt: 's', input: 'i' })).rejects.toThrow('tool_round_limit');
  const messages = buildMessages(
    's',
    'CURRENT',
    [{ input: 'x'.repeat(50000), output: 'o' }],
    config
  );
  expect(messages).toEqual([
    { role: 'system', content: 's' },
    { role: 'user', content: 'CURRENT' }
  ]);
  expect(() => buildMessages('s'.repeat(50000), 'current', [], config)).toThrow('context_limit');
  expect(visibleText('<think>secret')).toBe('');
});

test('registry enforces permissions and registration contracts', async () => {
  expect(() => createToolRegistry([{ name: 'shell' }])).toThrow('invalid_tool_registration');
  const registry = createToolRegistry([tool]);
  expect(registry.definitions({ scope: 'staff' })).toEqual([]);
  expect(
    await registry.execute(call(), { scope: 'staff' }, new AbortController().signal)
  ).toContain('tool_not_allowed');
});
