const CanonicalGame = require('../../models/CanonicalGame');
const Rotation = require('../../models/CasualFridayRotationGame');
const Playlist = require('../../models/CasualFridayPlaylist');
const Entry = require('../../models/CasualFridayPlaylistEntry');
const { AppError } = require('../../http/errors');
const { normalizeTitle } = require('../titleNormalization');
const {
  audit,
  cleanDisplayTitle,
  gameDto,
  https,
  itadSnapshot,
  rotationSnapshot
} = require('./common');
const { refreshOneRotationOffer, resetItad, verifyItad } = require('./itadService');
const { approveProposal } = require('./proposalService');

const editableStatuses = ['draft', 'published'];
const modes = new Set(['none', 'host_runs', 'streamable']);
const kinds = new Set(['owned_store', 'external_store', 'free', 'web']);

function fields(data) {
  const value = { ...data, displayTitle: cleanDisplayTitle(data.displayTitle) };
  if (
    !value.displayTitle ||
    !Number.isInteger(value.playerCountMin) ||
    !Number.isInteger(value.playerCountMax) ||
    value.playerCountMin < 1 ||
    value.playerCountMax < value.playerCountMin ||
    !modes.has(value.hostMode) ||
    !kinds.has(value.acquisitionKind)
  ) {
    throw new AppError(400, 'invalid_request', 'Rotation fields are invalid');
  }
  if (value.artworkOverride) https(value.artworkOverride, 'artworkOverride');
  if (['free', 'web', 'external_store'].includes(value.acquisitionKind))
    https(value.acquisitionUrl, 'acquisitionUrl');
  return value;
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
  const games = await CanonicalGame.find({
    _id: { $in: rotations.map((item) => item.canonicalGameId) }
  });
  const gameMap = new Map(games.map((game) => [String(game._id), game]));
  return rotations.map((rotation) =>
    rotationDto(rotation, gameMap.get(String(rotation.canonicalGameId)))
  );
}

async function createRotation(actor, data, { itadClient } = {}) {
  const game = await CanonicalGame.findOne({
    _id: data.canonicalGameId,
    hiddenAt: null,
    archivedAt: null,
    mergedIntoId: null
  });
  if (!game) throw new AppError(404, 'not_found', 'Catalogue game was not found');
  if (await Rotation.exists({ canonicalGameId: game._id, status: 'active' })) {
    throw new AppError(409, 'rotation_game_exists', 'Game is already in the active rotation');
  }
  const rotation = new Rotation({
    ...fields({
      ...data,
      displayTitle: data.displayTitle || cleanDisplayTitle(game.canonicalTitle),
      info: data.info ?? game.summary
    }),
    canonicalGameId: game._id,
    addedBy: actor._id,
    updatedBy: actor._id
  });
  resetItad(rotation);
  await verifyItad(rotation, itadClient);
  await refreshOneRotationOffer(rotation, itadClient);
  await rotation.save();
  await audit(actor, 'rotation_added', { rotationGameId: rotation._id });
  await approveProposal(actor, game._id, rotation._id);
  return rotationDto(rotation, game);
}

async function createExternalRotation(actor, data, { igdbClient, itadClient } = {}) {
  let game;
  if (data.igdbSlug) {
    const metadata = await igdbClient.getGameBySlug(data.igdbSlug);
    if (!metadata) throw new AppError(404, 'not_found', 'IGDB game was not found');
    game =
      (await CanonicalGame.findOne({ igdbId: metadata.igdbId, mergedIntoId: null })) ||
      (await CanonicalGame.create({
        ...metadata,
        origin: 'casual_friday',
        storeAvailability: 'independent',
        metadata: { status: 'complete' },
        metadataReviewedBy: actor._id,
        metadataReviewedAt: new Date()
      }));
  } else {
    const title = cleanDisplayTitle(data.title);
    if (!title) throw new AppError(400, 'invalid_request', 'title is required');
    game = await CanonicalGame.create({
      canonicalTitle: title,
      normalizedTitle: normalizeTitle(title),
      artwork: data.artworkOverride,
      summary: data.info,
      origin: 'casual_friday',
      storeAvailability: 'independent',
      metadata: { status: 'complete' },
      metadataReviewedBy: actor._id,
      metadataReviewedAt: new Date()
    });
  }
  return createRotation(
    actor,
    {
      ...data,
      canonicalGameId: game._id,
      displayTitle: data.displayTitle || cleanDisplayTitle(game.canonicalTitle),
      info: data.info ?? game.summary
    },
    { itadClient }
  );
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
  await audit(actor, 'rotation_updated', {
    rotationGameId: rotation._id,
    details: { syncedPlaylistEntries: syncedEntries }
  });
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
    {
      $set: {
        status: 'retired',
        retiredAt,
        retiredBy: actor._id,
        retirementReason: reason,
        updatedBy: actor._id
      }
    },
    { new: true, runValidators: false }
  );
  if (!rotation) {
    if (!(await Rotation.exists({ _id: id })))
      throw new AppError(404, 'not_found', 'Rotation game was not found');
    return;
  }
  await audit(actor, 'rotation_retired', { rotationGameId: rotation._id, details: { reason } });
}

module.exports = {
  createExternalRotation,
  createRotation,
  listRotation,
  recheckItad,
  retireRotation,
  updateRotation
};
