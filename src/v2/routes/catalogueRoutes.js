const express = require('express');
const mongoose = require('mongoose');
const CanonicalGame = require('../models/CanonicalGame');
const LibraryItem = require('../models/LibraryItem');
const GameAlias = require('../models/GameAlias');
const SyncJob = require('../models/SyncJob');
const { enqueueJob } = require('../jobs/jobService');
const { reconcileIgdbMetadata } = require('../jobs/igdbScheduler');
const { createIgdbClient } = require('../providers/igdbClient');
const { applyIgdbMetadata, archiveCanonicalGame, createManualGame, mergeCanonicalGames, resetFailedMetadata } = require('../services/catalogueStewardship');
const { requireAuth, requireRole } = require('../http/auth');
const { AppError } = require('../http/errors');
const { exactKeys, object, string } = require('../http/validate');

const pageOf = (value, defaultValue, max) => Math.min(Math.max(Number.parseInt(value || defaultValue, 10) || defaultValue, 1), max);
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const youtubeId = (value) => /^[A-Za-z0-9_-]{6,64}$/.test(String(value || '')) ? String(value) : null;
const videoDto = (value) => { const id = youtubeId(value); return id ? { id, embedUrl: `https://www.youtube-nocookie.com/embed/${id}`, thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, watchUrl: `https://www.youtube.com/watch?v=${id}` } : null; };
const gameDto = (game, ownership) => ({ id: game._id.toString(), title: game.canonicalTitle, alternativeTitles: game.alternativeTitles, summary: game.summary, genres: game.genres, platforms: game.platforms, gameModes: game.gameModes, rating: game.rating, artwork: game.artwork, releaseDate: game.releaseDate, videos: (game.videos || []).map(videoDto).filter(Boolean), companies: game.companies || [], igdbUrl: game.igdbUrl, igdbId: game.igdbId, origin: game.origin, storeAvailability: game.storeAvailability, metadataStatus: game.metadata.status, hidden: Boolean(game.hiddenAt), ownerCount: Number(game.ownerCount || 0), ownership: ownership || { owned: false, manual: false, providers: [] } });
const ownershipByGame = async (userId, gameIds) => {
  const rows = await LibraryItem.aggregate([{ $match: { userId, canonicalGameId: { $in: gameIds }, removedAt: null } }, { $group: { _id: '$canonicalGameId', providers: { $addToSet: '$provider' } } }]);
  return new Map(rows.map((row) => { const providers = row.providers.sort(); return [row._id.toString(), { owned: true, manual: providers.includes('manual'), providers }]; }));
};
const queryValues = (value) => (Array.isArray(value) ? value : value === undefined ? [] : [value]).map((item) => String(item).trim()).filter(Boolean).slice(0, 20);
function igdbSlugFromUrl(value) {
  const url = new URL(string(value, 'url', { max: 2048 }));
  if (url.protocol !== 'https:' || url.hostname !== 'www.igdb.com' || !/^\/games\/([a-z0-9][a-z0-9-]{0,254})\/?$/.test(url.pathname)) throw new AppError(400, 'invalid_request', 'url must be a canonical https://www.igdb.com/games/<slug> link');
  return url.pathname.split('/')[2];
}

