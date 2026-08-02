const mongoose = require('mongoose');
const CanonicalGame = require('../../models/CanonicalGame');
const SyncJob = require('../../models/SyncJob');
const {
  archiveCanonicalGame,
  createManualGame,
  mergeCanonicalGames,
  providerIdentitiesForGame,
  reassignProviderGame
} = require('../../services/catalogueStewardship');
const { requireAuth, requireRole } = require('../../http/auth');
const { AppError } = require('../../http/errors');
const { exactKeys, object, string } = require('../../http/validate');
const {
  applyEditableMetadata,
  applyFieldLocks,
  assertStringList,
  resolveIgdbMetadata
} = require('./adminGameMetadata');
const { escapeRegex, gameDto, igdbSlugFromUrl, pageOf } = require('./common');

function registerAdminGameRoutes(router, config, igdb) {
  router.get('/admin/games', requireAuth(config), requireRole('admin'), async (req, res, next) => {
    try {
      const page = pageOf(req.query.page, 1, 10_000);
      const pageSize = pageOf(req.query.pageSize, 30, 100);
      const filter = { mergedIntoId: null, archivedAt: null };
      if (req.query.q) {
        const search = escapeRegex(String(req.query.q).trim());
        filter.$or = [
          { canonicalTitle: { $regex: search, $options: 'i' } },
          { alternativeTitles: { $regex: search, $options: 'i' } }
        ];
      }
      const [games, total] = await Promise.all([
        CanonicalGame.find(filter)
          .sort({ canonicalTitle: 1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize),
        CanonicalGame.countDocuments(filter)
      ]);
      res.json({ games: games.map(gameDto), page: { number: page, size: pageSize, total } });
    } catch (error) {
      next(error);
    }
  });
  router.post('/admin/games', requireAuth(config), requireRole('admin'), async (req, res, next) => {
    try {
      const body = object(req.body);
      exactKeys(body, [
        'title',
        'independent',
        'summary',
        'artwork',
        'genres',
        'platforms',
        'releaseDate'
      ]);
      const metadata = {
        summary: body.summary,
        artwork: body.artwork,
        genres: body.genres,
        platforms: body.platforms,
        releaseDate: body.releaseDate ? new Date(body.releaseDate) : undefined
      };
      if (metadata.genres !== undefined) assertStringList(metadata.genres, 'genres');
      if (metadata.platforms !== undefined) assertStringList(metadata.platforms, 'platforms');
      const game = await createManualGame({
        title: string(body.title, 'title'),
        independent: body.independent !== false,
        metadata,
        reviewedBy: req.user._id
      });
      res.status(201).json({ game: gameDto(game) });
    } catch (error) {
      next(error);
    }
  });
  router.post(
    '/admin/games/from-igdb-url',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const body = object(req.body);
        exactKeys(body, ['url']);
        const metadata = await igdb().getGameBySlug(igdbSlugFromUrl(body.url));
        if (!metadata) throw new AppError(404, 'not_found', 'IGDB game was not found');
        const existing = await CanonicalGame.findOne({
          igdbId: metadata.igdbId,
          mergedIntoId: null
        });
        if (existing) return res.status(200).json({ game: gameDto(existing), created: false });
        const game = await CanonicalGame.create({
          ...metadata,
          origin: 'manual_catalogue',
          storeAvailability: 'independent',
          metadata: { status: 'complete', attempts: 1, lastSyncAt: new Date() },
          metadataReviewedBy: req.user._id,
          metadataReviewedAt: new Date()
        });
        res.status(201).json({ game: gameDto(game), created: true });
      } catch (error) {
        next(error);
      }
    }
  );
  router.put(
    '/admin/games/:gameId',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        if (!mongoose.isObjectIdOrHexString(req.params.gameId))
          throw new AppError(400, 'invalid_request', 'gameId must be valid');
        const body = object(req.body);
        exactKeys(body, [
          'title',
          'summary',
          'artwork',
          'genres',
          'platforms',
          'releaseDate',
          'fieldLocks'
        ]);
        const game = await CanonicalGame.findOne({ _id: req.params.gameId, mergedIntoId: null });
        if (!game) throw new AppError(404, 'not_found', 'Game was not found');
        applyEditableMetadata(game, body);
        applyFieldLocks(game, body.fieldLocks);
        game.metadataReviewedBy = req.user._id;
        game.metadataReviewedAt = new Date();
        await game.save();
        res.json({ game: gameDto(game) });
      } catch (error) {
        next(error);
      }
    }
  );
  router.get(
    '/admin/igdb-search',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const query = string(req.query.q, 'q');
        const result = await igdb().searchTitle(query);
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );
  router.put(
    '/admin/games/:gameId/igdb',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        if (!mongoose.isObjectIdOrHexString(req.params.gameId))
          throw new AppError(400, 'invalid_request', 'gameId must be valid');
        const body = object(req.body);
        exactKeys(body, ['igdbId']);
        if (!Number.isInteger(body.igdbId) || body.igdbId < 1)
          throw new AppError(400, 'invalid_request', 'igdbId must be a positive integer');
        const game = await CanonicalGame.findOne({ _id: req.params.gameId, mergedIntoId: null });
        if (!game) throw new AppError(404, 'not_found', 'Game was not found');
        const metadata = await igdb().getGameById(body.igdbId);
        if (!metadata) throw new AppError(404, 'not_found', 'IGDB game was not found');
        const result = await resolveIgdbMetadata({ game, metadata, reviewedBy: req.user._id });
        res.json({ ...result, game: gameDto(result.game) });
      } catch (error) {
        next(error);
      }
    }
  );
  router.put(
    '/admin/games/:gameId/igdb-url',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        if (!mongoose.isObjectIdOrHexString(req.params.gameId))
          throw new AppError(400, 'invalid_request', 'gameId must be valid');
        const body = object(req.body);
        exactKeys(body, ['url']);
        const game = await CanonicalGame.findOne({ _id: req.params.gameId, mergedIntoId: null });
        if (!game) throw new AppError(404, 'not_found', 'Game was not found');
        const metadata = await igdb().getGameBySlug(igdbSlugFromUrl(body.url));
        if (!metadata) throw new AppError(404, 'not_found', 'IGDB game was not found');
        const result = await resolveIgdbMetadata({ game, metadata, reviewedBy: req.user._id });
        res.json({ ...result, game: gameDto(result.game) });
      } catch (error) {
        next(error);
      }
    }
  );
  router.put(
    '/admin/games/:gameId/manual-metadata',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        if (!mongoose.isObjectIdOrHexString(req.params.gameId))
          throw new AppError(400, 'invalid_request', 'gameId must be valid');
        const body = object(req.body);
        exactKeys(body, ['title', 'summary', 'artwork', 'genres', 'platforms', 'releaseDate']);
        const game = await CanonicalGame.findOne({
          _id: req.params.gameId,
          mergedIntoId: null,
          archivedAt: null
        });
        if (!game) throw new AppError(404, 'not_found', 'Game was not found');
        applyEditableMetadata(game, body);
        game.metadataCandidates = undefined;
        game.metadataReviewedBy = req.user._id;
        game.metadataReviewedAt = new Date();
        game.metadata = {
          status: 'complete',
          attempts: game.metadata.attempts + 1,
          lastSyncAt: new Date(),
          lastError: undefined,
          nextRetryAt: undefined
        };
        await game.save();
        res.json({ game: gameDto(game) });
      } catch (error) {
        next(error);
      }
    }
  );
  router.put(
    '/admin/games/:gameId/visibility',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        if (!mongoose.isObjectIdOrHexString(req.params.gameId))
          throw new AppError(400, 'invalid_request', 'gameId must be valid');
        const body = object(req.body);
        exactKeys(body, ['hidden']);
        if (typeof body.hidden !== 'boolean')
          throw new AppError(400, 'invalid_request', 'hidden must be a boolean');
        const game = await CanonicalGame.findOne({
          _id: req.params.gameId,
          mergedIntoId: null,
          archivedAt: null
        });
        if (!game) throw new AppError(404, 'not_found', 'Game was not found');
        game.hiddenAt = body.hidden ? new Date() : null;
        game.hiddenBy = body.hidden ? req.user._id : null;
        await game.save();
        if (body.hidden)
          await SyncJob.updateMany(
            {
              provider: 'igdb',
              kind: 'metadata_enrichment',
              'payload.canonicalGameId': game._id.toString(),
              status: { $in: ['queued', 'running'] }
            },
            {
              $set: {
                status: 'completed_with_errors',
                completedAt: new Date(),
                diagnostics: [
                  {
                    code: 'canonical_game_hidden',
                    message: 'Cancelled because the canonical game is hidden from the catalogue'
                  }
                ]
              }
            }
          );
        res.json({ game: gameDto(game) });
      } catch (error) {
        next(error);
      }
    }
  );
  router.post(
    '/admin/games/:gameId/merge',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        if (!mongoose.isObjectIdOrHexString(req.params.gameId))
          throw new AppError(400, 'invalid_request', 'gameId must be valid');
        const body = object(req.body);
        exactKeys(body, ['targetGameId', 'reason']);
        if (!mongoose.isObjectIdOrHexString(body.targetGameId))
          throw new AppError(400, 'invalid_request', 'targetGameId must be valid');
        const result = await mergeCanonicalGames({
          sourceGameId: req.params.gameId,
          targetGameId: body.targetGameId,
          mergedBy: req.user._id,
          reason:
            body.reason === undefined ? undefined : string(body.reason, 'reason', { max: 1000 })
        });
        res.json({
          sourceGameId: result.source._id.toString(),
          targetGame: gameDto(result.target),
          alreadyMerged: result.alreadyMerged
        });
      } catch (error) {
        next(error);
      }
    }
  );
  router.get(
    '/admin/games/:gameId/provider-identities',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        if (!mongoose.isObjectIdOrHexString(req.params.gameId))
          throw new AppError(400, 'invalid_request', 'gameId must be valid');
        if (
          !(await CanonicalGame.exists({
            _id: req.params.gameId,
            mergedIntoId: null,
            archivedAt: null
          }))
        )
          throw new AppError(404, 'not_found', 'Game was not found');
        res.json({
          identities: await providerIdentitiesForGame(
            new mongoose.Types.ObjectId(req.params.gameId)
          )
        });
      } catch (error) {
        next(error);
      }
    }
  );
  router.post(
    '/admin/games/:gameId/reassign-provider-game',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        if (!mongoose.isObjectIdOrHexString(req.params.gameId))
          throw new AppError(400, 'invalid_request', 'gameId must be valid');
        const body = object(req.body);
        exactKeys(body, ['provider', 'providerGameId', 'targetGameId', 'confirmation', 'reason']);
        if (!['steam', 'gog', 'epic', 'amazon'].includes(body.provider))
          throw new AppError(
            400,
            'invalid_request',
            'provider must be steam, gog, epic, or amazon'
          );
        if (!mongoose.isObjectIdOrHexString(body.targetGameId))
          throw new AppError(400, 'invalid_request', 'targetGameId must be valid');
        if (string(body.confirmation, 'confirmation') !== 'REASSIGN PROVIDER GAME')
          throw new AppError(
            400,
            'invalid_request',
            'REASSIGN PROVIDER GAME confirmation is required'
          );
        const result = await reassignProviderGame({
          sourceGameId: req.params.gameId,
          targetGameId: body.targetGameId,
          provider: body.provider,
          providerGameId: string(body.providerGameId, 'providerGameId', { max: 256 }),
          reassignedBy: req.user._id,
          reason: string(body.reason, 'reason', { max: 1000 })
        });
        res.json({
          sourceGameId: result.source._id.toString(),
          targetGame: gameDto(result.target),
          provider: body.provider,
          providerGameId: body.providerGameId,
          providerTitles: result.providerTitles,
          activeEntitlementCount: result.activeEntitlementCount,
          affectedUserCount: result.affectedUserCount,
          auditId: result.audit._id.toString()
        });
      } catch (error) {
        next(error);
      }
    }
  );
  router.delete(
    '/admin/games/:gameId',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        if (!mongoose.isObjectIdOrHexString(req.params.gameId))
          throw new AppError(400, 'invalid_request', 'gameId must be valid');
        const body = object(req.body || {});
        exactKeys(body, ['reason']);
        const game = await archiveCanonicalGame({
          gameId: req.params.gameId,
          archivedBy: req.user._id,
          reason:
            body.reason === undefined ? undefined : string(body.reason, 'reason', { max: 1000 })
        });
        res.json({ game: gameDto(game), archived: true });
      } catch (error) {
        next(error);
      }
    }
  );
}

module.exports = { registerAdminGameRoutes };
