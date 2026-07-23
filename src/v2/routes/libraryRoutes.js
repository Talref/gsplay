const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const User = require('../models/User');
const LibraryItem = require('../models/LibraryItem');
const SyncJob = require('../models/SyncJob');
const { enqueueJob } = require('../jobs/jobService');
const { requireAuth } = require('../http/auth');
const { AppError } = require('../http/errors');
const { exactKeys, object, string } = require('../http/validate');
const { parseLibraryUpload } = require('../services/libraryUploadParser');
const CanonicalGame = require('../models/CanonicalGame');

const asPage = (value, fallback, max) => Math.min(Math.max(Number.parseInt(value || fallback, 10) || fallback, 1), max);
const asId = (value, field) => { if (!mongoose.isObjectIdOrHexString(value)) throw new AppError(400, 'invalid_request', `${field} must be a valid user ID`); return new mongoose.Types.ObjectId(value); };
const libraryItemDto = (item) => ({ id: item._id.toString(), provider: item.provider, providerTitle: item.providerTitle, providers: [item.provider], matchStatus: item.matchStatus, canonicalGame: item.canonicalGameId ? { id: item.canonicalGameId._id.toString(), title: item.canonicalGameId.canonicalTitle, artwork: item.canonicalGameId.artwork, igdbUrl: item.canonicalGameId.igdbUrl } : null });
const libraryGameDto = (row) => ({ id: String(row._id), providerTitle: row.providerTitle, providers: row.providers, entitlementCount: row.entitlementCount, canonicalGame: row.canonicalGame?._id ? { id: row.canonicalGame._id.toString(), title: row.canonicalGame.canonicalTitle, artwork: row.canonicalGame.artwork, igdbUrl: row.canonicalGame.igdbUrl } : null });

