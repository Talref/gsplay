const { requireAuth, requireRole } = require('../../http/auth');
const { exactKeys, object, string } = require('../../http/validate');
const service = require('../../services/casualFriday/proposalService');
const { id } = require('./validation');

function registerProposalRoutes(router, config, manage) {
  router.get('/casual-friday/proposals/:gameId', requireAuth(config), async (req, res, next) => {
    try {
      res.json({
        proposal: await service.getMemberProposal(req.user, id(req.params.gameId, 'gameId'))
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/casual-friday/proposals/:gameId', requireAuth(config), async (req, res, next) => {
    try {
      const body = object(req.body);
      exactKeys(body, []);
      res.json({
        proposal: await service.proposeGame(req.user, id(req.params.gameId, 'gameId'))
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/casual-friday/tools/proposals', ...manage, async (req, res, next) => {
    try {
      res.json({ proposals: await service.listPendingProposals() });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/casual-friday/tools/proposals/:proposalId/reject',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const body = object(req.body);
        exactKeys(body, ['adminNote']);
        await service.rejectProposal(
          req.user,
          id(req.params.proposalId, 'proposalId'),
          string(body.adminNote ?? '', 'adminNote', { min: 0, max: 1000 })
        );
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    }
  );
}

module.exports = { registerProposalRoutes };
