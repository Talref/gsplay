const { createMessages, splitText, PLACEHOLDER, FAILURE } = require('../../src/drracoon/messages');

function fixture() {
  const stored = new Map();
  const job = { _id: 'source', responseIds: [] };
  let time = 10000;
  const channel = {
    send: jest.fn(async (payload) => {
      const old = [...stored.values()].find((m) => m.nonce === payload.nonce);
      if (old) return old;
      const message = {
        id: `reply-${stored.size}`,
        content: payload.content,
        nonce: payload.nonce,
        author: { id: 'bot' },
        reference: { messageId: 'source' },
        createdTimestamp: time
      };
      message.edit = jest.fn(async ({ content }) => {
        message.content = content;
        return message;
      });
      stored.set(message.id, message);
      return message;
    }),
    messages: {
      fetch: jest.fn(async (id) => {
        if (typeof id === 'object') return stored;
        if (!stored.has(id)) throw Object.assign(new Error('deleted'), { code: 10008 });
        return stored.get(id);
      })
    }
  };
  const save = jest.fn(async () => {});
  const authorize = jest.fn(async () => {});
  const options = { job, channel, botId: 'bot', save, authorize, now: () => time };
  return {
    job,
    channel,
    stored,
    save,
    authorize,
    options,
    advance: (ms) => {
      time += ms;
    },
    messages: createMessages(options)
  };
}

test('edits placeholder then appends final tool response without duplicating preliminary text', async () => {
  const f = fixture();
  await f.messages.ensure();
  expect(f.channel.send.mock.calls[0][0]).toMatchObject({
    content: PLACEHOLDER,
    enforceNonce: true,
    allowedMentions: { parse: [], repliedUser: false }
  });
  await f.messages.render(['Controllo.'], { force: true });
  await f.messages.render(['Controllo.', 'Risposta.'], { force: true });
  await f.messages.render(['Controllo.', 'Risposta.'], { force: true });
  expect([...f.stored.values()].map((m) => m.content)).toEqual(['Controllo.', 'Risposta.']);
  expect(f.channel.send).toHaveBeenCalledTimes(2);
});

test('coalesces streaming edits and replaces loading status on terminal errors', async () => {
  const f = fixture();
  await f.messages.ensure();
  await f.messages.render(['first']);
  await f.messages.render(['second']);
  expect(f.stored.get('reply-0').content).toBe('first');
  f.advance(1501);
  await f.messages.render(['second']);
  expect(f.stored.get('reply-0').content).toBe('second');
  await f.messages.fail();
  expect(f.stored.get('reply-0').content).toBe(FAILURE);
});

test('reconciles a crash after send before ID persistence', async () => {
  const f = fixture();
  f.save.mockImplementationOnce(async () => {}).mockRejectedValueOnce(new Error('db unavailable'));
  await expect(f.messages.ensure()).rejects.toThrow('db unavailable');
  expect(f.job.responseIds).toEqual([]);
  f.advance(180000);
  await createMessages(f.options).ensure();
  expect(f.job.responseIds).toEqual(['reply-0']);
  expect(f.channel.send).toHaveBeenCalledTimes(1);
});

test('does not blindly repost old ambiguous sends, deleted responses or forbidden destinations', async () => {
  const f = fixture();
  f.channel.send.mockRejectedValueOnce(new Error('network interrupted'));
  await expect(f.messages.ensure()).rejects.toThrow();
  f.advance(180000);
  await expect(createMessages(f.options).ensure()).rejects.toThrow('delivery_uncertain');
  expect(f.channel.send).toHaveBeenCalledTimes(1);
  const g = fixture();
  await g.messages.ensure();
  g.stored.clear();
  await expect(g.messages.render(['answer'], { force: true })).rejects.toThrow('response_deleted');
  expect(g.channel.send).toHaveBeenCalledTimes(1);
  const h = fixture();
  h.authorize.mockRejectedValue(new Error('access_revoked'));
  await expect(h.messages.ensure()).rejects.toThrow('access_revoked');
  expect(h.channel.send).not.toHaveBeenCalled();
});

test('splits long responses in order without breaking surrogate pairs', async () => {
  const text = 'a'.repeat(1999) + '🦝' + 'b'.repeat(2000);
  expect(splitText(text).join('')).toBe(text);
  expect(
    splitText(text).every((part) => part.length <= 2000 && !/[\uD800-\uDBFF]$/.test(part))
  ).toBe(true);
  const f = fixture();
  await f.messages.ensure();
  await f.messages.render([text], { force: true });
  expect([...f.stored.values()].map((m) => m.content).join('')).toBe(text);
});
