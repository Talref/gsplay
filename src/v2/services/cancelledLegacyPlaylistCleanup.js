const mongoose = require('mongoose');
const CasualFridayEvent = require('../models/CasualFridayEvent');
const CasualFridayPlaylist = require('../models/CasualFridayPlaylist');
const CasualFridayPlaylistEntry = require('../models/CasualFridayPlaylistEntry');

const WEEK_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function validateWeekKey(weekKey) {
  if (!WEEK_KEY_PATTERN.test(weekKey || '')) throw new Error('weekKey must use YYYY-MM-DD');
  const [year, month, day] = weekKey.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error('weekKey must be a real calendar date');
  }
  return weekKey;
}

async function inspectCancelledLegacyPlaylist(weekKey) {
  validateWeekKey(weekKey);
  const event = await CasualFridayEvent.findOne({ weekKey }).select('_id status').lean();
  if (event) {
    throw new Error(
      `Refusing cleanup: Casual Friday event ${event._id} (${event.status}) exists for ${weekKey}`
    );
  }
  const playlists = await CasualFridayPlaylist.find({ weekKey })
    .select('_id status startsAt endsAt cancelledAt cancellationReason')
    .lean();
  if (playlists.length !== 1) {
    throw new Error(
      `Refusing cleanup: expected exactly one playlist for ${weekKey}, found ${playlists.length}`
    );
  }
  const [playlist] = playlists;
  if (playlist.status !== 'cancelled') {
    throw new Error(`Refusing cleanup: playlist ${playlist._id} has status ${playlist.status}`);
  }
  const entryCount = await CasualFridayPlaylistEntry.countDocuments({ playlistId: playlist._id });
  return {
    weekKey,
    playlistId: String(playlist._id),
    status: playlist.status,
    startsAt: playlist.startsAt,
    endsAt: playlist.endsAt,
    cancelledAt: playlist.cancelledAt || null,
    cancellationReason: playlist.cancellationReason || null,
    entryCount
  };
}

async function removeCancelledLegacyPlaylist(weekKey, expectedPlaylistId) {
  if (!mongoose.isObjectIdOrHexString(expectedPlaylistId)) {
    throw new Error('expectedPlaylistId must be a valid MongoDB identifier');
  }
  const summary = await inspectCancelledLegacyPlaylist(weekKey);
  if (summary.playlistId !== String(expectedPlaylistId || '')) {
    throw new Error(
      `Refusing cleanup: expected playlist ${expectedPlaylistId}, found ${summary.playlistId}`
    );
  }
  await CasualFridayPlaylistEntry.deleteMany({ playlistId: summary.playlistId });
  const playlistResult = await CasualFridayPlaylist.deleteOne({
    _id: summary.playlistId,
    weekKey,
    status: 'cancelled'
  });
  if (playlistResult.deletedCount !== 1) {
    throw new Error('Cleanup did not delete the guarded cancelled playlist');
  }
  const [remainingPlaylist, remainingEntries] = await Promise.all([
    CasualFridayPlaylist.countDocuments({ _id: summary.playlistId }),
    CasualFridayPlaylistEntry.countDocuments({ playlistId: summary.playlistId })
  ]);
  if (remainingPlaylist || remainingEntries) {
    throw new Error(
      `Cleanup verification failed: ${remainingPlaylist} playlist and ${remainingEntries} entries remain`
    );
  }
  return summary;
}

module.exports = {
  inspectCancelledLegacyPlaylist,
  removeCancelledLegacyPlaylist,
  validateWeekKey
};
