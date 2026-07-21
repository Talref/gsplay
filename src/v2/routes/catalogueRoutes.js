const express = require('express');
const mongoose = require('mongoose');
const CanonicalGame = require('../models/CanonicalGame');
const LibraryItem = require('../models/LibraryItem');
const GameAlias = require('../models/GameAlias');
const SyncJob = require('../models/SyncJob');
const { enqueueJob } = require('../jobs/jobService');
const { requireAuth, requireRole } = require('../http/auth');
const { AppError } = require('../http/errors');

const pageOf = (value, defaultValue, max) => Math.min(Math.max(Number.parseInt(value || defaultValue, 10) || defaultValue, 1), max);
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const gameDto = (game) => ({ id: game._id.toString(), title: game.canonicalTitle, alternativeTitles: game.alternativeTitles, summary: game.summary, genres: game.genres, platforms: game.platforms, rating: game.rating, artwork: game.artwork, releaseDate: game.releaseDate, metadataStatus: game.metadata.status });

function createCatalogueRouter(config) {
  const router = express.Router();
  router.get('/community/games/top', async (req, res, next) => { try {
    const limit = pageOf(req.query.limit, 20, 20);
    const rows = await LibraryItem.aggregate([
      { $match: { removedAt: null, canonicalGameId: { $ne: null } } },
      { $group: { _id: { gameId: '$canonicalGameId', userId: '$userId' }, providers: { $addToSet: '$provider' } } },
      { $group: { _id: '$_id.gameId', owners: { $push: { userId: '$_id.userId', providers: '$providers' } }, ownerCount: { $sum: 1 } } },
      { $sort: { ownerCount: -1, _id: 1 } }, { $limit: limit },
      { $lookup: { from: 'canonical_games_v2', localField: '_id', foreignField: '_id', as: 'game' } }, { $unwind: '$game' },
      { $lookup: { from: 'users_v2', localField: 'owners.userId', foreignField: '_id', as: 'users' } }
    ]);
    res.json({ games: rows.map((row, index) => ({ id: row._id.toString(), rank: index + 1, title: row.game.canonicalTitle, artwork: row.game.artwork, ownerCount: row.ownerCount, owners: row.owners.map((owner) => ({ username: row.users.find((user) => user._id.equals(owner.userId))?.usernameDisplay || 'Unknown', providers: owner.providers })) })) });
  } catch (error) { next(error); } });
  router.get('/games', requireAuth(config), async (req, res, next) => { try { const page = pageOf(req.query.page, 1, 10000); const pageSize = pageOf(req.query.pageSize, 30, 100); const filter = {}; if (req.query.q) { const search = escapeRegex(String(req.query.q).trim()); filter.$or = [{ canonicalTitle: { $regex: search, $options: 'i' } }, { alternativeTitles: { $regex: search, $options: 'i' } }]; } if (req.query.genre) filter.genres = String(req.query.genre).trim(); const [games, total] = await Promise.all([CanonicalGame.find(filter).sort({ canonicalTitle: 1 }).skip((page - 1) * pageSize).limit(pageSize), CanonicalGame.countDocuments(filter)]); res.json({ games: games.map(gameDto), page: { number: page, size: pageSize, total } }); } catch (error) { next(error); } });
  router.get('/games/:gameId', requireAuth(config), async (req, res, next) => { try { if (!mongoose.isObjectIdOrHexString(req.params.gameId)) throw new AppError(400, 'invalid_request', 'gameId must be valid'); const game = await CanonicalGame.findById(req.params.gameId); if (!game) throw new AppError(404, 'not_found', 'Game was not found'); res.json({ game: gameDto(game) }); } catch (error) { next(error); } });
  router.get('/games/:gameId/owners', requireAuth(config), async (req, res, next) => { try { if (!mongoose.isObjectIdOrHexString(req.params.gameId)) throw new AppError(400, 'invalid_request', 'gameId must be valid'); const owners = await LibraryItem.aggregate([{ $match: { canonicalGameId: new mongoose.Types.ObjectId(req.params.gameId), removedAt: null } }, { $lookup: { from: 'users_v2', localField: 'userId', foreignField: '_id', as: 'user' } }, { $unwind: '$user' }, { $group: { _id: '$userId', username: { $first: '$user.usernameDisplay' } } }, { $sort: { username: 1 } }]); res.json({ owners: owners.map((owner) => ({ id: owner._id.toString(), username: owner.username })) }); } catch (error) { next(error); } });
  router.get('/game-filters', requireAuth(config), async (req, res, next) => { try { const [genres, platforms] = await Promise.all([CanonicalGame.distinct('genres'), CanonicalGame.distinct('platforms')]); res.json({ genres: genres.sort(), platforms: platforms.sort() }); } catch (error) { next(error); } });
  router.get('/admin/jobs', requireAuth(config), requireRole('admin'), async (req, res, next) => { try { const jobs = await SyncJob.find({}).sort({ createdAt: -1 }).limit(pageOf(req.query.limit, 50, 100)); res.json({ jobs }); } catch (error) { next(error); } });
  router.get('/admin/enrichment-status', requireAuth(config), requireRole('admin'), async (req, res, next) => { try {
    const [metadata, jobs] = await Promise.all([CanonicalGame.aggregate([{ $group: { _id: '$metadata.status', count: { $sum: 1 } } }]), SyncJob.aggregate([{ $match: { provider: 'igdb', kind: 'metadata_enrichment' } }, { $group: { _id: '$status', count: { $sum: 1 } } }])]);
    const asCounts = (rows) => Object.fromEntries(rows.map((row) => [row._id, row.count])); const metadataCounts = asCounts(metadata); const total = Object.values(metadataCounts).reduce((sum, count) => sum + count, 0);
    res.json({ metadata: { total, complete: metadataCounts.complete || 0, pending: metadataCounts.pending || 0, notFound: metadataCounts.not_found || 0, retryableError: metadataCounts.retryable_error || 0, permanentError: metadataCounts.permanent_error || 0, enrichedPercent: total ? Math.round(((metadataCounts.complete || 0) / total) * 100) : 0 }, jobs: asCounts(jobs) });
  } catch (error) { next(error); } });
  router.post('/admin/enrichment-repair', requireAuth(config), requireRole('admin'), async (req, res, next) => { try { const job = await enqueueJob({ userId: req.user._id, provider: 'igdb', kind: 'metadata_repair', payload: { requestedAt: new Date().toISOString() }, idempotencyKey: `igdb:metadata_repair:${Date.now()}` }); res.status(202).json({ job }); } catch (error) { next(error); } });
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
module.exports = { createCatalogueRouter };