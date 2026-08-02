const mongoose = require('mongoose');
const CanonicalGame = require('../../models/CanonicalGame');
const SyncJob = require('../../models/SyncJob');
const { enqueueJob } = require('../../jobs/jobService');
const { reconcileIgdbMetadata } = require('../../jobs/igdbScheduler');
const { resetFailedMetadata } = require('../../services/catalogueStewardship');
const { requireAuth, requireRole } = require('../../http/auth');
const { AppError } = require('../../http/errors');
const { exactKeys, object } = require('../../http/validate');
const { gameDto, pageOf } = require('./common');

function registerAdminMaintenanceRoutes(router, config) {
  router.get('/admin/jobs', requireAuth(config), requireRole('admin'), async (req, res, next) => {
    try {
      const jobs = await SyncJob.find({})
        .sort({ createdAt: -1 })
        .limit(pageOf(req.query.limit, 50, 100));
      res.json({ jobs });
    } catch (error) {
      next(error);
    }
  });
  router.get(
    '/admin/enrichment-status',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const [metadata, jobs] = await Promise.all([
          CanonicalGame.aggregate([
            { $match: { hiddenAt: null, archivedAt: null, mergedIntoId: null } },
            { $group: { _id: '$metadata.status', count: { $sum: 1 } } }
          ]),
          SyncJob.aggregate([
            { $match: { provider: 'igdb', kind: 'metadata_enrichment' } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ])
        ]);
        const asCounts = (rows) => Object.fromEntries(rows.map((row) => [row._id, row.count]));
        const metadataCounts = asCounts(metadata);
        const total = Object.values(metadataCounts).reduce((sum, count) => sum + count, 0);
        res.json({
          metadata: {
            total,
            complete: metadataCounts.complete || 0,
            pending: metadataCounts.pending || 0,
            failed: metadataCounts.failed || 0,
            enrichedPercent: total ? Math.round(((metadataCounts.complete || 0) / total) * 100) : 0
          },
          jobs: asCounts(jobs),
          scheduler: {
            minIntervalMs: config.igdb.minIntervalMs,
            queueLimit: config.igdb.queueLimit,
            maintenanceMs: config.igdb.maintenanceMs
          }
        });
      } catch (error) {
        next(error);
      }
    }
  );
  router.post(
    '/admin/enrichment-repair',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const job = await enqueueJob({
          userId: req.user._id,
          provider: 'igdb',
          kind: 'metadata_repair',
          payload: { requestedAt: new Date().toISOString() },
          idempotencyKey: `igdb:metadata_repair:${Date.now()}`
        });
        res.status(202).json({ job });
      } catch (error) {
        next(error);
      }
    }
  );
  router.post(
    '/admin/enrichment-refresh-all',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const body = object(req.body);
        exactKeys(body, ['confirmation']);
        if (body.confirmation !== 'REFRESH ALL IGDB METADATA')
          throw new AppError(
            400,
            'invalid_request',
            'REFRESH ALL IGDB METADATA confirmation is required'
          );
        const active = await SyncJob.findOne({
          provider: 'igdb',
          kind: 'metadata_repair',
          'payload.mode': 'refresh_all',
          status: { $in: ['queued', 'running'] }
        }).select('+payload');
        if (active) return res.status(202).json({ job: active, coalesced: true });
        const job = await enqueueJob({
          userId: req.user._id,
          provider: 'igdb',
          kind: 'metadata_repair',
          payload: { mode: 'refresh_all', requestedAt: new Date().toISOString() },
          idempotencyKey: `igdb:catalogue_refresh:${Date.now()}`
        });
        res.status(202).json({ job, coalesced: false });
      } catch (error) {
        next(error);
      }
    }
  );
  router.post(
    '/admin/enrichment-reset',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const body = object(req.body);
        exactKeys(body, ['confirmation']);
        if (body.confirmation !== 'RESET IGDB')
          throw new AppError(400, 'invalid_request', 'RESET IGDB confirmation is required');
        const report = await resetFailedMetadata();
        const scheduler = await reconcileIgdbMetadata({
          config,
          userId: req.user._id,
          log: console
        });
        res.json({ ...report, queued: scheduler.queued });
      } catch (error) {
        next(error);
      }
    }
  );
  router.get(
    '/admin/metadata-reviews',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const page = pageOf(req.query.page, 1, 10_000);
        const pageSize = pageOf(req.query.pageSize, 30, 100);
        const filter = {
          'metadata.status': 'failed',
          hiddenAt: null,
          archivedAt: null,
          mergedIntoId: null
        };
        const [games, total] = await Promise.all([
          CanonicalGame.find(filter)
            .sort({ 'metadata.lastSyncAt': 1, updatedAt: 1 })
            .skip((page - 1) * pageSize)
            .limit(pageSize),
          CanonicalGame.countDocuments(filter)
        ]);
        res.json({
          reviews: games.map((game) => ({
            game: gameDto(game),
            candidates: (game.metadataCandidates || []).slice(0, 3),
            error: game.metadata.lastError || 'No verified IGDB match'
          })),
          page: { number: page, size: pageSize, total }
        });
      } catch (error) {
        next(error);
      }
    }
  );
}

function registerMetadataRefreshRoute(router, config) {
  router.post(
    '/admin/games/:gameId/metadata-refresh',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        if (!mongoose.isObjectIdOrHexString(req.params.gameId))
          throw new AppError(400, 'invalid_request', 'gameId must be valid');
        const game = await CanonicalGame.findById(req.params.gameId).select('_id');
        if (!game) throw new AppError(404, 'not_found', 'Game was not found');
        const existing = await SyncJob.findOne({
          provider: 'igdb',
          kind: 'metadata_enrichment',
          'payload.canonicalGameId': game._id.toString(),
          status: { $in: ['queued', 'running'] }
        }).select('+payload');
        if (existing) return res.status(202).json({ job: existing, coalesced: true });
        const job = await enqueueJob({
          userId: req.user._id,
          provider: 'igdb',
          kind: 'metadata_enrichment',
          payload: {
            canonicalGameId: game._id.toString(),
            requestedBy: req.user._id.toString(),
            requestedAt: new Date().toISOString()
          },
          idempotencyKey: `igdb:metadata_enrichment:${game._id}:${Date.now()}`
        });
        res.status(202).json({ job, coalesced: false });
      } catch (error) {
        next(error);
      }
    }
  );
}

module.exports = { registerAdminMaintenanceRoutes, registerMetadataRefreshRoute };
