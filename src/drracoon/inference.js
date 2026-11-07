const { createToolRegistry } = require('./tools');

// Byte budgeting deliberately overestimates tokens for provider-independent safety.
const cost = (value) => Buffer.byteLength(JSON.stringify(value), 'utf8') + 32;

function visibleText(raw) {
  return raw.replace(/<(think|analysis)>[\s\S]*?(?:<\/\1>|$)/gi, '').replace(/<[^>]*$/, '');
}

function buildMessages(prompt, input, history, config, tools = []) {
  const base = [
    { role: 'system', content: prompt },
    { role: 'user', content: input }
  ];
  const budget = config.contextSize - config.maxOutputTokens - 512 - cost(tools);
  if (cost(base) > budget) throw new Error('context_limit');
  const selected = [];
  for (const turn of [...history].reverse()) {
    const pair = [
      { role: 'user', content: turn.input },
      { role: 'assistant', content: turn.output }
    ];
    if (cost([base[0], ...pair, ...selected, base[1]]) > budget) break;
    selected.unshift(...pair);
  }
  return [base[0], ...selected, base[1]];
}

async function readResponse(response, onText, signal) {
  let bytes = 0,
    raw = '',
    pending = '',
    done = false,
    finishReason;
  const calls = new Map();
  const decoder = new TextDecoder();
  const streaming = response.headers.get('content-type')?.includes('text/event-stream');
  const consume = async (event) => {
    const data = event
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (!data) return;
    if (data.trim() === '[DONE]') {
      done = true;
      return;
    }
    const chunk = JSON.parse(data);
    if (chunk.error) throw new Error('provider_protocol');
    const choice = chunk.choices?.[0];
    if (!choice) return;
    if (choice.finish_reason) finishReason = choice.finish_reason;
    const delta = choice.delta || {};
    if (typeof delta.content === 'string') {
      raw += delta.content;
      await onText(visibleText(raw));
    }
    for (const fragment of delta.tool_calls || []) {
      if (!Number.isInteger(fragment.index) || fragment.index < 0 || fragment.index > 7)
        throw new Error('provider_protocol');
      const call = calls.get(fragment.index) || {
        id: '',
        type: 'function',
        function: { name: '', arguments: '' }
      };
      call.id += fragment.id || '';
      if (fragment.type && fragment.type !== 'function') throw new Error('provider_protocol');
      call.function.name += fragment.function?.name || '';
      call.function.arguments += fragment.function?.arguments || '';
      calls.set(fragment.index, call);
    }
  };
  for await (const chunk of response.body) {
    signal.throwIfAborted();
    bytes += chunk.byteLength;
    if (bytes > 2 * 1024 * 1024) throw new Error('provider_response_limit');
    pending += decoder.decode(chunk, { stream: true });
    if (streaming) {
      pending = pending.replace(/\r\n/g, '\n');
      let boundary;
      while ((boundary = pending.indexOf('\n\n')) >= 0) {
        await consume(pending.slice(0, boundary));
        pending = pending.slice(boundary + 2);
      }
    }
  }
  pending += decoder.decode();
  if (!streaming) {
    const data = JSON.parse(pending);
    const choice = data.choices?.[0];
    if (!choice?.message || data.error) throw new Error('provider_protocol');
    return {
      ...choice.message,
      content: visibleText(choice.message.content || ''),
      finishReason: choice.finish_reason
    };
  }
  if (pending.trim()) await consume(pending);
  if (!done || !finishReason) throw new Error('provider_interrupted');
  return {
    content: visibleText(raw),
    tool_calls: [...calls.entries()].sort(([a], [b]) => a - b).map(([, call]) => call),
    finishReason
  };
}

function createInference({ config, registry = createToolRegistry(), fetchImpl = fetch }) {
  return async function infer({
    prompt,
    input,
    history = [],
    context = {},
    signal,
    authorize = async () => {},
    onText = async () => {},
    onTurn = async () => {}
  }) {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) controller.abort();
    const timer = setTimeout(cancel, config.requestTimeoutMs);
    // Deadline races also bound injected tools/callbacks which ignore AbortSignal.
    let abortListener;
    const aborted = new Promise((_, reject) => {
      abortListener = () =>
        reject(new Error(signal?.aborted ? 'request_cancelled' : 'request_timeout'));
      controller.signal.addEventListener('abort', abortListener, { once: true });
      if (controller.signal.aborted) abortListener();
    });
    const work = async () => {
      const tools = registry.definitions(context);
      const messages = buildMessages(prompt, input, history, config, tools);
      const segments = [];
      const seenIds = new Set();
      let remaining = config.maxOutputTokens;
      for (let round = 0; round <= config.maxToolRounds; round++) {
        controller.signal.throwIfAborted();
        if (cost(messages) + cost(tools) + remaining + 512 > config.contextSize)
          throw new Error('context_limit');
        await authorize();
        if (remaining <= 0) throw new Error('output_limit');
        const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
          method: 'POST',
          signal: controller.signal,
          redirect: 'error',
          headers: {
            'Content-Type': 'application/json',
            ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {})
          },
          body: JSON.stringify({
            model: config.model,
            messages,
            [config.tokenParameter || 'max_tokens']: remaining,
            stream: config.stream,
            ...(tools.length ? { tools, tool_choice: 'auto' } : {})
          })
        }).catch(() => {
          controller.signal.throwIfAborted();
          throw new Error('provider_unavailable');
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw new Error(
            response.status === 429 || response.status >= 500
              ? 'provider_unavailable'
              : 'provider_rejected'
          );
        }
        const assistant = await readResponse(
          response,
          async (text) => {
            controller.signal.throwIfAborted();
            await onText(text, segments);
          },
          controller.signal
        );
        controller.signal.throwIfAborted();
        if (['content_filter', 'length'].includes(assistant.finishReason))
          throw new Error('provider_incomplete');
        const content = assistant.content?.trim() || '';
        const calls = assistant.tool_calls || [];
        if (!Array.isArray(calls) || calls.length > 8) throw new Error('provider_protocol');
        remaining -= Math.max(1, Math.ceil(cost({ content, calls }) / 3));
        if (remaining < 0) throw new Error('output_limit');
        if (content) segments.push(content);
        if (!calls.length) {
          if (!content) throw new Error('provider_empty');
          await onTurn([...segments], true);
          return { segments, output: segments.join('\n\n') };
        }
        if (round === config.maxToolRounds) throw new Error('tool_round_limit');
        for (const call of calls) {
          if (
            !call.id ||
            typeof call.id !== 'string' ||
            seenIds.has(call.id) ||
            call.type !== 'function' ||
            typeof call.function?.name !== 'string' ||
            typeof call.function?.arguments !== 'string'
          )
            throw new Error('provider_protocol');
          seenIds.add(call.id);
        }
        await onTurn([...segments], false);
        messages.push({ role: 'assistant', content: content || null, tool_calls: calls });
        for (const call of calls) {
          await authorize();
          controller.signal.throwIfAborted();
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: await registry.execute(call, context, controller.signal)
          });
        }
      }
      throw new Error('tool_round_limit');
    };
    try {
      return await Promise.race([work(), aborted]);
    } finally {
      clearTimeout(timer);
      controller.abort();
      controller.signal.removeEventListener('abort', abortListener);
      signal?.removeEventListener('abort', cancel);
    }
  };
}

module.exports = { createInference, buildMessages, readResponse, visibleText };
