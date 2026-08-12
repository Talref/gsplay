const mongoose = require('mongoose');
const CanonicalGame = require('../models/CanonicalGame');
const CasualFridayRotationGame = require('../models/CasualFridayRotationGame');
const CasualFridayEvent = require('../models/CasualFridayEvent');
const CasualFridayPlaylist = require('../models/CasualFridayPlaylist');
const CasualFridayPlaylistEntry = require('../models/CasualFridayPlaylistEntry');
const { normalizedMultiplayerModes } = require('./multiplayerModes');
const { EVENT_TIME_ZONE } = require('./casualFriday/scheduling');

const GAME_PATH = /^\/catalogue\/([^/]+)\/?$/;
const CASUAL_FRIDAY_PATH = /^\/casual-friday\/?$/;
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

function casualFridayDate(startsAt) {
  return new Intl.DateTimeFormat('it-IT', {
    day: 'numeric',
    month: 'long',
    timeZone: EVENT_TIME_ZONE
  }).format(startsAt);
}

function casualFridayTitle(event) {
  return `Casual Friday — ${casualFridayDate(event.startsAt)}`;
}

function votingDescription(event) {
  const deadline = new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: EVENT_TIME_ZONE
  }).format(event.votingClosesAt);
  return `Le votazioni sono aperte fino alle ${deadline}: entra, dai la disponibilità e scegli fino a cinque giochi. Daje, che er Senato aspetta er voto tuo.`;
}

function playlistEntryTitle(entry) {
  return entry.snapshots?.rotation?.displayTitle || entry.snapshots?.game?.title || null;
}

function playlistDescription(entries) {
  const titles = entries.map(playlistEntryTitle).filter(Boolean);
  if (!titles.length) return 'La playlist è pubblicata. Entra su GSPlay pe’ vede’ tutto er programma.';
  const prefix = 'Stasera: ';
  const suffix = '.';
  const selected = [];
  for (const title of titles) {
    const remaining = titles.length - selected.length - 1;
    const candidate = [...selected, title].join(' • ');
    const remainder = remaining > 0 ? ` • + altri ${remaining}` : '';
    if (`${prefix}${candidate}${remainder}${suffix}`.length > DESCRIPTION_LIMIT) break;
    selected.push(title);
  }
  if (!selected.length) {
    return `Playlist pubblicata: ${titles.length} ${titles.length === 1 ? 'gioco' : 'giochi'} in programma. Entra su GSPlay pe’ vede’ tutto.`;
  }
  const remaining = titles.length - selected.length;
  return `${prefix}${selected.join(' • ')}${remaining ? ` • + altri ${remaining}` : ''}${suffix}`;
}

function entryArtwork(entry) {
  return publicArtwork(entry.snapshots?.rotation?.artwork || entry.snapshots?.game?.artwork);
}

async function casualFridayMetadata(now = new Date()) {
  const event = await CasualFridayEvent.findOne({ endsAt: { $gt: now } })
    .sort({ startsAt: 1 })
    .select('status startsAt endsAt votingClosesAt playlistId')
    .lean();
  if (!event) return null;
  const title = casualFridayTitle(event);
  if (event.status === 'cancelled') {
    return {
      title: `${title} — Annullato`,
      description: 'La serata è stata annullata. Stavorta niente legioni, ma se rifamo presto.',
      url: '/casual-friday'
    };
  }
  if (event.status === 'open' && event.votingClosesAt > now) {
    return {
      title: `${title} — Vota ora`,
      description: votingDescription(event),
      url: '/casual-friday'
    };
  }
  if (!['published', 'completed'].includes(event.status) || !event.playlistId) {
    return {
      title,
      description: 'Le votazioni sono chiuse e la playlist è in preparazione. Li giochi arrivano appena er Senato decide.',
      url: '/casual-friday'
    };
  }
  const playlist = await CasualFridayPlaylist.findOne({
    _id: event.playlistId,
    status: { $in: ['published', 'completed'] }
  })
    .select('_id')
    .lean();
  if (!playlist) return null;
  const entries = await CasualFridayPlaylistEntry.find({ playlistId: playlist._id })
    .sort({ position: 1 })
    .select('position snapshots')
    .lean();
  const artwork = entries.map(entryArtwork).find(Boolean);
  return {
    title,
    description: playlistDescription(entries),
    image: artwork || undefined,
    url: '/casual-friday',
    twitterCard: artwork ? 'summary_large_image' : 'summary'
  };
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
  if (CASUAL_FRIDAY_PATH.test(req.path)) return casualFridayMetadata();
  const match = req.path.match(GAME_PATH);
  if (!match) return null;
  return gameMetadata(match[1]);
}

module.exports = {
  buildGameDescription,
  casualFridayMetadata,
  gameMetadata,
  playlistDescription,
  resolveSocialMetadata
};
