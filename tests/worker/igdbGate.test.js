const { createIgdbGate } = require('../../src/worker/jobs/igdbGate');

describe('IGDB worker gate', () => {
  test('paces calls and applies a cooldown after a rate limit', async () => {
    let clock = 0;
    const sleeps = [];
    const gate = createIgdbGate({
      minIntervalMs: 500,
      cooldownMs: 60_000,
      now: () => clock,
      sleep: async (ms) => {
        sleeps.push(ms);
        clock += ms;
      },
      log: { warn: jest.fn() }
    });
    await gate.run(async () => 'one');
    await gate.run(async () => 'two');
    await expect(
      gate.run(async () => {
        const error = new Error('rate limit');
        error.status = 429;
        error.retryable = true;
        throw error;
      })
    ).rejects.toThrow('rate limit');
    await gate.run(async () => 'four');
    expect(sleeps).toEqual(expect.arrayContaining([500, 60_000]));
  });
});
