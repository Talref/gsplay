const mongoose = require('mongoose');
const LibraryItem = require('../models/LibraryItem');
const User = require('../models/User');
const { AppError } = require('../http/errors');
const { MULTIPLAYER_MODES, normalizedMultiplayerModes } = require('./multiplayerModes');
const multiplayerModeMap = new Map(MULTIPLAYER_MODES.map((mode) => [mode.id, mode]));
const multiplayerSourceValues = MULTIPLAYER_MODES.flatMap((mode) => mode.sourceValues);

function distinctIds(values) {
  if (!Array.isArray(values)) return [];
  return values.map((value) => {
    if (!mongoose.isObjectIdOrHexString(value))
      throw new AppError(400, 'invalid_request', 'userIds must contain valid identifiers');
    return new mongoose.Types.ObjectId(value);
  });
}

function stringList(values, field, maximum = 50) {
  if (values === undefined) return [];
  if (!Array.isArray(values) || values.length > maximum)
    throw new AppError(400, 'invalid_request', `${field} must be an array`);
  const result = values.map((value) => {
    if (typeof value !== 'string' || !value.trim() || value.length > 128)
      throw new AppError(400, 'invalid_request', `${field} contains an invalid value`);
    return value.trim();
  });
  if (new Set(result).size !== result.length)
    throw new AppError(400, 'invalid_request', `${field} must not contain duplicates`);
  return result;
}

function positiveInteger(value, fallback, field, maximum) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 1 || value > maximum)
    throw new AppError(400, 'invalid_request', `${field} must be between 1 and ${maximum}`);
  return value;
}

function normalizeOptions(data) {
  const userIds = distinctIds(data.userIds);
  if (new Set(userIds.map(String)).size !== userIds.length || userIds.length < 2 || userIds.length > 10)
    throw new AppError(400, 'invalid_request', 'Select between two and ten distinct users');
  const genres = stringList(data.genres, 'genres');
  const multiplayerModes = stringList(data.multiplayerModes, 'multiplayerModes', 10);
  multiplayerModes.forEach((mode) => {
    if (!multiplayerModeMap.has(mode))
      throw new AppError(400, 'invalid_request', `Unsupported multiplayer mode: ${mode}`);
  });
  if (data.multiplayerOnly !== undefined && typeof data.multiplayerOnly !== 'boolean')
    throw new AppError(400, 'invalid_request', 'multiplayerOnly must be a boolean');
  return {
    userIds,
    genres,
    multiplayerOnly: Boolean(data.multiplayerOnly || multiplayerModes.length),
    multiplayerModes,
    page: positiveInteger(data.page, 1, 'page', 10_000),
    pageSize: positiveInteger(data.pageSize, 24, 'pageSize', 48)
  };
}

async function compareLibraries(data) {
  const options = normalizeOptions(data);
  const users = await User.find(
    { _id: { $in: options.userIds } },
    'usernameDisplay'
  ).lean();
  if (users.length !== options.userIds.length)
    throw new AppError(404, 'not_found', 'One or more selected users were not found');
  const userMap = new Map(users.map((user) => [String(user._id), user.usernameDisplay]));
  const selectedUsers = options.userIds.map((userId) => ({
    id: String(userId),
    username: userMap.get(String(userId))
  }));
  const resultFilter = {};
  if (options.genres.length) resultFilter['game.genres'] = { $in: options.genres };
  if (options.multiplayerModes.length) {
    resultFilter['game.gameModes'] = {
      $in: options.multiplayerModes.flatMap((mode) => multiplayerModeMap.get(mode).sourceValues)
    };
  } else if (options.multiplayerOnly) {
    resultFilter['game.gameModes'] = { $in: multiplayerSourceValues };
  }

  const [aggregate] = await LibraryItem.aggregate([
    {
      $match: {
        userId: { $in: options.userIds },
        removedAt: null,
        canonicalGameId: { $ne: null }
      }
    },
    { $group: { _id: '$canonicalGameId', ownerIds: { $addToSet: '$userId' } } },
    { $set: { ownerCount: { $size: '$ownerIds' } } },
    { $match: { ownerCount: { $gte: 2 } } },
    {
      $lookup: {
        from: 'canonical_games_v2',
        localField: '_id',
        foreignField: '_id',
        as: 'game'
      }
    },
    { $unwind: '$game' },
    { $match: { 'game.hiddenAt': null, 'game.archivedAt': null, 'game.mergedIntoId': null } },
    {
      $facet: {
        games: [
          ...(Object.keys(resultFilter).length ? [{ $match: resultFilter }] : []),
          { $sort: { ownerCount: -1, 'game.canonicalTitle': 1, _id: 1 } },
          { $skip: (options.page - 1) * options.pageSize },
          { $limit: options.pageSize }
        ],
        total: [
          ...(Object.keys(resultFilter).length ? [{ $match: resultFilter }] : []),
          { $count: 'value' }
        ],
        genres: [
          { $unwind: '$game.genres' },
          { $group: { _id: '$game.genres' } },
          { $sort: { _id: 1 } }
        ],
        gameModes: [
          { $unwind: '$game.gameModes' },
          { $group: { _id: '$game.gameModes' } }
        ]
      }
    }
  ]);
  const availableModeIds = new Set(
    normalizedMultiplayerModes((aggregate?.gameModes || []).map((row) => row._id)).map(
      (mode) => mode.id
    )
  );
  const games = (aggregate?.games || []).map((row) => {
    const owners = selectedUsers.filter((user) => row.ownerIds.some((ownerId) => ownerId.equals(user.id)));
    return {
      id: String(row._id),
      title: row.game.canonicalTitle,
      artwork: row.game.artwork || null,
      igdbUrl: row.game.igdbUrl || null,
      genres: row.game.genres || [],
      multiplayerModes: normalizedMultiplayerModes(row.game.gameModes),
      ownerIds: owners.map((owner) => owner.id),
      owners,
      ownerCount: row.ownerCount,
      selectedUserCount: selectedUsers.length
    };
  });
  const total = aggregate?.total?.[0]?.value || 0;
  return {
    users: selectedUsers,
    games,
    page: {
      number: options.page,
      size: options.pageSize,
      total,
      hasMore: options.page * options.pageSize < total
    },
    filters: {
      genres: options.genres,
      multiplayerOnly: options.multiplayerOnly,
      multiplayerModes: options.multiplayerModes
    },
    facets: {
      genres: (aggregate?.genres || []).map((row) => row._id),
      multiplayerModes: MULTIPLAYER_MODES.filter((mode) => availableModeIds.has(mode.id)).map(
        ({ id, label }) => ({ id, label })
      )
    }
  };
}

module.exports = { MULTIPLAYER_MODES, compareLibraries, normalizedModes: normalizedMultiplayerModes };
