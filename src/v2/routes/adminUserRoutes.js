const express = require('express');
const mongoose = require('mongoose');
const { requireAuth, requireRole } = require('../http/auth');
const { AppError } = require('../http/errors');
const { exactKeys, object, string } = require('../http/validate');
const { deleteUser, searchUsers, updateUserRole } = require('../services/adminUserService');

function createAdminUserRouter(config) {
  const router = express.Router();
  router.get('/admin/users', requireAuth(config), requireRole('admin'), async (req, res, next) => {
    try {
      const query = string(req.query.q, 'q', { min: 3, max: 32 });
      res.json({ users: await searchUsers(query) });
    } catch (error) {
      next(error);
    }
  });
  router.put(
    '/admin/users/:userId/role',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        if (!mongoose.isObjectIdOrHexString(req.params.userId))
          throw new AppError(400, 'invalid_request', 'userId must be valid');
        const body = object(req.body);
        exactKeys(body, ['role']);
        if (!['member', 'helper'].includes(body.role))
          throw new AppError(400, 'invalid_request', 'role must be member or helper');
        res.json({
          user: await updateUserRole({
            actor: req.user,
            subjectId: req.params.userId,
            role: body.role
          })
        });
      } catch (error) {
        next(error);
      }
    }
  );
  router.delete(
    '/admin/users/:userId',
    requireAuth(config),
    requireRole('admin'),
    async (req, res, next) => {
      try {
        if (!mongoose.isObjectIdOrHexString(req.params.userId))
          throw new AppError(400, 'invalid_request', 'userId must be valid');
        const body = object(req.body);
        exactKeys(body, ['confirmation', 'reason']);
        res.json({
          deleted: await deleteUser({
            actor: req.user,
            subjectId: req.params.userId,
            confirmation: string(body.confirmation, 'confirmation', { max: 64 }),
            reason: string(body.reason, 'reason', { max: 1000 })
          })
        });
      } catch (error) {
        next(error);
      }
    }
  );
  return router;
}

module.exports = { createAdminUserRouter };
