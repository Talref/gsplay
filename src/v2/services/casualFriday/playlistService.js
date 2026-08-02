const CanonicalGame = require('../../models/CanonicalGame');
const Rotation = require('../../models/CasualFridayRotationGame');
const Playlist = require('../../models/CasualFridayPlaylist');
const Entry = require('../../models/CasualFridayPlaylistEntry');
const LibraryItem = require('../../models/LibraryItem');
const { AppError } = require('../../http/errors');
const {
  audit,
  gameDto,
  itadSnapshot,
  keyOfferDto,
  keyOfferPrice,
  keyOfferUrl,
  rotationSnapshot
} = require('./common');
const { nextFridayWindow } = require('./scheduling');

const editableStatuses = ['draft', 'published'];

async function upcomingPlaylist(actor, now = new Date()) {
  const window = nextFridayWindow(now);
  const existing = await Playlist.findOne({ weekKey: window.weekKey });
  return existing || Playlist.create({ ...window, createdBy: actor._id, updatedBy: actor._id });
}

function playlistIsEditable(playlist, now = new Date()) {
  return editableStatuses.includes(playlist.status) && playlist.endsAt > now;
}

async function buildPlaylistDto(playlist, userId) {
  if (!playlist) return null;
  const entries = await Entry.find({ playlistId: playlist._id }).sort({ position: 1 });
  const canonicalGameIds = entries.map((entry) => entry.canonicalGameId);
  const ownership = userId
    ? await LibraryItem.find({
        userId,
        canonicalGameId: { $in: canonicalGameIds },
        removedAt: null
      }).select('canonicalGameId provider')
    : [];
  const providers = new Map();
  ownership.forEach((item) =>
    providers.set(String(item.canonicalGameId), [
      ...new Set([...(providers.get(String(item.canonicalGameId)) || []), item.provider])
    ])
  );
  const rotations = await Rotation.find({
    _id: { $in: entries.map((entry) => entry.rotationGameId) }
  }).select(
    'itadStatus itadGameId itadTitle itadCheckedAt itadError itadOffer itadOfferCheckedAt itadOfferError'
  );
  const rotationMap = new Map(rotations.map((rotation) => [String(rotation._id), rotation]));
  return {
    id: String(playlist._id),
    weekKey: playlist.weekKey,
    status: playlist.status,
    startsAt: playlist.startsAt,
    endsAt: playlist.endsAt,
    version: playlist.version,
    editable: playlistIsEditable(playlist),
    cancellationReason: playlist.cancellationReason,
    cancelledAt: playlist.cancelledAt,
    entries: entries.map((entry) => {
      const rotation = rotationMap.get(String(entry.rotationGameId));
      return {
        id: String(entry._id),
        rotationGameId: String(entry.rotationGameId),
        canonicalGameId: String(entry.canonicalGameId),
        position: entry.position,
        ...entry.snapshots,
        itad: rotation ? itadSnapshot(rotation) : entry.snapshots.itad,
        keyOffer: keyOfferDto(entry.keyOffer),
        owned: Boolean(providers.get(String(entry.canonicalGameId))?.length),
        providers: providers.get(String(entry.canonicalGameId)) || [],
        free: ['free', 'web'].includes(entry.snapshots.rotation.acquisitionKind)
      };
    })
  };
}

async function updateKeyOffer(
  actor,
  playlistId,
  entryId,
  version,
  data,
  { now = new Date() } = {}
) {
  const keyOffer = {
    price: keyOfferPrice(data.price),
    currency: 'EUR',
    url: keyOfferUrl(data.url),
    updatedAt: now,
    updatedBy: actor._id
  };
  const playlist = await requireEditablePlaylist(playlistId, version, actor, now);
  const entry = await Entry.findOneAndUpdate(
    { _id: entryId, playlistId: playlist._id },
    { $set: { keyOffer } },
    { new: true, runValidators: true }
  );
  if (!entry) {
    await Playlist.updateOne(
      { _id: playlist._id, version: playlist.version },
      { $inc: { version: -1 } }
    );
    throw new AppError(404, 'not_found', 'Playlist entry was not found');
  }
  await audit(actor, 'playlist_key_offer_updated', {
    playlistId: playlist._id,
    rotationGameId: entry.rotationGameId,
    beforeVersion: version,
    afterVersion: playlist.version,
    details: { price: keyOffer.price, currency: keyOffer.currency }
  });
  return buildPlaylistDto(playlist, actor._id);
}

