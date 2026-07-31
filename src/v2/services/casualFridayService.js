const CanonicalGame = require('../models/CanonicalGame');
const Rotation = require('../models/CasualFridayRotationGame');
const Playlist = require('../models/CasualFridayPlaylist');
const Entry = require('../models/CasualFridayPlaylistEntry');
const Audit = require('../models/CasualFridayAudit');
const LibraryItem = require('../models/LibraryItem');
const { normalizeTitle } = require('./titleNormalization');
const { ItadProviderError } = require('../providers/itadClient');
const { AppError } = require('../http/errors');

const EVENT_TIME_ZONE = 'Europe/Rome';
const editableStatuses = ['draft', 'published'];
const modes = new Set(['none', 'host_runs', 'streamable']);
const kinds = new Set(['owned_store', 'external_store', 'free', 'web']);

const cleanDisplayTitle = (value) => String(value || '').trim()
  .replace(/\s+-\s+[^\s]+\.(?:exe|app|bat|cmd|sh)$/i, '').trim() || String(value || '').trim();
const https = (value, field) => {
  if (!/^https:\/\//.test(value || '')) throw new AppError(400, 'invalid_request', `${field} must be an HTTPS URL`);
};

function zonedParts(date, timeZone = EVENT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, Number(value)]));
}

function zonedDateTimeToUtc({ year, month, day, hour = 0, minute = 0, second = 0 }, timeZone = EVENT_TIME_ZONE) {
  const target = Date.UTC(year, month - 1, day, hour, minute, second);
  let result = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = zonedParts(new Date(result), timeZone);
    const difference = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second) - target;
    if (!difference) break;
    result -= difference;
  }
  return new Date(result);
}

function addLocalDays(parts, days) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function nextFridayWindow(now = new Date()) {
  const local = zonedParts(now);
  const localDay = new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay();
  const usePreviousFriday = localDay === 6 && local.hour < 6;
  const days = usePreviousFriday ? -1 : (5 - localDay + 7) % 7 || (localDay === 5 ? 0 : 7);
  const friday = addLocalDays(local, days);
  const saturday = addLocalDays(friday, 1);
  const weekKey = `${friday.year}-${String(friday.month).padStart(2, '0')}-${String(friday.day).padStart(2, '0')}`;
  return {
    weekKey,
    startsAt: zonedDateTimeToUtc({ ...friday, hour: 19 }),
    endsAt: zonedDateTimeToUtc({ ...saturday, hour: 6 })
  };
}

async function audit(actor, kind, data) {
  await Audit.create({ actorUserId: actor._id, actorUsernameSnapshot: actor.usernameDisplay, kind, ...data });
}

const gameDto = (game) => ({
  id: String(game._id),
  title: game.canonicalTitle,
  artwork: game.artwork,
  summary: game.summary,
  genres: game.genres || [],
  igdbUrl: game.igdbUrl
});

function fields(data) {
  const value = { ...data, displayTitle: cleanDisplayTitle(data.displayTitle) };
  if (!value.displayTitle || !Number.isInteger(value.playerCountMin) || !Number.isInteger(value.playerCountMax)
    || value.playerCountMin < 1 || value.playerCountMax < value.playerCountMin
    || !modes.has(value.hostMode) || !kinds.has(value.acquisitionKind)) {
    throw new AppError(400, 'invalid_request', 'Rotation fields are invalid');
  }
  if (value.artworkOverride) https(value.artworkOverride, 'artworkOverride');
  if (['free', 'web', 'external_store'].includes(value.acquisitionKind)) https(value.acquisitionUrl, 'acquisitionUrl');
  return value;
}

function resetItad(rotation) {
  if (['free', 'web'].includes(rotation.acquisitionKind)) {
    Object.assign(rotation, {
      itadStatus: 'not_required', itadCheckedAt: undefined, itadError: undefined,
      itadGameId: undefined, itadTitle: undefined, itadOffer: null,
      itadOfferCheckedAt: undefined, itadOfferError: undefined
    });
  } else {
    Object.assign(rotation, {
      itadStatus: 'pending', itadCheckedAt: undefined, itadError: undefined,
      itadGameId: undefined, itadTitle: undefined, itadOffer: null,
      itadOfferCheckedAt: undefined, itadOfferError: undefined
    });
  }
}

