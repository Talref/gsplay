const { AppError } = require('../http/errors');
const { exactKeys, object } = require('../http/validate');
const ServerStatusSnapshot = require('../models/ServerStatusSnapshot');

const STATUSES = new Set(['running', 'starting', 'stopping', 'offline', 'unknown', 'idle']);
const SERVER_KEYS = [
  'groupId',
  'groupName',
  'managerMention',
  'provider',
  'name',
  'identifier',
  'status',
  'uptimeMilliseconds',
  'players',
  'maxPlayers',
  'ampAppState'
];

function requiredString(value, field, max) {
  if (typeof value !== 'string')
    throw new AppError(400, 'invalid_server_status', `${field} must be a string`);
  const result = value.trim();
  if (!result || result.length > max)
    throw new AppError(
      400,
      'invalid_server_status',
      `${field} must contain between 1 and ${max} characters`
    );
  return result;
}

function optionalNumber(value, field, { integer = false } = {}) {
  if (value === undefined || value === null) return value ?? null;
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > Number.MAX_SAFE_INTEGER ||
    (integer && !Number.isSafeInteger(value))
  )
    throw new AppError(
      400,
      'invalid_server_status',
      `${field} must be ${integer ? 'a non-negative integer' : 'a non-negative number'} or null`
    );
  return value;
}

function normalizeServer(value, index) {
  const server = object(value, `servers[${index}]`);
  exactKeys(server, SERVER_KEYS);
  const managerMention = server.managerMention
    ? requiredString(server.managerMention, `servers[${index}].managerMention`, 32)
    : null;
  if (managerMention && !/^<@!?\d+>$/.test(managerMention))
    throw new AppError(
      400,
      'invalid_server_status',
      `servers[${index}].managerMention must be a Discord user mention`
    );
  const status = requiredString(server.status, `servers[${index}].status`, 16).toLowerCase();
  if (!STATUSES.has(status))
    throw new AppError(400, 'invalid_server_status', `servers[${index}].status is not supported`);

  const result = {
    groupId: requiredString(server.groupId, `servers[${index}].groupId`, 64),
    groupName: requiredString(server.groupName, `servers[${index}].groupName`, 128),
    managerMention,
    name: requiredString(server.name, `servers[${index}].name`, 128),
    identifier: requiredString(server.identifier, `servers[${index}].identifier`, 128),
    status,
    uptimeMilliseconds: optionalNumber(
      server.uptimeMilliseconds,
      `servers[${index}].uptimeMilliseconds`
    )
  };
  if (server.players !== undefined && server.players !== null)
    result.players = optionalNumber(server.players, `servers[${index}].players`, { integer: true });
  if (server.maxPlayers !== undefined && server.maxPlayers !== null)
    result.maxPlayers = optionalNumber(server.maxPlayers, `servers[${index}].maxPlayers`, {
      integer: true
    });
  if (
    result.players !== undefined &&
    result.maxPlayers !== undefined &&
    result.players > result.maxPlayers
  )
    throw new AppError(
      400,
      'invalid_server_status',
      `servers[${index}].players cannot exceed maxPlayers`
    );
  return result;
}

function normalizeSnapshot(value) {
  const body = object(value);
  exactKeys(body, ['sourceUpdatedAt', 'servers']);
  const sourceUpdatedAt = new Date(body.sourceUpdatedAt);
  if (
    typeof body.sourceUpdatedAt !== 'string' ||
    Number.isNaN(sourceUpdatedAt.getTime()) ||
    sourceUpdatedAt.toISOString() !== body.sourceUpdatedAt
  )
    throw new AppError(400, 'invalid_server_status', 'sourceUpdatedAt must be an ISO date string');
  if (!Array.isArray(body.servers) || body.servers.length < 1 || body.servers.length > 100)
    throw new AppError(
      400,
      'invalid_server_status',
      'servers must contain between 1 and 100 entries'
    );
  const servers = body.servers.map(normalizeServer);
  const identities = new Set();
  const groups = new Map();
  servers.forEach((server, index) => {
    const identity = `${server.groupId}\0${server.identifier}`;
    if (identities.has(identity))
      throw new AppError(
        400,
        'invalid_server_status',
        `servers[${index}] duplicates a groupId and identifier pair`
      );
    identities.add(identity);
    const group = groups.get(server.groupId);
    if (
      group &&
      (group.groupName !== server.groupName || group.managerMention !== server.managerMention)
    )
      throw new AppError(
        400,
        'invalid_server_status',
        `servers[${index}] conflicts with another entry in the same group`
      );
    groups.set(server.groupId, {
      groupName: server.groupName,
      managerMention: server.managerMention
    });
  });
  return { sourceUpdatedAt, servers };
}

async function replaceServerStatusSnapshot(value) {
  const snapshot = normalizeSnapshot(value);
  const receivedAt = new Date();
  await ServerStatusSnapshot.findOneAndUpdate(
    { singletonKey: 'current' },
    { $set: { ...snapshot, receivedAt }, $setOnInsert: { singletonKey: 'current' } },
    { new: true, upsert: true, runValidators: true }
  );
  return {
    sourceUpdatedAt: snapshot.sourceUpdatedAt,
    receivedAt,
    serverCount: snapshot.servers.length
  };
}

module.exports = { normalizeSnapshot, replaceServerStatusSnapshot };
