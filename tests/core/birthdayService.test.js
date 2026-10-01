const Birthday = require('../../src/core/models/Birthday');
const ScheduledJob = require('../../src/core/models/ScheduledJob');
const {
  BIRTHDAY_ACHIEVEMENTS,
  BIRTHDAY_WISHES,
  ensureBirthdaySchedules,
  nextBirthdayOccurrence,
  removeBirthday,
  renderBirthdayMessage,
  setBirthday,
  validateBirthday
} = require('../../src/core/services/birthdayService');

describe('birthday service', () => {
  beforeEach(async () => global.testUtils.cleanupDatabase());

  test('keeps exactly 50 achievements and 50 wishes in the shared renderer', () => {
    expect(BIRTHDAY_ACHIEVEMENTS).toHaveLength(50);
    expect(BIRTHDAY_WISHES).toHaveLength(50);
    expect(renderBirthdayMessage('123', { random: () => 0 })).toBe(
      '🎂 **LEVEL UP!**\nOggi <@123> ha livellato in RL!\n\n' +
        '**Achievement unlocked:** *Sopravvissuto un altro anno* 🏆\n\n' +
        'Che il loot sia generoso e i bug pochi. 🎉'
    );
  });

  test('validates real calendar dates while allowing February 29 without a year', () => {
    expect(() => validateBirthday({ day: 29, month: 2, year: null })).not.toThrow();
    expect(() => validateBirthday({ day: 29, month: 2, year: 2025 })).toThrow(
      'Data di compleanno non valida.'
    );
    expect(() => validateBirthday({ day: 31, month: 4, year: null })).toThrow(
      'Data di compleanno non valida.'
    );
  });

  test('schedules 00:01 Europe/Rome and uses February 28 in non-leap years', () => {
    expect(nextBirthdayOccurrence({ day: 15, month: 6 }, new Date('2026-01-01T00:00:00Z'))).toEqual(
      { occurrenceYear: 2026, runAt: new Date('2026-06-14T22:01:00.000Z') }
    );
    expect(nextBirthdayOccurrence({ day: 29, month: 2 }, new Date('2025-01-01T00:00:00Z'))).toEqual(
      { occurrenceYear: 2025, runAt: new Date('2025-02-27T23:01:00.000Z') }
    );
  });

  test('setting replaces the pending occurrence and removing cancels it', async () => {
    const identity = { guildId: '12345678901234567', discordUserId: '23456789012345678' };
    const now = new Date('2026-01-01T00:00:00Z');
    await setBirthday({ ...identity, day: 10, month: 5 }, now);
    await setBirthday({ ...identity, day: 12, month: 5, year: 1990 }, now);

    expect(await Birthday.find(identity)).toHaveLength(1);
    expect(await Birthday.findOne(identity)).toMatchObject({ day: 12, month: 5, year: 1990 });
    const scheduled = await ScheduledJob.find({ status: 'scheduled' });
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].runAt).toEqual(new Date('2026-05-11T22:01:00.000Z'));
    expect(await ScheduledJob.countDocuments()).toBe(1);

    expect(await removeBirthday(identity)).toBe(true);
    expect(await Birthday.findOne(identity)).toBeNull();
    expect(await ScheduledJob.find({ status: 'scheduled' })).toHaveLength(0);
    expect(await ScheduledJob.find({ status: 'canceled' })).toHaveLength(1);
  });

  test('repairs a missing occurrence without resetting terminal delivery failures', async () => {
    const identity = { guildId: '12345678901234567', discordUserId: '23456789012345678' };
    const now = new Date('2026-01-01T00:00:00Z');
    await Birthday.create({ ...identity, day: 10, month: 5 });
    expect(await ensureBirthdaySchedules(now)).toBe(1);
    expect(await ensureBirthdaySchedules(now)).toBe(0);
    await ScheduledJob.updateOne({}, { $set: { status: 'failed' } });
    expect(await ensureBirthdaySchedules(now)).toBe(0);
    expect(await ScheduledJob.countDocuments()).toBe(1);
  });
});
