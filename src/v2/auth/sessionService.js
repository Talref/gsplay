const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const RefreshSession = require('../models/RefreshSession');
const { AppError } = require('../http/errors');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function ttlToMilliseconds(ttl) {
  const match = /^(\d+)\s*([smhd])$/.exec(ttl);
  if (!match) throw new Error('JWT_REFRESH_TTL must use a number followed by s, m, h, or d');
  return Number(match[1]) * ({ s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]]);
}

function assertSecrets(config) {
  if (!config.auth.accessSecret || !config.auth.refreshSecret) throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are required to enable authentication');
}

function createSessionService(config) {
  assertSecrets(config);
  const refreshLifetimeMs = ttlToMilliseconds(config.auth.refreshTtl);

  async function issue(user, request) {
    const session = await RefreshSession.create({
      userId: user._id,
      tokenHash: crypto.randomBytes(32).toString('hex'),
      expiresAt: new Date(Date.now() + refreshLifetimeMs),
      userAgent: request.get('user-agent') || undefined,
      ipAddress: request.ip
    });
    const refreshToken = jwt.sign({ sub: user._id.toString(), sid: session._id.toString(), type: 'refresh' }, config.auth.refreshSecret, { expiresIn: config.auth.refreshTtl });
    session.tokenHash = hashToken(refreshToken);
    await session.save();
    return {
      accessToken: jwt.sign({ sub: user._id.toString(), role: user.role, type: 'access' }, config.auth.accessSecret, { expiresIn: config.auth.accessTtl }),
      refreshToken
    };
  }

  async function rotate(refreshToken, request, User) {
    let payload;
    try { payload = jwt.verify(refreshToken, config.auth.refreshSecret); } catch { throw new AppError(401, 'invalid_session', 'Your session is invalid or has expired'); }
    if (payload.type !== 'refresh' || !payload.sid || !payload.sub) throw new AppError(401, 'invalid_session', 'Your session is invalid or has expired');
    const session = await RefreshSession.findOne({ _id: payload.sid, userId: payload.sub, tokenHash: hashToken(refreshToken), revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } }).select('+tokenHash');
    if (!session) throw new AppError(401, 'invalid_session', 'Your session is invalid or has expired');
    const user = await User.findById(payload.sub);
    if (!user) throw new AppError(401, 'invalid_session', 'Your session is invalid or has expired');
    const tokens = await issue(user, request);
    const replacement = jwt.decode(tokens.refreshToken);
    session.revokedAt = new Date();
    session.replacedBySessionId = replacement.sid;
    await session.save();
    return { user, ...tokens };
  }

  async function revoke(refreshToken) {
    if (!refreshToken) return;
    await RefreshSession.updateOne({ tokenHash: hashToken(refreshToken), revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
  }
  return { issue, rotate, revoke };
}

module.exports = { createSessionService };