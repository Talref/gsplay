const { loadDrracoonEnvironment: load } = require('../../src/drracoon/config');
const base = { DRRACOON_TOKEN: 'test-token', DRRACOON_GUILD_IDS: '123456789012345678' };

test('disabled, partial and multi-guild configuration', () => {
  expect(load({})).toEqual({ enabled: false });
  expect(() => load({ DRRACOON_TOKEN: 'test' })).toThrow('DRRACOON_GUILD_IDS');
  expect(() => load({ DRRACOON_GUILD_IDS: base.DRRACOON_GUILD_IDS })).toThrow('DRRACOON_TOKEN');
  expect(
    load({
      ...base,
      DRRACOON_GUILD_IDS: `${base.DRRACOON_GUILD_IDS},234567890123456789,${base.DRRACOON_GUILD_IDS}`
    }).guildIds
  ).toHaveLength(2);
  expect(load(base)).toMatchObject({ maxConcurrent: 1, queueLimit: 20, stream: false });
});

test.each([
  ['DRRACOON_GUILD_IDS', '123,'],
  ['DRRACOON_STAFF_ROLE_IDS', 'everyone'],
  ['DRRACOON_STAFF_CHANNEL_IDS', '../abc'],
  ['DRRACOON_LLM_BASE_URL', 'file:///tmp'],
  ['DRRACOON_LLM_BASE_URL', 'https://secret@example.com/v1'],
  ['DRRACOON_MAX_CONCURRENT', '1abc'],
  ['DRRACOON_QUEUE_LIMIT', '0'],
  ['DRRACOON_LLM_STREAM', 'yes'],
  ['DRRACOON_CONTEXT_SIZE', '1024']
])('rejects invalid %s=%s', (name, value) => {
  expect(() => load({ ...base, [name]: value })).toThrow(name);
});
