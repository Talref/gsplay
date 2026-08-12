const mongoose = require('mongoose');
const Event = require('../../src/v2/models/CasualFridayEvent');
const Playlist = require('../../src/v2/models/CasualFridayPlaylist');
const Entry = require('../../src/v2/models/CasualFridayPlaylistEntry');
const {
  inspectCancelledLegacyPlaylist,
  removeCancelledLegacyPlaylist,
  validateWeekKey
} = require('../../src/v2/services/cancelledLegacyPlaylistCleanup');
const { argumentsFrom } = require('../../scripts/remove-cancelled-legacy-playlist');

const weekKey = '2026-08-14';
const startsAt = new Date('2026-08-14T17:00:00.000Z');
const endsAt = new Date('2026-08-15T04:00:00.000Z');
const actorId = new mongoose.Types.ObjectId();

async function cancelledPlaylist() {
  return Playlist.create({
    weekKey,
    status: 'cancelled',
    startsAt,
    endsAt,
    createdBy: actorId,
    updatedBy: actorId,
    cancelledBy: actorId,
    cancelledAt: new Date(),
    cancellationReason: 'Switching workflows'
  });
}

describe('cancelled legacy Casual Friday playlist cleanup', () => {
  beforeEach(async () => global.testUtils.cleanupDatabase());

  test('validates the exact command arguments', () => {
    expect(validateWeekKey(weekKey)).toBe(weekKey);
    expect(() => validateWeekKey('2026-02-30')).toThrow('real calendar date');
    expect(() => argumentsFrom(['--week', weekKey, '--execute'])).toThrow('--playlist-id');
    expect(argumentsFrom(['--week', weekKey])).toEqual({ execute: false, weekKey });
  });

  test('inspects one cancelled playlist without changing it', async () => {
    const playlist = await cancelledPlaylist();
    await Entry.create({
      playlistId: playlist._id,
      rotationGameId: new mongoose.Types.ObjectId(),
      canonicalGameId: new mongoose.Types.ObjectId(),
      position: 1,
      selectedBy: actorId,
      snapshots: { game: { title: 'Legacy Game' }, rotation: {} }
    });

    await expect(inspectCancelledLegacyPlaylist(weekKey)).resolves.toMatchObject({
      playlistId: String(playlist._id),
      status: 'cancelled',
      entryCount: 1
    });
    expect(await Playlist.countDocuments()).toBe(1);
    expect(await Entry.countDocuments()).toBe(1);
  });

  test.each(['draft', 'published', 'completed'])('refuses a %s playlist', async (status) => {
    await Playlist.create({ weekKey, status, startsAt, endsAt, createdBy: actorId, updatedBy: actorId });
    await expect(inspectCancelledLegacyPlaylist(weekKey)).rejects.toThrow(`status ${status}`);
  });

  test('refuses cleanup when a lifecycle event exists', async () => {
    await cancelledPlaylist();
    await Event.create({
      weekKey,
      status: 'cancelled',
      startsAt,
      endsAt,
      votingClosesAt: new Date('2026-08-14T13:00:00.000Z'),
      candidates: [],
      createdBy: actorId,
      updatedBy: actorId
    });
    await expect(inspectCancelledLegacyPlaylist(weekKey)).rejects.toThrow('event');
  });

  test('requires the inspected playlist ID and removes only its entries and playlist', async () => {
    const playlist = await cancelledPlaylist();
    await Entry.create({
      playlistId: playlist._id,
      rotationGameId: new mongoose.Types.ObjectId(),
      canonicalGameId: new mongoose.Types.ObjectId(),
      position: 1,
      selectedBy: actorId,
      snapshots: { game: { title: 'Legacy Game' }, rotation: {} }
    });
    await expect(removeCancelledLegacyPlaylist(weekKey, 'not-an-id')).rejects.toThrow(
      'valid MongoDB identifier'
    );
    await expect(
      removeCancelledLegacyPlaylist(weekKey, new mongoose.Types.ObjectId())
    ).rejects.toThrow('expected playlist');

    await expect(removeCancelledLegacyPlaylist(weekKey, playlist._id)).resolves.toMatchObject({
      entryCount: 1
    });
    expect(await Playlist.countDocuments()).toBe(0);
    expect(await Entry.countDocuments()).toBe(0);
  });
});