async function verifyItad(rotation, itadClient) {
  if (['free', 'web'].includes(rotation.acquisitionKind)) {
    resetItad(rotation);
    return;
  }
  try {
    const previousGameId = rotation.itadGameId;
    const found = await itadClient.lookupTitle(rotation.displayTitle);
    const matchedGameId = found.outcome === 'matched' ? found.game.id : undefined;
    Object.assign(rotation, {
      itadCheckedAt: new Date(),
      itadStatus: found.outcome === 'matched' ? 'verified' : found.outcome === 'ambiguous' ? 'ambiguous' : 'not_found',
      itadGameId: matchedGameId,
      itadTitle: found.outcome === 'matched' ? found.game.title : undefined,
      itadError: undefined
    });
    if (!matchedGameId || matchedGameId !== previousGameId) {
      Object.assign(rotation, {
        itadOffer: null, itadOfferCheckedAt: undefined, itadOfferError: undefined
      });
    }
  } catch (error) {
    Object.assign(rotation, {
      itadStatus: 'error',
      itadCheckedAt: new Date(),
      itadError: error instanceof ItadProviderError ? error.message : 'ITAD verification failed'
    });
  }
}

function itadSnapshot(rotation) {
  return {
    status: rotation.itadStatus,
    gameId: rotation.itadGameId,
    title: rotation.itadTitle,
    checkedAt: rotation.itadCheckedAt,
    error: rotation.itadError,
    offer: rotation.itadOffer || null,
    offerCheckedAt: rotation.itadOfferCheckedAt,
    offerError: rotation.itadOfferError
  };
}

async function refreshOneRotationOffer(rotation, itadClient, now = new Date()) {
  if (rotation.itadStatus !== 'verified' || !rotation.itadGameId) return;
  try {
    const offers = await itadClient.bestOffers([rotation.itadGameId]);
    Object.assign(rotation, {
      itadOffer: offers.get(rotation.itadGameId) || null,
      itadOfferCheckedAt: now,
      itadOfferError: undefined
    });
  } catch (error) {
    rotation.itadOfferError = error instanceof ItadProviderError ? error.message : 'ITAD price refresh failed';
  }
}

const rotationDto = (rotation, game) => ({
  id: String(rotation._id),
  canonicalGameId: String(rotation.canonicalGameId),
  displayTitle: cleanDisplayTitle(rotation.displayTitle || game?.canonicalTitle || 'Untitled game'),
  artwork: rotation.artworkOverride || game?.artwork || null,
  info: rotation.info || game?.summary || '',
  status: rotation.status,
  playerCountMin: rotation.playerCountMin,
  playerCountMax: rotation.playerCountMax,
  playerCountLabel: rotation.playerCountLabel,
  joinInstructions: rotation.joinInstructions,
  hostMode: rotation.hostMode,
  acquisitionKind: rotation.acquisitionKind,
  acquisitionUrl: rotation.acquisitionUrl,
  availabilityNote: rotation.availabilityNote,
  itad: itadSnapshot(rotation),
  game: game && gameDto(game)
});

async function listRotation() {
  const rotations = await Rotation.find().sort({ status: 1, createdAt: -1 });
  const games = await CanonicalGame.find({ _id: { $in: rotations.map((item) => item.canonicalGameId) } });
  const gameMap = new Map(games.map((game) => [String(game._id), game]));
  return rotations.map((rotation) => rotationDto(rotation, gameMap.get(String(rotation.canonicalGameId))));
}

async function createRotation(actor, data, { itadClient } = {}) {
  const game = await CanonicalGame.findOne({ _id: data.canonicalGameId, hiddenAt: null, archivedAt: null, mergedIntoId: null });
  if (!game) throw new AppError(404, 'not_found', 'Catalogue game was not found');
  if (await Rotation.exists({ canonicalGameId: game._id, status: 'active' })) {
    throw new AppError(409, 'rotation_game_exists', 'Game is already in the active rotation');
  }
  const rotation = new Rotation({
    ...fields({ ...data, displayTitle: data.displayTitle || cleanDisplayTitle(game.canonicalTitle), info: data.info ?? game.summary }),
    canonicalGameId: game._id, addedBy: actor._id, updatedBy: actor._id
  });
  resetItad(rotation);
  await verifyItad(rotation, itadClient);
  await refreshOneRotationOffer(rotation, itadClient);
  await rotation.save();
  await audit(actor, 'rotation_added', { rotationGameId: rotation._id });
  return rotationDto(rotation, game);
}

