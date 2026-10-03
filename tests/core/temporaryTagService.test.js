const ScheduledJob = require('../../src/core/models/ScheduledJob');
const TemporaryTag = require('../../src/core/models/TemporaryTag');
const {
  TEMPORARY_TAG_EXPIRATION_JOB_TYPE,
  archiveTemporaryTag,
  createTemporaryTag,
  validateTemporaryTag
} = require('../../src/core/services/temporaryTagService');

const base = {
  guildId: '123456789012345678',
  discordRoleId: '223456789012345678',
  name: 'Halloween',
  buttonLabel: '🎃 Partecipa a Halloween',
  expiresAt: null,
  createdBy: '323456789012345678'
};

describe('temporary tag service', () => {
  beforeEach(async () => global.testUtils.cleanupDatabase());

  test('validates values and schedules a persistent expiration', async () => {
    const now = new Date('2026-10-03T12:00:00.000Z');
    expect(() => validateTemporaryTag({ ...base, name: '' }, now)).toThrow(
      'Nome del tag non valido.'
    );
    expect(() =>
      validateTemporaryTag({ ...base, expiresAt: new Date('2026-10-03T11:00:00.000Z') }, now)
    ).toThrow('La scadenza deve essere nel futuro.');

    const expiresAt = new Date('2026-11-01T11:00:00.000Z');
    const tag = await createTemporaryTag({ ...base, expiresAt }, now);
    expect(tag).toMatchObject({ name: 'Halloween', status: 'active', expiresAt });
    expect(await ScheduledJob.findOne({ type: TEMPORARY_TAG_EXPIRATION_JOB_TYPE })).toMatchObject({
      runAt: expiresAt,
      status: 'scheduled'
    });
  });

  test('blocks duplicate active names but permits reuse after archival', async () => {
    const first = await createTemporaryTag(base);
    await expect(
      createTemporaryTag({ ...base, discordRoleId: '423456789012345678', name: ' halloween ' })
    ).rejects.toThrow('Esiste già un tag attivo con questo nome.');

    await archiveTemporaryTag(first.id, base.createdBy);
    const second = await createTemporaryTag({
      ...base,
      discordRoleId: '423456789012345678',
      name: 'halloween'
    });
    expect(second.id).not.toBe(first.id);
    expect(await TemporaryTag.countDocuments({ normalizedName: 'halloween' })).toBe(2);
  });
});
