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

const asPage = (value, fallback, max) => Math.min(Math.max(Number.parseInt(value || fallback, 10) || fallback, 1), max);
const asId = (value, field) => { if (!mongoose.isObjectIdOrHexString(value)) throw new AppError(400, 'invalid_request', `${field} must be a valid user ID`); return new mongoose.Types.ObjectId(value); };
const itemDto = (item) => ({ id: item._id.toString(), provider: item.provider, providerGameId: item.providerGameId, providerTitle: item.providerTitle, matchStatus: item.matchStatus, matchConfidence: item.matchConfidence, canonicalGame: item.canonicalGameId ? { id: item.canonicalGameId._id.toString(), title: item.canonicalGameId.canonicalTitle, artwork: item.canonicalGameId.artwork } : null, firstSeenAt: item.firstSeenAt, lastSeenAt: item.lastSeenAt });

function createLibraryRouter(config) {
  const router = express.Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.uploadMaxBytes, files: 1, fields: 1 }, fileFilter: (req, file, callback) => callback(null, ['text/csv', 'application/csv', 'application/json', 'text/json'].includes(file.mimetype)) });
  const receiveUpload = (req, res, next) => upload.single('file')(req, res, (error) => {
    if (error) return next(new AppError(400, 'invalid_import_file', error.code === 'LIMIT_FILE_SIZE' ? 'Upload exceeds the configured size limit' : 'Upload must contain one supported file field'));
    if (!req.file) return next(new AppError(400, 'invalid_import_file', 'Upload requires one file field'));
    return next();
  });
  router.get('/users', requireAuth(config), async (req, res, next) => { try { const users = await User.find({}, 'usernameDisplay role').sort({ usernameDisplay: 1 }).lean(); res.json({ users: users.map((user) => ({ id: user._id.toString(), username: user.usernameDisplay, role: user.role })) }); } catch (error) { next(error); } });
  router.get('/me/library', requireAuth(config), async (req, res, next) => {
    try {
      const page = asPage(req.query.page, 1, 10_000); const pageSize = asPage(req.query.pageSize, 30, 100);
      const filter = { userId: req.user._id, removedAt: null }; if (req.query.provider) filter.provider = string(req.query.provider, 'provider', { max: 32 });
      const [items, total] = await Promise.all([LibraryItem.find(filter).populate('canonicalGameId', 'canonicalTitle artwork').sort({ providerTitle: 1 }).skip((page - 1) * pageSize).limit(pageSize), LibraryItem.countDocuments(filter)]);
      res.json({ items: items.map(itemDto), page: { number: page, size: pageSize, total } });
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
      const games = parseLibraryUpload(req.file.buffer, req.file.mimetype);
      const job = await enqueueJob({ userId: req.user._id, provider, kind: 'upload', payload: { games }, idempotencyKey: `upload:${req.user._id}:${provider}:${Date.now()}` });
      res.status(202).json({ job: { id: job._id.toString(), status: job.status, gameCount: games.length } });
    } catch (error) { next(error); }
  });
  router.post('/me/providers/steam/sync', requireAuth(config), async (req, res, next) => {
    try { object(req.body); exactKeys(req.body, []); if (!req.user.steamAccount?.steamId) throw new AppError(409, 'steam_not_linked', 'Link a Steam account before starting a sync'); const job = await enqueueJob({ userId: req.user._id, provider: 'steam', kind: 'provider_sync', idempotencyKey: `steam:${req.user._id}:${Date.now()}`, payload: { steamId: req.user.steamAccount.steamId } }); res.status(202).json({ job: { id: job._id.toString(), status: job.status } }); } catch (error) { next(error); }
  });
  router.get('/me/imports/:jobId', requireAuth(config), async (req, res, next) => { try { const job = await SyncJob.findOne({ _id: req.params.jobId, userId: req.user._id }); if (!job) throw new AppError(404, 'not_found', 'Import job was not found'); res.json({ job }); } catch (error) { next(error); } });
  router.post('/library-comparisons', requireAuth(config), async (req, res, next) => {
    try {
      object(req.body); exactKeys(req.body, ['userIds']); const ids = Array.isArray(req.body.userIds) ? req.body.userIds.map((id) => asId(id, 'userIds')) : [];
      const uniqueIds = [...new Map([...ids, req.user._id].map((id) => [id.toString(), id])).values()]; if (uniqueIds.length < 2 || uniqueIds.length > 10) throw new AppError(400, 'invalid_request', 'Select between two and ten users');
      const users = await User.find({ _id: { $in: uniqueIds } }, 'usernameDisplay').lean(); if (users.length !== uniqueIds.length) throw new AppError(404, 'not_found', 'One or more selected users were not found');
      const rows = await LibraryItem.aggregate([{ $match: { userId: { $in: uniqueIds }, removedAt: null, canonicalGameId: { $ne: null } } }, { $group: { _id: '$canonicalGameId', owners: { $addToSet: '$userId' } } }, { $match: { $expr: { $gt: [{ $size: '$owners' }, 1] } } }, { $lookup: { from: 'canonical_games_v2', localField: '_id', foreignField: '_id', as: 'game' } }, { $unwind: '$game' }, { $sort: { 'game.canonicalTitle': 1 } }]);
      res.json({ users: users.map((user) => ({ id: user._id.toString(), username: user.usernameDisplay })), games: rows.map((row) => ({ id: row._id.toString(), title: row.game.canonicalTitle, artwork: row.game.artwork, ownerIds: row.owners.map(String) })) });
    } catch (error) { next(error); }
  });
  return router;
}
module.exports = { createLibraryRouter };