async function createExternalRotation(actor, data, { igdbClient, itadClient } = {}) {
  let game;
  if (data.igdbSlug) {
    const metadata = await igdbClient.getGameBySlug(data.igdbSlug);
    if (!metadata) throw new AppError(404, 'not_found', 'IGDB game was not found');
    game = await CanonicalGame.findOne({ igdbId: metadata.igdbId, mergedIntoId: null })
      || await CanonicalGame.create({
        ...metadata, origin: 'casual_friday', storeAvailability: 'independent',
        metadata: { status: 'complete' }, metadataReviewedBy: actor._id, metadataReviewedAt: new Date()
      });
  } else {
    const title = cleanDisplayTitle(data.title);
    if (!title) throw new AppError(400, 'invalid_request', 'title is required');
    game = await CanonicalGame.create({
      canonicalTitle: title, normalizedTitle: normalizeTitle(title), artwork: data.artworkOverride,
      summary: data.info, origin: 'casual_friday', storeAvailability: 'independent',
      metadata: { status: 'complete' }, metadataReviewedBy: actor._id, metadataReviewedAt: new Date()
    });
  }
  return createRotation(actor, {
    ...data, canonicalGameId: game._id,
    displayTitle: data.displayTitle || cleanDisplayTitle(game.canonicalTitle),
    info: data.info ?? game.summary
  }, { itadClient });
}

function rotationSnapshot(rotation, game) {
  return {
    displayTitle: rotation.displayTitle,
    artwork: rotation.artworkOverride || game.artwork,
    info: rotation.info || game.summary,
    playerCountMin: rotation.playerCountMin,
    playerCountMax: rotation.playerCountMax,
    playerCountLabel: rotation.playerCountLabel,
    joinInstructions: rotation.joinInstructions,
    hostMode: rotation.hostMode,
    acquisitionKind: rotation.acquisitionKind,
    acquisitionUrl: rotation.acquisitionUrl,
    availabilityNote: rotation.availabilityNote
  };
}

async function syncEditablePlaylistEntries(rotation, game, actor, now = new Date()) {
  const playlistIds = await Playlist.find({
    status: { $in: editableStatuses },
    endsAt: { $gt: now }
  }).distinct('_id');
  if (!playlistIds.length) return 0;
  const affectedPlaylistIds = await Entry.find({
    playlistId: { $in: playlistIds },
    rotationGameId: rotation._id
  }).distinct('playlistId');
  if (!affectedPlaylistIds.length) return 0;
  const result = await Entry.updateMany(
    { playlistId: { $in: affectedPlaylistIds }, rotationGameId: rotation._id },
    { $set: { 'snapshots.rotation': rotationSnapshot(rotation, game) } }
  );
  await Playlist.updateMany(
    { _id: { $in: affectedPlaylistIds } },
    { $inc: { version: 1 }, $set: { updatedBy: actor._id } }
  );
  return result.modifiedCount;
}

async function updateRotation(actor, id, data, { itadClient } = {}) {
  const rotation = await Rotation.findById(id);
  if (!rotation) throw new AppError(404, 'not_found', 'Rotation game was not found');
  const identity = `${rotation.displayTitle}:${rotation.acquisitionKind}`;
  Object.assign(rotation, fields({ ...rotation.toObject(), ...data }), { updatedBy: actor._id });
  if (`${rotation.displayTitle}:${rotation.acquisitionKind}` !== identity) {
    resetItad(rotation);
    await verifyItad(rotation, itadClient);
    await refreshOneRotationOffer(rotation, itadClient);
  }
  await rotation.save();
  const game = await CanonicalGame.findById(rotation.canonicalGameId);
  const syncedEntries = await syncEditablePlaylistEntries(rotation, game, actor);
  await audit(actor, 'rotation_updated', { rotationGameId: rotation._id, details: { syncedPlaylistEntries: syncedEntries } });
  return { ...rotationDto(rotation, game), syncedPlaylistEntries: syncedEntries };
}

async function recheckItad(actor, id, { itadClient } = {}) {
  const rotation = await Rotation.findById(id);
  if (!rotation) throw new AppError(404, 'not_found', 'Rotation game was not found');
  await verifyItad(rotation, itadClient);
  await refreshOneRotationOffer(rotation, itadClient);
  rotation.updatedBy = actor._id;
  await rotation.save();
  await audit(actor, 'rotation_itad_rechecked', { rotationGameId: rotation._id });
  return rotationDto(rotation, await CanonicalGame.findById(rotation.canonicalGameId));
}

