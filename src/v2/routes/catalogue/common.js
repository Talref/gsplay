const LibraryItem = require('../../models/LibraryItem');
const { AppError } = require('../../http/errors');
const { string } = require('../../http/validate');

const pageOf = (value, defaultValue, max) =>
  Math.min(Math.max(Number.parseInt(value || defaultValue, 10) || defaultValue, 1), max);
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const youtubeId = (value) =>
  /^[A-Za-z0-9_-]{6,64}$/.test(String(value || '')) ? String(value) : null;
const videoDto = (value) => {
  const id = youtubeId(value);
  return id
    ? {
        id,
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
        thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        watchUrl: `https://www.youtube.com/watch?v=${id}`
      }
    : null;
};
const gameDto = (game, ownership) => ({
  id: game._id.toString(),
  title: game.canonicalTitle,
  alternativeTitles: game.alternativeTitles,
  summary: game.summary,
  genres: game.genres,
  platforms: game.platforms,
  gameModes: game.gameModes,
  rating: game.rating,
  artwork: game.artwork,
  releaseDate: game.releaseDate,
  videos: (game.videos || []).map(videoDto).filter(Boolean),
  companies: game.companies || [],
  igdbUrl: game.igdbUrl,
  igdbId: game.igdbId,
  origin: game.origin,
  storeAvailability: game.storeAvailability,
  metadataStatus: game.metadata.status,
  hidden: Boolean(game.hiddenAt),
  ownerCount: Number(game.ownerCount || 0),
  ownership: ownership || { owned: false, manual: false, providers: [] }
});
const ownershipByGame = async (userId, gameIds) => {
  const rows = await LibraryItem.aggregate([
    { $match: { userId, canonicalGameId: { $in: gameIds }, removedAt: null } },
    { $group: { _id: '$canonicalGameId', providers: { $addToSet: '$provider' } } }
  ]);
  return new Map(
    rows.map((row) => {
      const providers = row.providers.sort();
      return [row._id.toString(), { owned: true, manual: providers.includes('manual'), providers }];
    })
  );
};
const queryValues = (value) =>
  (Array.isArray(value) ? value : value === undefined ? [] : [value])
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 20);
function igdbSlugFromUrl(value) {
  const url = new URL(string(value, 'url', { max: 2048 }));
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'www.igdb.com' ||
    !/^\/games\/([a-z0-9][a-z0-9-]{0,254})\/?$/.test(url.pathname)
  )
    throw new AppError(
      400,
      'invalid_request',
      'url must be a canonical https://www.igdb.com/games/<slug> link'
    );
  return url.pathname.split('/')[2];
}

module.exports = {
  escapeRegex,
  gameDto,
  igdbSlugFromUrl,
  ownershipByGame,
  pageOf,
  queryValues,
  videoDto
};
