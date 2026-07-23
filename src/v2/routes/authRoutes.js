const express = require('express');
const User = require('../models/User');
const { createSessionService } = require('../auth/sessionService');
const { clearSessionCookies, requireAuth, setSessionCookies } = require('../http/auth');
const { AppError } = require('../http/errors');
const { exactKeys, object, string } = require('../http/validate');
const { authRateLimit } = require('../http/rateLimit');

function credentials(body, signup = false) {
  object(body); exactKeys(body, ['username', 'password']);
  return { username: string(body.username, 'username', { min: 3, max: 32 }), password: string(body.password, 'password', { min: 8, max: 128 }), signup };
}
function createAuthRouter(config) {
  const router = express.Router();
  const sessions = createSessionService(config);
  const mutationLimit = authRateLimit(config);
  router.post('/signup', mutationLimit, async (req, res, next) => {
    try {
      const { username, password } = credentials(req.body, true);
      const usernameNormalized = User.normalizeUsername(username);
      if (await User.exists({ usernameNormalized })) throw new AppError(409, 'username_taken', 'That username is already in use');
      const user = await User.create({ usernameNormalized, usernameDisplay: username, passwordHash: await User.hashPassword(password) });
      setSessionCookies(res, await sessions.issue(user, req), config);
      res.status(201).json({ user: user.toPublic() });
    } catch (error) { next(error); }
  });
  router.post('/login', mutationLimit, async (req, res, next) => {
    try {
      const { username, password } = credentials(req.body);
      const user = await User.findOne({ usernameNormalized: User.normalizeUsername(username) }).select('+passwordHash');
      if (!user || !(await user.verifyPassword(password))) throw new AppError(401, 'invalid_credentials', 'Username or password is incorrect');
      setSessionCookies(res, await sessions.issue(user, req), config);
      res.json({ user: user.toPublic() });
    } catch (error) { next(error); }
  });
  router.post('/refresh', mutationLimit, async (req, res, next) => {
    try { const result = await sessions.rotate(req.cookies.gsplay_refresh, req, User); setSessionCookies(res, result, config); res.json({ user: result.user.toPublic() }); } catch (error) { clearSessionCookies(res, config); next(error); }
  });
  router.post('/logout', async (req, res, next) => { try { await sessions.revoke(req.cookies.gsplay_refresh); clearSessionCookies(res, config); res.status(204).end(); } catch (error) { next(error); } });
  router.get('/me', requireAuth(config), (req, res) => res.json({ user: req.user.toPublic() }));
  return router;
}
module.exports = { createAuthRouter };