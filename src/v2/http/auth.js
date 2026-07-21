const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError } = require('./errors');

function durationMilliseconds(ttl, fallback) {
  const match = /^(\d+)\s*([smhd])$/.exec(ttl || '');
  return match ? Number(match[1]) * ({ s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]]) : fallback;
}
function accessCookieOptions(config) {
  return { httpOnly: true, secure: config.auth.cookieSecure, sameSite: config.auth.cookieSameSite, path: '/', maxAge: durationMilliseconds(config.auth.accessTtl, 15 * 60 * 1000) };
}
function refreshCookieOptions(config) {
  return { httpOnly: true, secure: config.auth.cookieSecure, sameSite: config.auth.cookieSameSite, path: '/api/v2/auth', maxAge: durationMilliseconds(config.auth.refreshTtl, 30 * 24 * 60 * 60 * 1000) };
}
function setSessionCookies(res, tokens, config) {
  res.cookie('gsplay_access', tokens.accessToken, accessCookieOptions(config));
  res.cookie('gsplay_refresh', tokens.refreshToken, refreshCookieOptions(config));
}
function clearSessionCookies(res, config) {
  res.clearCookie('gsplay_access', accessCookieOptions(config));
  res.clearCookie('gsplay_refresh', refreshCookieOptions(config));
}
function requireAuth(config) {
  return async (req, res, next) => {
    try {
      const token = req.cookies.gsplay_access || req.get('authorization')?.replace(/^Bearer\s+/i, '');
      if (!token) throw new AppError(401, 'authentication_required', 'Authentication is required');
      const payload = jwt.verify(token, config.auth.accessSecret);
      if (payload.type !== 'access') throw new Error('Wrong token type');
      const user = await User.findById(payload.sub);
      if (!user) throw new AppError(401, 'authentication_required', 'Authentication is required');
      req.user = user;
      next();
    } catch (error) {
      next(error instanceof AppError ? error : new AppError(401, 'authentication_required', 'Authentication is required'));
    }
  };
}
function requireRole(...roles) {
  return (req, res, next) => req.user && roles.includes(req.user.role) ? next() : next(new AppError(403, 'forbidden', 'You do not have permission to perform this action'));
}
module.exports = { clearSessionCookies, requireAuth, requireRole, setSessionCookies };