function createCatalogueRouter(config, { igdbClient } = {}) {
  const router = express.Router();
  const igdb = () => igdbClient || createIgdbClient({ clientId: config.providers.igdbClientId, clientSecret: config.providers.igdbClientSecret });
  router.get('/community/games/top', async (req, res, next) => { try {
    const limit = pageOf(req.query.limit, 20, 20);
    const rows = await LibraryItem.aggregate([
      { $match: { removedAt: null, canonicalGameId: { $ne: null } } },
      { $group: { _id: { gameId: '$canonicalGameId', userId: '$userId' }, providers: { $addToSet: '$provider' } } },
      { $group: { _id: '$_id.gameId', owners: { $push: { userId: '$_id.userId', providers: '$providers' } }, ownerCount: { $sum: 1 } } },
      { $sort: { ownerCount: -1, _id: 1 } }, { $limit: limit },
      { $lookup: { from: 'canonical_games_v2', localField: '_id', foreignField: '_id', as: 'game' } }, { $unwind: '$game' }, { $match: { 'game.hiddenAt': null, 'game.archivedAt': null, 'game.mergedIntoId': null } },
      { $lookup: { from: 'users_v2', localField: 'owners.userId', foreignField: '_id', as: 'users' } }
    ]);
    res.json({ games: rows.map((row, index) => ({ id: row._id.toString(), rank: index + 1, title: row.game.canonicalTitle, artwork: row.game.artwork, ownerCount: row.ownerCount, owners: row.owners.map((owner) => ({ username: row.users.find((user) => user._id.equals(owner.userId))?.usernameDisplay || 'Unknown', providers: owner.providers })) })) });
  } catch (error) { next(error); } });
  router.get('/games', requireAuth(config), async (req, res, next) => { try {
    const page = pageOf(req.query.page, 1, 10_000); const pageSize = pageOf(req.query.pageSize, 30, 100); const sort = ['rating', 'name', 'owners'].includes(req.query.sort) ? req.query.sort : 'rating';
    const genres = queryValues(req.query.genre); const platforms = queryValues(req.query.platform); const gameModes = queryValues(req.query.gameMode);
    const filter = { mergedIntoId: null, archivedAt: null, hiddenAt: null };
    if (req.query.q?.trim()) { const search = escapeRegex(String(req.query.q).trim()); filter.$or = [{ canonicalTitle: { $regex: search, $options: 'i' } }, { alternativeTitles: { $regex: search, $options: 'i' } }]; }
    if (genres.length) filter.genres = { $in: genres }; if (platforms.length) filter.platforms = { $in: platforms }; if (gameModes.length) filter.gameModes = { $in: gameModes };
    const sortStage = sort === 'name' ? { canonicalTitle: 1, _id: 1 } : sort === 'owners' ? { ownerCount: -1, canonicalTitle: 1, _id: 1 } : { ratingMissing: 1, rating: -1, canonicalTitle: 1, _id: 1 };
    const pipeline = [{ $match: filter }, { $lookup: { from: 'library_items_v2', let: { gameId: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$canonicalGameId', '$$gameId'] }, { $eq: [{ $ifNull: ['$removedAt', null] }, null] }] } } }, { $group: { _id: '$userId' } }], as: 'owners' } }, { $set: { ownerCount: { $size: '$owners' }, ratingMissing: { $cond: [{ $eq: ['$rating', null] }, 1, 0] } } }, { $sort: sortStage }, { $skip: (page - 1) * pageSize }, { $limit: pageSize }];
    const [games, total] = await Promise.all([CanonicalGame.aggregate(pipeline), CanonicalGame.countDocuments(filter)]);
    const ownership = await ownershipByGame(req.user._id, games.map((game) => game._id));
    res.json({ games: games.map((game) => gameDto(game, ownership.get(game._id.toString()))), page: { number: page, size: pageSize, total }, filters: { genres, platforms, gameModes }, sort });
  } catch (error) { next(error); } });
  router.get('/games/:gameId', requireAuth(config), async (req, res, next) => { try { if (!mongoose.isObjectIdOrHexString(req.params.gameId)) throw new AppError(400, 'invalid_request', 'gameId must be valid'); const [game] = await CanonicalGame.aggregate([{ $match: { _id: new mongoose.Types.ObjectId(req.params.gameId), hiddenAt: null, archivedAt: null, mergedIntoId: null } }, { $lookup: { from: 'library_items_v2', let: { gameId: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$canonicalGameId', '$$gameId'] }, { $eq: [{ $ifNull: ['$removedAt', null] }, null] }] } } }, { $group: { _id: '$userId' } }], as: 'owners' } }, { $set: { ownerCount: { $size: '$owners' } } }]); if (!game) throw new AppError(404, 'not_found', 'Game was not found'); const ownership = await ownershipByGame(req.user._id, [game._id]); res.json({ game: gameDto(game, ownership.get(game._id.toString())) }); } catch (error) { next(error); } });
  router.get('/games/:gameId/owners', requireAuth(config), async (req, res, next) => { try { if (!mongoose.isObjectIdOrHexString(req.params.gameId)) throw new AppError(400, 'invalid_request', 'gameId must be valid'); if (!await CanonicalGame.exists({ _id: req.params.gameId, hiddenAt: null, archivedAt: null, mergedIntoId: null })) throw new AppError(404, 'not_found', 'Game was not found'); const owners = await LibraryItem.aggregate([{ $match: { canonicalGameId: new mongoose.Types.ObjectId(req.params.gameId), removedAt: null } }, { $lookup: { from: 'users_v2', localField: 'userId', foreignField: '_id', as: 'user' } }, { $unwind: '$user' }, { $group: { _id: '$userId', username: { $first: '$user.usernameDisplay' }, providers: { $addToSet: '$provider' } } }, { $sort: { username: 1 } }]); res.json({ owners: owners.map((owner) => ({ id: owner._id.toString(), username: owner.username, providers: owner.providers.sort() })) }); } catch (error) { next(error); } });
  router.get('/game-filters', requireAuth(config), async (req, res, next) => { try { const visible = { hiddenAt: null, archivedAt: null, mergedIntoId: null }; const [genres, platforms, gameModes] = await Promise.all([CanonicalGame.distinct('genres', visible), CanonicalGame.distinct('platforms', visible), CanonicalGame.distinct('gameModes', visible)]); res.json({ genres: genres.sort(), platforms: platforms.sort(), gameModes: gameModes.sort() }); } catch (error) { next(error); } });
  router.get('/admin/jobs', requireAuth(config), requireRole('admin'), async (req, res, next) => { try { const jobs = await SyncJob.find({}).sort({ createdAt: -1 }).limit(pageOf(req.query.limit, 50, 100)); res.json({ jobs }); } catch (error) { next(error); } });
  router.get('/admin/enrichment-status', requireAuth(config), requireRole('admin'), async (req, res, next) => { try {
    const [metadata, jobs] = await Promise.all([CanonicalGame.aggregate([{ $match: { hiddenAt: null, archivedAt: null, mergedIntoId: null } }, { $group: { _id: '$metadata.status', count: { $sum: 1 } } }]), SyncJob.aggregate([{ $match: { provider: 'igdb', kind: 'metadata_enrichment' } }, { $group: { _id: '$status', count: { $sum: 1 } } }])]);
    const asCounts = (rows) => Object.fromEntries(rows.map((row) => [row._id, row.count])); const metadataCounts = asCounts(metadata); const total = Object.values(metadataCounts).reduce((sum, count) => sum + count, 0);
    res.json({ metadata: { total, complete: metadataCounts.complete || 0, pending: metadataCounts.pending || 0, failed: metadataCounts.failed || 0, enrichedPercent: total ? Math.round(((metadataCounts.complete || 0) / total) * 100) : 0 }, jobs: asCounts(jobs), scheduler: { minIntervalMs: config.igdb.minIntervalMs, queueLimit: config.igdb.queueLimit, maintenanceMs: config.igdb.maintenanceMs } });
  } catch (error) { next(error); } });
  router.post('/admin/enrichment-repair', requireAuth(config), requireRole('admin'), async (req, res, next) => { try { const job = await enqueueJob({ userId: req.user._id, provider: 'igdb', kind: 'metadata_repair', payload: { requestedAt: new Date().toISOString() }, idempotencyKey: `igdb:metadata_repair:${Date.now()}` }); res.status(202).json({ job }); } catch (error) { next(error); } });
  router.post('/admin/enrichment-refresh-all', requireAuth(config), requireRole('admin'), async (req, res, next) => { try {
    const body = object(req.body); exactKeys(body, ['confirmation']);
    if (body.confirmation !== 'REFRESH ALL IGDB METADATA') throw new AppError(400, 'invalid_request', 'REFRESH ALL IGDB METADATA confirmation is required');
    const active = await SyncJob.findOne({ provider: 'igdb', kind: 'metadata_repair', 'payload.mode': 'refresh_all', status: { $in: ['queued', 'running'] } }).select('+payload');
    if (active) return res.status(202).json({ job: active, coalesced: true });
    const job = await enqueueJob({ userId: req.user._id, provider: 'igdb', kind: 'metadata_repair', payload: { mode: 'refresh_all', requestedAt: new Date().toISOString() }, idempotencyKey: `igdb:catalogue_refresh:${Date.now()}` });
    res.status(202).json({ job, coalesced: false });
  } catch (error) { next(error); } });
  router.post('/admin/enrichment-reset', requireAuth(config), requireRole('admin'), async (req, res, next) => { try {
    const body = object(req.body); exactKeys(body, ['confirmation']);
    if (body.confirmation !== 'RESET IGDB') throw new AppError(400, 'invalid_request', 'RESET IGDB confirmation is required');
    const report = await resetFailedMetadata();
    const scheduler = await reconcileIgdbMetadata({ config, userId: req.user._id, log: console });
    res.json({ ...report, queued: scheduler.queued });
  } catch (error) { next(error); } });
  router.get('/admin/metadata-reviews', requireAuth(config), requireRole('admin'), async (req, res, next) => { try {
    const page = pageOf(req.query.page, 1, 10_000); const pageSize = pageOf(req.query.pageSize, 30, 100);
    const filter = { 'metadata.status': 'failed', hiddenAt: null, archivedAt: null, mergedIntoId: null };
    const [games, total] = await Promise.all([CanonicalGame.find(filter).sort({ 'metadata.lastSyncAt': 1, updatedAt: 1 }).skip((page - 1) * pageSize).limit(pageSize), CanonicalGame.countDocuments(filter)]);
    res.json({ reviews: games.map((game) => ({ game: gameDto(game), candidates: (game.metadataCandidates || []).slice(0, 3), error: game.metadata.lastError || 'No verified IGDB match' })), page: { number: page, size: pageSize, total } });
  } catch (error) { next(error); } });
  router.get('/admin/games', requireAuth(config), requireRole('admin'), async (req, res, next) => { try { const page = pageOf(req.query.page, 1, 10_000); const pageSize = pageOf(req.query.pageSize, 30, 100); const filter = { mergedIntoId: null, archivedAt: null }; if (req.query.q) { const search = escapeRegex(String(req.query.q).trim()); filter.$or = [{ canonicalTitle: { $regex: search, $options: 'i' } }, { alternativeTitles: { $regex: search, $options: 'i' } }]; } const [games, total] = await Promise.all([CanonicalGame.find(filter).sort({ canonicalTitle: 1 }).skip((page - 1) * pageSize).limit(pageSize), CanonicalGame.countDocuments(filter)]); res.json({ games: games.map(gameDto), page: { number: page, size: pageSize, total } }); } catch (error) { next(error); } });
  router.post('/admin/games', requireAuth(config), requireRole('admin'), async (req, res, next) => { try {
    const body = object(req.body); exactKeys(body, ['title', 'independent', 'summary', 'artwork', 'genres', 'platforms', 'releaseDate']);
    const metadata = { summary: body.summary, artwork: body.artwork, genres: body.genres, platforms: body.platforms, releaseDate: body.releaseDate ? new Date(body.releaseDate) : undefined };
    if (metadata.genres !== undefined && (!Array.isArray(metadata.genres) || metadata.genres.some((value) => typeof value !== 'string'))) throw new AppError(400, 'invalid_request', 'genres must be a string array');
    if (metadata.platforms !== undefined && (!Array.isArray(metadata.platforms) || metadata.platforms.some((value) => typeof value !== 'string'))) throw new AppError(400, 'invalid_request', 'platforms must be a string array');
    const game = await createManualGame({ title: string(body.title, 'title'), independent: body.independent !== false, metadata, reviewedBy: req.user._id });
    res.status(201).json({ game: gameDto(game) });
  } catch (error) { next(error); } });
  router.post('/admin/games/from-igdb-url', requireAuth(config), requireRole('admin'), async (req, res, next) => { try {
    const body = object(req.body); exactKeys(body, ['url']); const metadata = await igdb().getGameBySlug(igdbSlugFromUrl(body.url)); if (!metadata) throw new AppError(404, 'not_found', 'IGDB game was not found');
    const existing = await CanonicalGame.findOne({ igdbId: metadata.igdbId, mergedIntoId: null }); if (existing) return res.status(200).json({ game: gameDto(existing), created: false });
    const game = await CanonicalGame.create({ ...metadata, origin: 'manual_catalogue', storeAvailability: 'independent', metadata: { status: 'complete', attempts: 1, lastSyncAt: new Date() }, metadataReviewedBy: req.user._id, metadataReviewedAt: new Date() });
    res.status(201).json({ game: gameDto(game), created: true });
  } catch (error) { next(error); } });
  router.put('/admin/games/:gameId', requireAuth(config), requireRole('admin'), async (req, res, next) => { try {
    if (!mongoose.isObjectIdOrHexString(req.params.gameId)) throw new AppError(400, 'invalid_request', 'gameId must be valid');
    const body = object(req.body); exactKeys(body, ['title', 'summary', 'artwork', 'genres', 'platforms', 'releaseDate', 'fieldLocks']);
    const game = await CanonicalGame.findOne({ _id: req.params.gameId, mergedIntoId: null }); if (!game) throw new AppError(404, 'not_found', 'Game was not found');
    if (body.title !== undefined) { game.canonicalTitle = string(body.title, 'title'); game.normalizedTitle = require('../services/titleNormalization').normalizeTitle(game.canonicalTitle); }
    if (body.summary !== undefined) game.summary = string(body.summary, 'summary', { min: 0, max: 10000 });
    if (body.artwork !== undefined) game.artwork = body.artwork === null ? undefined : string(body.artwork, 'artwork', { max: 2048 });
    if (body.genres !== undefined) { if (!Array.isArray(body.genres) || body.genres.some((value) => typeof value !== 'string')) throw new AppError(400, 'invalid_request', 'genres must be a string array'); game.genres = body.genres.map((value) => value.trim()).filter(Boolean).slice(0, 50); }
    if (body.platforms !== undefined) { if (!Array.isArray(body.platforms) || body.platforms.some((value) => typeof value !== 'string')) throw new AppError(400, 'invalid_request', 'platforms must be a string array'); game.platforms = body.platforms.map((value) => value.trim()).filter(Boolean).slice(0, 50); }
    if (body.releaseDate !== undefined) { if (body.releaseDate === null) game.releaseDate = undefined; else { const date = new Date(body.releaseDate); if (Number.isNaN(date.getTime())) throw new AppError(400, 'invalid_request', 'releaseDate must be a valid date'); game.releaseDate = date; } }
    if (body.fieldLocks !== undefined) { if (!Array.isArray(body.fieldLocks) || body.fieldLocks.some((field) => !['canonicalTitle', 'summary', 'artwork', 'genres', 'platforms', 'releaseDate'].includes(field))) throw new AppError(400, 'invalid_request', 'fieldLocks contains an unsupported field'); game.fieldLocks = [...new Set(body.fieldLocks)]; }
    game.metadataReviewedBy = req.user._id; game.metadataReviewedAt = new Date(); await game.save(); res.json({ game: gameDto(game) });
  } catch (error) { next(error); } });
  router.get('/admin/igdb-search', requireAuth(config), requireRole('admin'), async (req, res, next) => { try {
    const query = string(req.query.q, 'q'); const result = await igdb().searchTitle(query); res.json(result);
  } catch (error) { next(error); } });
  router.put('/admin/games/:gameId/igdb', requireAuth(config), requireRole('admin'), async (req, res, next) => { try {
    if (!mongoose.isObjectIdOrHexString(req.params.gameId)) throw new AppError(400, 'invalid_request', 'gameId must be valid');
    const body = object(req.body); exactKeys(body, ['igdbId']); if (!Number.isInteger(body.igdbId) || body.igdbId < 1) throw new AppError(400, 'invalid_request', 'igdbId must be a positive integer');
    const game = await CanonicalGame.findOne({ _id: req.params.gameId, mergedIntoId: null }); if (!game) throw new AppError(404, 'not_found', 'Game was not found');
    const metadata = await igdb().getGameById(body.igdbId); if (!metadata) throw new AppError(404, 'not_found', 'IGDB game was not found');
    const applied = await applyIgdbMetadata({ game, metadata, reviewedBy: req.user._id });
    if (applied.duplicate) return res.status(409).json({ error: { code: 'igdb_duplicate', message: 'That IGDB game belongs to another canonical entry', details: { gameId: applied.duplicate._id.toString(), title: applied.duplicate.canonicalTitle } } });
    res.json({ game: gameDto(applied.game) });
  } catch (error) { next(error); } });
  router.put('/admin/games/:gameId/igdb-url', requireAuth(config), requireRole('admin'), async (req, res, next) => { try {
    if (!mongoose.isObjectIdOrHexString(req.params.gameId)) throw new AppError(400, 'invalid_request', 'gameId must be valid');
    const body = object(req.body); exactKeys(body, ['url']); const game = await CanonicalGame.findOne({ _id: req.params.gameId, mergedIntoId: null }); if (!game) throw new AppError(404, 'not_found', 'Game was not found');
    const metadata = await igdb().getGameBySlug(igdbSlugFromUrl(body.url)); if (!metadata) throw new AppError(404, 'not_found', 'IGDB game was not found');
    const applied = await applyIgdbMetadata({ game, metadata, reviewedBy: req.user._id });
    if (applied.duplicate) return res.status(409).json({ error: { code: 'igdb_duplicate', message: 'That IGDB game belongs to another canonical entry', details: { gameId: applied.duplicate._id.toString(), title: applied.duplicate.canonicalTitle } } });
    res.json({ game: gameDto(applied.game) });
  } catch (error) { next(error); } });
  router.put('/admin/games/:gameId/manual-metadata', requireAuth(config), requireRole('admin'), async (req, res, next) => { try {
    if (!mongoose.isObjectIdOrHexString(req.params.gameId)) throw new AppError(400, 'invalid_request', 'gameId must be valid');
    const body = object(req.body); exactKeys(body, ['title', 'summary', 'artwork', 'genres', 'platforms', 'releaseDate']);
    const game = await CanonicalGame.findOne({ _id: req.params.gameId, mergedIntoId: null, archivedAt: null }); if (!game) throw new AppError(404, 'not_found', 'Game was not found');
    if (body.title !== undefined) { game.canonicalTitle = string(body.title, 'title'); game.normalizedTitle = require('../services/titleNormalization').normalizeTitle(game.canonicalTitle); }
    if (body.summary !== undefined) game.summary = string(body.summary, 'summary', { min: 0, max: 10000 });
    if (body.artwork !== undefined) game.artwork = body.artwork === null ? undefined : string(body.artwork, 'artwork', { max: 2048 });
    if (body.genres !== undefined) { if (!Array.isArray(body.genres) || body.genres.some((value) => typeof value !== 'string')) throw new AppError(400, 'invalid_request', 'genres must be a string array'); game.genres = body.genres.map((value) => value.trim()).filter(Boolean).slice(0, 50); }
    if (body.platforms !== undefined) { if (!Array.isArray(body.platforms) || body.platforms.some((value) => typeof value !== 'string')) throw new AppError(400, 'invalid_request', 'platforms must be a string array'); game.platforms = body.platforms.map((value) => value.trim()).filter(Boolean).slice(0, 50); }
    if (body.releaseDate !== undefined) { if (body.releaseDate === null) game.releaseDate = undefined; else { const date = new Date(body.releaseDate); if (Number.isNaN(date.getTime())) throw new AppError(400, 'invalid_request', 'releaseDate must be a valid date'); game.releaseDate = date; } }
    game.metadataCandidates = undefined; game.metadataReviewedBy = req.user._id; game.metadataReviewedAt = new Date(); game.metadata = { status: 'complete', attempts: game.metadata.attempts + 1, lastSyncAt: new Date(), lastError: undefined, nextRetryAt: undefined }; await game.save();
    res.json({ game: gameDto(game) });
  } catch (error) { next(error); } });
  router.put('/admin/games/:gameId/visibility', requireAuth(config), requireRole('admin'), async (req, res, next) => { try {
    if (!mongoose.isObjectIdOrHexString(req.params.gameId)) throw new AppError(400, 'invalid_request', 'gameId must be valid'); const body = object(req.body); exactKeys(body, ['hidden']);
    if (typeof body.hidden !== 'boolean') throw new AppError(400, 'invalid_request', 'hidden must be a boolean');
    const game = await CanonicalGame.findOne({ _id: req.params.gameId, mergedIntoId: null, archivedAt: null }); if (!game) throw new AppError(404, 'not_found', 'Game was not found');
    game.hiddenAt = body.hidden ? new Date() : null; game.hiddenBy = body.hidden ? req.user._id : null; await game.save();
    if (body.hidden) await SyncJob.updateMany({ provider: 'igdb', kind: 'metadata_enrichment', 'payload.canonicalGameId': game._id.toString(), status: { $in: ['queued', 'running'] } }, { $set: { status: 'completed_with_errors', completedAt: new Date(), diagnostics: [{ code: 'canonical_game_hidden', message: 'Cancelled because the canonical game is hidden from the catalogue' }] } });
    res.json({ game: gameDto(game) });
  } catch (error) { next(error); } });
  router.post('/admin/games/:gameId/merge', requireAuth(config), requireRole('admin'), async (req, res, next) => { try {
    if (!mongoose.isObjectIdOrHexString(req.params.gameId)) throw new AppError(400, 'invalid_request', 'gameId must be valid'); const body = object(req.body); exactKeys(body, ['targetGameId', 'reason']);
    if (!mongoose.isObjectIdOrHexString(body.targetGameId)) throw new AppError(400, 'invalid_request', 'targetGameId must be valid');
    const result = await mergeCanonicalGames({ sourceGameId: req.params.gameId, targetGameId: body.targetGameId, mergedBy: req.user._id, reason: body.reason === undefined ? undefined : string(body.reason, 'reason', { max: 1000 }) });
    res.json({ sourceGameId: result.source._id.toString(), targetGame: gameDto(result.target), alreadyMerged: result.alreadyMerged });
  } catch (error) { next(error); } });
  router.delete('/admin/games/:gameId', requireAuth(config), requireRole('admin'), async (req, res, next) => { try {
    if (!mongoose.isObjectIdOrHexString(req.params.gameId)) throw new AppError(400, 'invalid_request', 'gameId must be valid'); const body = object(req.body || {}); exactKeys(body, ['reason']);
    const game = await archiveCanonicalGame({ gameId: req.params.gameId, archivedBy: req.user._id, reason: body.reason === undefined ? undefined : string(body.reason, 'reason', { max: 1000 }) }); res.json({ game: gameDto(game), archived: true });
  } catch (error) { next(error); } });
  router.get('/admin/matches/review', requireAuth(config), requireRole('admin'), async (req, res, next) => { try { const items = await LibraryItem.find({ matchStatus: 'ambiguous', removedAt: null }).populate('userId', 'usernameDisplay').limit(pageOf(req.query.limit, 50, 100)); res.json({ matches: items.map((item) => ({ id: item._id.toString(), provider: item.provider, providerTitle: item.providerTitle, user: { id: item.userId._id.toString(), username: item.userId.usernameDisplay } })) }); } catch (error) { next(error); } });
  router.post('/admin/games/:gameId/metadata-refresh', requireAuth(config), requireRole('admin'), async (req, res, next) => { try {
    if (!mongoose.isObjectIdOrHexString(req.params.gameId)) throw new AppError(400, 'invalid_request', 'gameId must be valid');
    const game = await CanonicalGame.findById(req.params.gameId).select('_id');
    if (!game) throw new AppError(404, 'not_found', 'Game was not found');
    const existing = await SyncJob.findOne({ provider: 'igdb', kind: 'metadata_enrichment', 'payload.canonicalGameId': game._id.toString(), status: { $in: ['queued', 'running'] } }).select('+payload');
    if (existing) return res.status(202).json({ job: existing, coalesced: true });
    const job = await enqueueJob({ userId: req.user._id, provider: 'igdb', kind: 'metadata_enrichment', payload: { canonicalGameId: game._id.toString(), requestedBy: req.user._id.toString(), requestedAt: new Date().toISOString() }, idempotencyKey: `igdb:metadata_enrichment:${game._id}:${Date.now()}` });
    res.status(202).json({ job, coalesced: false });
  } catch (error) { next(error); } });
  router.put('/admin/matches/:id', requireAuth(config), requireRole('admin'), async (req, res, next) => { try { const { canonicalGameId } = req.body || {}; if (!mongoose.isObjectIdOrHexString(req.params.id) || !mongoose.isObjectIdOrHexString(canonicalGameId)) throw new AppError(400, 'invalid_request', 'A valid match and canonical game ID are required'); if (!await CanonicalGame.exists({ _id: canonicalGameId })) throw new AppError(404, 'not_found', 'Canonical game was not found'); const item = await LibraryItem.findOneAndUpdate({ _id: req.params.id, matchStatus: 'ambiguous' }, { $set: { canonicalGameId, matchStatus: 'manually_matched', matchConfidence: 1, matchMethod: 'admin_review' } }, { new: true }); if (!item) throw new AppError(404, 'not_found', 'Ambiguous match was not found'); await GameAlias.updateOne({ provider: item.provider, providerGameId: item.providerGameId }, { $set: { normalizedProviderTitle: item.normalizedTitle, canonicalGameId, matchType: 'manual', confidence: 1, reviewedBy: req.user._id, reviewedAt: new Date() } }, { upsert: true }); res.json({ match: { id: item._id.toString(), matchStatus: item.matchStatus } }); } catch (error) { next(error); } });
  return router;
}
module.exports = { createCatalogueRouter, videoDto };