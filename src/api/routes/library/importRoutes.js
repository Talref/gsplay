const SyncJob = require('../../../core/models/SyncJob');
const { enqueueJob } = require('../../../core/jobs/jobService');
const { requireAuth } = require('../../http/auth');
const { AppError } = require('../../http/errors');
const { exactKeys, object, string } = require('../../http/validate');
const { resolveLibraryUpload } = require('../../services/libraryUploadParser');

function registerImportRoutes(router, config, receiveUpload) {
  router.put('/me/providers/steam', requireAuth(config), async (req, res, next) => {
    try {
      object(req.body);
      exactKeys(req.body, ['steamId']);
      const steamId = string(req.body.steamId, 'steamId', { min: 17, max: 17 });
      if (!/^\d{17}$/.test(steamId))
        throw new AppError(400, 'invalid_request', 'steamId must be a 17-digit SteamID64');
      req.user.steamAccount = { steamId, linkedAt: new Date(), lastSyncedAt: undefined };
      await req.user.save();
      res.json({
        steamAccount: {
          steamId: req.user.steamAccount.steamId,
          linkedAt: req.user.steamAccount.linkedAt,
          lastSyncedAt: null
        }
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/me/imports', requireAuth(config), receiveUpload, async (req, res, next) => {
    try {
      exactKeys(req.body, ['provider']);
      const { provider, games } = resolveLibraryUpload({
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
        filename: req.file.originalname,
        provider:
          req.body.provider === undefined
            ? undefined
            : string(req.body.provider, 'provider', { max: 16 }).toLowerCase()
      });
      const job = await enqueueJob({
        userId: req.user._id,
        provider,
        kind: 'upload',
        payload: { games },
        idempotencyKey: `upload:${req.user._id}:${provider}:${Date.now()}`
      });
      res.status(202).json({
        job: { id: job._id.toString(), status: job.status, provider, gameCount: games.length }
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/me/providers/steam/sync', requireAuth(config), async (req, res, next) => {
    try {
      object(req.body);
      exactKeys(req.body, []);
      if (!req.user.steamAccount?.steamId)
        throw new AppError(409, 'steam_not_linked', 'Link a Steam account before starting a sync');
      const job = await enqueueJob({
        userId: req.user._id,
        provider: 'steam',
        kind: 'provider_sync',
        idempotencyKey: `steam:${req.user._id}:${Date.now()}`,
        payload: { steamId: req.user.steamAccount.steamId }
      });
      res.status(202).json({ job: { id: job._id.toString(), status: job.status } });
    } catch (error) {
      next(error);
    }
  });

  router.get('/me/imports/:jobId', requireAuth(config), async (req, res, next) => {
    try {
      const job = await SyncJob.findOne({ _id: req.params.jobId, userId: req.user._id });
      if (!job) throw new AppError(404, 'not_found', 'Import job was not found');
      res.json({ job });
    } catch (error) {
      next(error);
    }
  });
}

module.exports = { registerImportRoutes };