async function retireRotation(actor, id, reason) {
  const retiredAt = new Date();
  const rotation = await Rotation.findOneAndUpdate(
    { _id: id, status: { $ne: 'retired' } },
    { $set: { status: 'retired', retiredAt, retiredBy: actor._id, retirementReason: reason, updatedBy: actor._id } },
    { new: true, runValidators: false }
  );
  if (!rotation) {
    if (!await Rotation.exists({ _id: id })) throw new AppError(404, 'not_found', 'Rotation game was not found');
    return;
  }
  await audit(actor, 'rotation_retired', { rotationGameId: rotation._id, details: { reason } });
}

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
    ? await LibraryItem.find({ userId, canonicalGameId: { $in: canonicalGameIds }, removedAt: null }).select('canonicalGameId provider')
    : [];
  const providers = new Map();
  ownership.forEach((item) => providers.set(String(item.canonicalGameId), [
    ...new Set([...(providers.get(String(item.canonicalGameId)) || []), item.provider])
  ]));
  const rotations = await Rotation.find({ _id: { $in: entries.map((entry) => entry.rotationGameId) } })
    .select('itadStatus itadGameId itadTitle itadCheckedAt itadError itadOffer itadOfferCheckedAt itadOfferError');
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
        owned: Boolean(providers.get(String(entry.canonicalGameId))?.length),
        providers: providers.get(String(entry.canonicalGameId)) || [],
        free: ['free', 'web'].includes(entry.snapshots.rotation.acquisitionKind)
      };
    })
  };
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
    throw new AppError(409, 'playlist_not_editable', 'The playlist can only be changed before Saturday at 06:00 Europe/Rome');
  }
  throw new AppError(409, 'playlist_version_conflict', 'This playlist changed. Reload it before saving.');
}

async function addToPlaylist(actor, id, { itadClient, now = new Date() } = {}) {
  const rotation = await Rotation.findOne({ _id: id, status: 'active' });
  if (!rotation) throw new AppError(404, 'not_found', 'Active rotation game was not found');
  const playlist = await upcomingPlaylist(actor, now);
  if (!playlistIsEditable(playlist, now)) {
    throw new AppError(409, 'playlist_not_editable', 'The playlist can only be changed before Saturday at 06:00 Europe/Rome');
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
    playlistId: playlist._id, rotationGameId: rotation._id, afterVersion: playlist.version,
    details: { itadStatus: itad.status, offerFound: Boolean(itad.offer) }
  });
  return buildPlaylistDto(playlist, actor._id);
}

async function removeFromPlaylist(actor, playlistId, entryId, version, { now = new Date() } = {}) {
  const playlist = await requireEditablePlaylist(playlistId, version, actor, now);
  const entry = await Entry.findOneAndDelete({ _id: entryId, playlistId: playlist._id });
  if (!entry) {
    await Playlist.updateOne({ _id: playlist._id, version: playlist.version }, { $inc: { version: -1 } });
    throw new AppError(404, 'not_found', 'Playlist entry was not found');
  }
  await Entry.updateMany({ playlistId: playlist._id, position: { $gt: entry.position } }, { $inc: { position: -1 } });
  await audit(actor, 'playlist_entry_removed', {
    playlistId: playlist._id, rotationGameId: entry.rotationGameId,
    beforeVersion: version, afterVersion: playlist.version
  });
  return buildPlaylistDto(playlist, actor._id);
}