async function removeKeyOffer(actor, playlistId, entryId, version, { now = new Date() } = {}) {
  const playlist = await requireEditablePlaylist(playlistId, version, actor, now);
  const entry = await Entry.findOneAndUpdate(
    { _id: entryId, playlistId: playlist._id, keyOffer: { $exists: true } },
    { $unset: { keyOffer: 1 } },
    { new: true }
  );
  if (!entry) {
    await Playlist.updateOne(
      { _id: playlist._id, version: playlist.version },
      { $inc: { version: -1 } }
    );
    throw new AppError(404, 'not_found', 'Key offer was not found');
  }
  await audit(actor, 'playlist_key_offer_removed', {
    playlistId: playlist._id,
    rotationGameId: entry.rotationGameId,
    beforeVersion: version,
    afterVersion: playlist.version
  });
  return buildPlaylistDto(playlist, actor._id);
}

async function requireEditablePlaylist(playlistId, version, actor, now = new Date()) {
  const playlist = await Playlist.findOneAndUpdate(
    { _id: playlistId, status: { $in: editableStatuses }, endsAt: { $gt: now }, version },
    { $inc: { version: 1 }, $set: { updatedBy: actor._id } },
    { new: true }
  );
  if (playlist) return playlist;
  const existing = await Playlist.findById(playlistId);
  if (!existing) throw new AppError(404, 'not_found', 'Playlist was not found');
  if (!playlistIsEditable(existing, now)) {
    throw new AppError(
      409,
      'playlist_not_editable',
      'The playlist can only be changed before Saturday at 06:00 Europe/Rome'
    );
  }
  throw new AppError(
    409,
    'playlist_version_conflict',
    'This playlist changed. Reload it before saving.'
  );
}

async function addToPlaylist(actor, id, { now = new Date() } = {}) {
  const rotation = await Rotation.findOne({ _id: id, status: 'active' });
  if (!rotation) throw new AppError(404, 'not_found', 'Active rotation game was not found');
  const playlist = await upcomingPlaylist(actor, now);
  if (!playlistIsEditable(playlist, now)) {
    throw new AppError(
      409,
      'playlist_not_editable',
      'The playlist can only be changed before Saturday at 06:00 Europe/Rome'
    );
  }
  if (await Entry.exists({ playlistId: playlist._id, rotationGameId: rotation._id })) {
    return buildPlaylistDto(playlist, actor._id);
  }
  const itad = itadSnapshot(rotation);
  const count = await Entry.countDocuments({ playlistId: playlist._id });
  const game = await CanonicalGame.findById(rotation.canonicalGameId);
  await Entry.create({
    playlistId: playlist._id,
    rotationGameId: rotation._id,
    canonicalGameId: game._id,
    position: count + 1,
    selectedBy: actor._id,
    snapshots: {
      game: gameDto(game),
      rotation: rotationSnapshot(rotation, game),
      itad
    }
  });
  playlist.version += 1;
  playlist.updatedBy = actor._id;
  await playlist.save();
  await audit(actor, 'playlist_entry_added', {
    playlistId: playlist._id,
    rotationGameId: rotation._id,
    afterVersion: playlist.version,
    details: { itadStatus: itad.status, offerFound: Boolean(itad.offer) }
  });
  return buildPlaylistDto(playlist, actor._id);
}

async function removeFromPlaylist(actor, playlistId, entryId, version, { now = new Date() } = {}) {
  const playlist = await requireEditablePlaylist(playlistId, version, actor, now);
  const entry = await Entry.findOneAndDelete({ _id: entryId, playlistId: playlist._id });
  if (!entry) {
    await Playlist.updateOne(
      { _id: playlist._id, version: playlist.version },
      { $inc: { version: -1 } }
    );
    throw new AppError(404, 'not_found', 'Playlist entry was not found');
  }
  await Entry.updateMany(
    { playlistId: playlist._id, position: { $gt: entry.position } },
    { $inc: { position: -1 } }
  );
  await audit(actor, 'playlist_entry_removed', {
    playlistId: playlist._id,
    rotationGameId: entry.rotationGameId,
    beforeVersion: version,
    afterVersion: playlist.version
  });
  return buildPlaylistDto(playlist, actor._id);
}

async function reorderPlaylist(actor, playlistId, entryIds, version, { now = new Date() } = {}) {
  const entries = await Entry.find({ playlistId }).sort({ position: 1 });
  const currentIds = entries.map((entry) => String(entry._id));
  if (
    entryIds.length !== currentIds.length ||
    new Set(entryIds).size !== entryIds.length ||
    entryIds.some((entryId) => !currentIds.includes(entryId))
  ) {
    throw new AppError(
      400,
      'invalid_playlist_order',
      'entryIds must contain every playlist entry exactly once'
    );
  }
  const playlist = await requireEditablePlaylist(playlistId, version, actor, now);
  await Entry.bulkWrite(
    entryIds.map((entryId, index) => ({
      updateOne: {
        filter: { _id: entryId, playlistId },
        update: { $set: { position: -(index + 1) } }
      }
    })),
    { ordered: true }
  );
  await Entry.bulkWrite(
    entryIds.map((entryId, index) => ({
      updateOne: { filter: { _id: entryId, playlistId }, update: { $set: { position: index + 1 } } }
    })),
    { ordered: true }
  );
  await audit(actor, 'playlist_reordered', {
    playlistId: playlist._id,
    beforeVersion: version,
    afterVersion: playlist.version,
    details: { entryIds }
  });
  return buildPlaylistDto(playlist, actor._id);
}

