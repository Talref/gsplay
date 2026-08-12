const mongoose = require('mongoose');
const CanonicalGame = require('../models/CanonicalGame');
const CasualFridayRotationGame = require('../models/CasualFridayRotationGame');
const { normalizedMultiplayerModes } = require('./multiplayerModes');

const GAME_PATH = /^\/catalogue\/([^/]+)\/?$/;
const DESCRIPTION_LIMIT = 220;

function compactText(value, limit = DESCRIPTION_LIMIT) {
  const normalized = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalized.length <= limit) return normalized;
  const shortened = normalized.slice(0, limit - 1);
  const lastSpace = shortened.lastIndexOf(' ');
  const cutAt = lastSpace > limit * 0.7 ? lastSpace : shortened.length;
  return `${shortened.slice(0, cutAt).trimEnd()}…`;
}

function publicArtwork(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function playerCount(rotation) {
  if (!rotation) return null;
  if (rotation.playerCountLabel) return rotation.playerCountLabel;
  if (rotation.playerCountMin === rotation.playerCountMax) {
    return `${rotation.playerCountMin} ${rotation.playerCountMin === 1 ? 'giocatore' : 'giocatori'}`;
  }
  return `${rotation.playerCountMin}–${rotation.playerCountMax} giocatori`;
}

function buildGameDescription(game, rotation) {
  const details = [];
  if (game.genres?.length) details.push(game.genres.slice(0, 3).join(', '));
  const multiplayer = normalizedMultiplayerModes(game.gameModes).map((mode) => mode.label);
  if (multiplayer.length) details.push(multiplayer.join(', '));
  const players = playerCount(rotation);
  if (players) details.push(players);
  if (rotation) details.push('In rotazione Casual Friday');
  if (details.length) return compactText(details.join(' • '));
  if (game.summary) return compactText(game.summary);
  return compactText(
    `Scheda de ${game.canonicalTitle} nel catalogo GSPlay. Tutto pronto, manca solo decide quando giocà.`
  );
}

async function gameMetadata(gameId) {
  if (!mongoose.isObjectIdOrHexString(gameId)) return null;
  const game = await CanonicalGame.findOne(
    {
      _id: gameId,
      hiddenAt: null,
      archivedAt: null,
      mergedIntoId: null
    },
    'canonicalTitle summary genres gameModes artwork'
  ).lean();
  if (!game) return null;
  const rotation = await CasualFridayRotationGame.findOne(
    { canonicalGameId: game._id, status: 'active' },
    'playerCountMin playerCountMax playerCountLabel'
  ).lean();
  const artwork = publicArtwork(game.artwork);
  return {
    title: game.canonicalTitle,
    description: buildGameDescription(game, rotation),
    image: artwork || undefined,
    url: `/catalogue/${game._id}`,
    type: 'website',
    twitterCard: artwork ? 'summary_large_image' : 'summary'
  };
}

async function resolveSocialMetadata(req) {
  const match = req.path.match(GAME_PATH);
  if (!match) return null;
  return gameMetadata(match[1]);
}

module.exports = { buildGameDescription, gameMetadata, resolveSocialMetadata };