function createLibraryRouter(config) {
  const router = express.Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.uploadMaxBytes, files: 1, fields: 1 }, fileFilter: (req, file, callback) => callback(null, ['text/csv', 'application/csv', 'application/json', 'text/json'].includes(file.mimetype)) });
  const receiveUpload = (req, res, next) => upload.single('file')(req, res, (error) => {
    if (error) return next(new AppError(400, 'invalid_import_file', error.code === 'LIMIT_FILE_SIZE' ? 'Upload exceeds the configured size limit' : 'Upload must contain one supported file field'));
    if (!req.file) return next(new AppError(400, 'invalid_import_file', 'Upload requires one file field'));
    return next();
  });
  router.get('/users', async (req, res, next) => { try { const users = await User.find({}, 'usernameDisplay').sort({ usernameDisplay: 1 }).lean(); res.json({ users: users.map((user) => ({ id: user._id.toString(), username: user.usernameDisplay })) }); } catch (error) { next(error); } });
  router.get('/me/library', requireAuth(config), async (req, res, next) => {
    try {
      const page = asPage(req.query.page, 1, 10_000); const pageSize = asPage(req.query.pageSize, 30, 100);
      const filter = { userId: req.user._id, removedAt: null }; if (req.query.provider) filter.provider = string(req.query.provider, 'provider', { max: 32 });
      // LibraryItem remains the entitlement source of truth. This read model groups
      // only records that have already been authoritatively matched to one canonical game.
      const [result] = await LibraryItem.aggregate([
        { $match: filter },
        { $group: { _id: { $ifNull: ['$canonicalGameId', '$_id'] }, canonicalGameId: { $first: '$canonicalGameId' }, providerTitle: { $min: '$providerTitle' }, providers: { $addToSet: '$provider' }, entitlementCount: { $sum: 1 } } },
        { $lookup: { from: 'canonical_games_v2', localField: 'canonicalGameId', foreignField: '_id', as: 'canonicalGame' } },
        { $unwind: { path: '$canonicalGame', preserveNullAndEmptyArrays: true } },
        { $match: { $or: [{ canonicalGame: null }, { 'canonicalGame.hiddenAt': null, 'canonicalGame.archivedAt': null, 'canonicalGame.mergedIntoId': null }] } },
        { $addFields: { sortTitle: { $ifNull: ['$canonicalGame.canonicalTitle', '$providerTitle'] } } },
        { $sort: { sortTitle: 1, _id: 1 } },
        { $facet: { items: [{ $skip: (page - 1) * pageSize }, { $limit: pageSize }], total: [{ $count: 'value' }] } }
      ]);
      res.json({ items: result.items.map(libraryGameDto), page: { number: page, size: pageSize, total: result.total[0]?.value || 0 } });
    } catch (error) { next(error); }
  });
  router.put('/me/library/games/:gameId', requireAuth(config), async (req, res, next) => {
    try {
      if (!mongoose.isObjectIdOrHexString(req.params.gameId)) throw new AppError(400, 'invalid_request', 'gameId must be valid');
      const game = await CanonicalGame.findOne({ _id: req.params.gameId, hiddenAt: null, archivedAt: null, mergedIntoId: null });
      if (!game) throw new AppError(404, 'not_found', 'Game was not found');
      const imported = await LibraryItem.findOne({ userId: req.user._id, canonicalGameId: game._id, provider: { $ne: 'manual' }, removedAt: null });
      if (imported) return res.json({ ownership: { owned: true, manual: false, providers: [imported.provider] }, created: false });
      const manual = await LibraryItem.findOne({ userId: req.user._id, provider: 'manual', providerGameId: game._id.toString() });
      if (manual) { manual.removedAt = null; manual.lastSeenAt = new Date(); await manual.save(); return res.json({ ownership: { owned: true, manual: true, providers: ['manual'] }, created: false }); }
      await LibraryItem.create({ userId: req.user._id, provider: 'manual', providerGameId: game._id.toString(), providerTitle: game.canonicalTitle, normalizedTitle: game.normalizedTitle, canonicalGameId: game._id, matchStatus: 'manually_matched', matchConfidence: 1, matchMethod: 'user_catalogue_claim', source: 'manual' });
      res.status(201).json({ ownership: { owned: true, manual: true, providers: ['manual'] }, created: true });
    } catch (error) { next(error); }
  });
  router.delete('/me/library/games/:gameId', requireAuth(config), async (req, res, next) => {
    try {
      if (!mongoose.isObjectIdOrHexString(req.params.gameId)) throw new AppError(400, 'invalid_request', 'gameId must be valid');
      const body = object(req.body || {}); exactKeys(body, ['confirmation']);
      if (body.confirmation !== 'REMOVE FROM LIBRARY') throw new AppError(400, 'invalid_request', 'REMOVE FROM LIBRARY confirmation is required');
      const item = await LibraryItem.findOne({ userId: req.user._id, provider: 'manual', providerGameId: req.params.gameId, removedAt: null });
      if (!item) throw new AppError(409, 'manual_entitlement_not_found', 'Only games added manually can be removed here; imported ownership is managed by its provider sync');
      item.removedAt = new Date(); await item.save();
      const providers = await LibraryItem.distinct('provider', { userId: req.user._id, canonicalGameId: item.canonicalGameId, removedAt: null });
      res.json({ ownership: { owned: providers.length > 0, manual: false, providers } });
    } catch (error) { next(error); }
  });
  router.put('/me/providers/steam', requireAuth(config), async (req, res, next) => {
    try {
      object(req.body); exactKeys(req.body, ['steamId']);
      const steamId = string(req.body.steamId, 'steamId', { min: 17, max: 17 });
      if (!/^\d{17}$/.test(steamId)) throw new AppError(400, 'invalid_request', 'steamId must be a 17-digit SteamID64');
      req.user.steamAccount = { steamId, linkedAt: new Date(), lastSyncedAt: undefined };
      await req.user.save();
      res.json({ steamAccount: { steamId: req.user.steamAccount.steamId, linkedAt: req.user.steamAccount.linkedAt, lastSyncedAt: null } });
    } catch (error) { next(error); }
  });
  router.post('/me/imports', requireAuth(config), receiveUpload, async (req, res, next) => {
    try {
      exactKeys(req.body, ['provider']);
      const provider = string(req.body.provider, 'provider', { max: 16 }).toLowerCase();
      if (!['gog', 'epic', 'amazon'].includes(provider)) throw new AppError(400, 'invalid_request', 'provider must be gog, epic, or amazon');
      const games = parseLibraryUpload(req.file.buffer, req.file.mimetype, provider);
      const job = await enqueueJob({ userId: req.user._id, provider, kind: 'upload', payload: { games }, idempotencyKey: `upload:${req.user._id}:${provider}:${Date.now()}` });
      res.status(202).json({ job: { id: job._id.toString(), status: job.status, gameCount: games.length } });
    } catch (error) { next(error); }
  });
  router.post('/me/providers/steam/sync', requireAuth(config), async (req, res, next) => {
    try { object(req.body); exactKeys(req.body, []); if (!req.user.steamAccount?.steamId) throw new AppError(409, 'steam_not_linked', 'Link a Steam account before starting a sync'); const job = await enqueueJob({ userId: req.user._id, provider: 'steam', kind: 'provider_sync', idempotencyKey: `steam:${req.user._id}:${Date.now()}`, payload: { steamId: req.user.steamAccount.steamId } }); res.status(202).json({ job: { id: job._id.toString(), status: job.status } }); } catch (error) { next(error); }
  });
  router.get('/me/imports/:jobId', requireAuth(config), async (req, res, next) => { try { const job = await SyncJob.findOne({ _id: req.params.jobId, userId: req.user._id }); if (!job) throw new AppError(404, 'not_found', 'Import job was not found'); res.json({ job }); } catch (error) { next(error); } });
  router.post('/library-comparisons', async (req, res, next) => {
    try {
      object(req.body); exactKeys(req.body, ['userIds']); const ids = Array.isArray(req.body.userIds) ? req.body.userIds.map((id) => asId(id, 'userIds')) : [];
      const uniqueIds = [...new Map(ids.map((id) => [id.toString(), id])).values()]; if (uniqueIds.length !== ids.length || uniqueIds.length < 1 || uniqueIds.length > 10) throw new AppError(400, 'invalid_request', 'Select between one and ten distinct users');
      const users = await User.find({ _id: { $in: uniqueIds } }, 'usernameDisplay').lean(); if (users.length !== uniqueIds.length) throw new AppError(404, 'not_found', 'One or more selected users were not found');
      const rows = await LibraryItem.aggregate([{ $match: { userId: { $in: uniqueIds }, removedAt: null, canonicalGameId: { $ne: null } } }, { $group: { _id: '$canonicalGameId', owners: { $addToSet: '$userId' } } }, { $match: { $expr: { $eq: [{ $size: '$owners' }, uniqueIds.length] } } }, { $lookup: { from: 'canonical_games_v2', localField: '_id', foreignField: '_id', as: 'game' } }, { $unwind: '$game' }, { $match: { 'game.hiddenAt': null, 'game.archivedAt': null, 'game.mergedIntoId': null } }, { $sort: { 'game.canonicalTitle': 1 } }]);
      res.json({ users: users.map((user) => ({ id: user._id.toString(), username: user.usernameDisplay })), games: rows.map((row) => ({ id: row._id.toString(), title: row.game.canonicalTitle, artwork: row.game.artwork, igdbUrl: row.game.igdbUrl, ownerIds: row.owners.map(String) })) });
    } catch (error) { next(error); }
  });
  return router;
}
module.exports = { createLibraryRouter };