async function publishPlaylist(actor, id, version) {
  const playlist = await Playlist.findById(id);
  if (!playlist) throw new AppError(404, 'not_found', 'Playlist was not found');
  if (playlist.status !== 'draft' || !playlistIsEditable(playlist)) {
    throw new AppError(409, 'playlist_not_editable', 'Only an active draft can be published');
  }
  if (playlist.version !== version) {
    throw new AppError(
      409,
      'playlist_version_conflict',
      'This playlist changed. Reload it before saving.'
    );
  }
  const count = await Entry.countDocuments({ playlistId: playlist._id });
  if (count < 1)
    throw new AppError(
      400,
      'invalid_playlist_size',
      'A playlist needs at least one game before publication'
    );
  Object.assign(playlist, {
    status: 'published',
    version: playlist.version + 1,
    publishedBy: actor._id,
    publishedAt: new Date(),
    updatedBy: actor._id
  });
  await playlist.save();
  await audit(actor, 'playlist_published', {
    playlistId: playlist._id,
    afterVersion: playlist.version
  });
  return buildPlaylistDto(playlist, actor._id);
}

async function cancelPlaylist(actor, id, version, reason, now = new Date()) {
  const playlist = await Playlist.findOneAndUpdate(
    { _id: id, status: 'published', endsAt: { $gt: now }, version },
    {
      $set: {
        status: 'cancelled',
        cancellationReason: reason,
        cancelledBy: actor._id,
        cancelledAt: now,
        updatedBy: actor._id
      },
      $inc: { version: 1 }
    },
    { new: true }
  );
  if (!playlist) {
    const existing = await Playlist.findById(id);
    if (!existing) throw new AppError(404, 'not_found', 'Playlist was not found');
    if (existing.status !== 'published' || existing.endsAt <= now) {
      throw new AppError(
        409,
        'playlist_not_cancellable',
        'Only an active published playlist can be cancelled'
      );
    }
    throw new AppError(
      409,
      'playlist_version_conflict',
      'This playlist changed. Reload it before saving.'
    );
  }
  await audit(actor, 'playlist_cancelled', {
    playlistId: playlist._id,
    beforeVersion: version,
    afterVersion: playlist.version,
    details: { reason }
  });
  return buildPlaylistDto(playlist, actor._id);
}

async function restoreCancelledPlaylist(actor, id, version, now = new Date()) {
  const playlist = await Playlist.findOneAndUpdate(
    { _id: id, status: 'cancelled', endsAt: { $gt: now }, version },
    {
      $set: { status: 'draft', updatedBy: actor._id },
      $unset: { cancellationReason: 1, cancelledBy: 1, cancelledAt: 1 },
      $inc: { version: 1 }
    },
    { new: true }
  );
  if (!playlist) {
    const existing = await Playlist.findById(id);
    if (!existing) throw new AppError(404, 'not_found', 'Playlist was not found');
    if (existing.status !== 'cancelled' || existing.endsAt <= now) {
      throw new AppError(
        409,
        'playlist_not_restorable',
        'Only a cancelled playlist can be restored before Saturday at 06:00 Europe/Rome'
      );
    }
    throw new AppError(
      409,
      'playlist_version_conflict',
      'This playlist changed. Reload it before saving.'
    );
  }
  await audit(actor, 'playlist_restored', {
    playlistId: playlist._id,
    beforeVersion: version,
    afterVersion: playlist.version
  });
  return buildPlaylistDto(playlist, actor._id);
}

async function completeElapsedPlaylists(now = new Date()) {
  return (
    await Playlist.updateMany(
      { status: 'published', endsAt: { $lte: now } },
      { $set: { status: 'completed', completedAt: now }, $inc: { version: 1 } }
    )
  ).modifiedCount;
}

module.exports = {
  addToPlaylist,
  buildPlaylistDto,
  cancelPlaylist,
  completeElapsedPlaylists,
  playlistIsEditable,
  publishPlaylist,
  removeFromPlaylist,
  removeKeyOffer,
  reorderPlaylist,
  restoreCancelledPlaylist,
  updateKeyOffer
};