async function reorderPlaylist(actor, playlistId, entryIds, version, { now = new Date() } = {}) {
  const entries = await Entry.find({ playlistId }).sort({ position: 1 });
  const currentIds = entries.map((entry) => String(entry._id));
  if (entryIds.length !== currentIds.length || new Set(entryIds).size !== entryIds.length
    || entryIds.some((entryId) => !currentIds.includes(entryId))) {
    throw new AppError(400, 'invalid_playlist_order', 'entryIds must contain every playlist entry exactly once');
  }
  const playlist = await requireEditablePlaylist(playlistId, version, actor, now);
  await Entry.bulkWrite(entryIds.map((entryId, index) => ({
    updateOne: { filter: { _id: entryId, playlistId }, update: { $set: { position: -(index + 1) } } }
  })), { ordered: true });
  await Entry.bulkWrite(entryIds.map((entryId, index) => ({
    updateOne: { filter: { _id: entryId, playlistId }, update: { $set: { position: index + 1 } } }
  })), { ordered: true });
  await audit(actor, 'playlist_reordered', {
    playlistId: playlist._id, beforeVersion: version, afterVersion: playlist.version, details: { entryIds }
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
    throw new AppError(409, 'playlist_version_conflict', 'This playlist changed. Reload it before saving.');
  }
  const count = await Entry.countDocuments({ playlistId: playlist._id });
  if (count < 1) throw new AppError(400, 'invalid_playlist_size', 'A playlist needs at least one game before publication');
  Object.assign(playlist, {
    status: 'published', version: playlist.version + 1, publishedBy: actor._id,
    publishedAt: new Date(), updatedBy: actor._id
  });
  await playlist.save();
  await audit(actor, 'playlist_published', { playlistId: playlist._id, afterVersion: playlist.version });
  return buildPlaylistDto(playlist, actor._id);
}

async function cancelPlaylist(actor, id, version, reason, now = new Date()) {
  const playlist = await Playlist.findOneAndUpdate(
    { _id: id, status: 'published', endsAt: { $gt: now }, version },
    {
      $set: {
        status: 'cancelled', cancellationReason: reason, cancelledBy: actor._id,
        cancelledAt: now, updatedBy: actor._id
      },
      $inc: { version: 1 }
    },
    { new: true }
  );
  if (!playlist) {
    const existing = await Playlist.findById(id);
    if (!existing) throw new AppError(404, 'not_found', 'Playlist was not found');
    if (existing.status !== 'published' || existing.endsAt <= now) {
      throw new AppError(409, 'playlist_not_cancellable', 'Only an active published playlist can be cancelled');
    }
    throw new AppError(409, 'playlist_version_conflict', 'This playlist changed. Reload it before saving.');
  }
  await audit(actor, 'playlist_cancelled', {
    playlistId: playlist._id, beforeVersion: version, afterVersion: playlist.version, details: { reason }
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
      throw new AppError(409, 'playlist_not_restorable', 'Only a cancelled playlist can be restored before Saturday at 06:00 Europe/Rome');
    }
    throw new AppError(409, 'playlist_version_conflict', 'This playlist changed. Reload it before saving.');
  }
  await audit(actor, 'playlist_restored', {
    playlistId: playlist._id, beforeVersion: version, afterVersion: playlist.version
  });
  return buildPlaylistDto(playlist, actor._id);
}

async function completeElapsedPlaylists(now = new Date()) {
  return (await Playlist.updateMany(
    { status: 'published', endsAt: { $lte: now } },
    { $set: { status: 'completed', completedAt: now }, $inc: { version: 1 } }
  )).modifiedCount;
}

async function refreshRotationOffers({ itadClient, now = new Date() }) {
  const rotations = await Rotation.find({
    status: 'active',
    acquisitionKind: { $nin: ['free', 'web'] },
    itadStatus: 'verified',
    itadGameId: { $exists: true, $ne: null }
  });
  if (!rotations.length) return { checked: 0, offers: 0, batches: 0 };
  let offers = 0;
  let batches = 0;
  for (let offset = 0; offset < rotations.length; offset += 200) {
    const batch = rotations.slice(offset, offset + 200);
    const ids = [...new Set(batch.map((rotation) => rotation.itadGameId))];
    try {
      const results = await itadClient.bestOffers(ids);
      const operations = batch.map((rotation) => {
        const offer = results.get(rotation.itadGameId) || null;
        if (offer) offers += 1;
        return {
          updateOne: {
            filter: { _id: rotation._id, status: 'active', itadGameId: rotation.itadGameId },
            update: { $set: { itadOffer: offer, itadOfferCheckedAt: now }, $unset: { itadOfferError: 1 } }
          }
        };
      });
      await Rotation.bulkWrite(operations);
      batches += 1;
    } catch (error) {
      const message = error instanceof ItadProviderError ? error.message : 'ITAD price refresh failed';
      await Rotation.updateMany(
        { _id: { $in: batch.map((rotation) => rotation._id) } },
        { $set: { itadOfferError: message } }
      );
    }
  }
  return { checked: rotations.length, offers, batches };
}

module.exports = {
  EVENT_TIME_ZONE,
  addToPlaylist,
  buildPlaylistDto,
  cancelPlaylist,
  cleanDisplayTitle,
  completeElapsedPlaylists,
  createExternalRotation,
  createRotation,
  listRotation,
  nextFridayWindow,
  playlistIsEditable,
  publishPlaylist,
  refreshRotationOffers,
  restoreCancelledPlaylist,
  recheckItad,
  removeFromPlaylist,
  reorderPlaylist,
  retireRotation,
  updateRotation
};
