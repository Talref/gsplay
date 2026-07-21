const { randomUUID } = require('node:crypto');

function requestContext(req, res, next) {
  req.id = req.get('x-request-id') || randomUUID();
  res.set('x-request-id', req.id);
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    console.info(JSON.stringify({ level: 'info', requestId: req.id, method: req.method, path: req.originalUrl, status: res.statusCode, durationMs: Math.round(durationMs) }));
  });
  next();
}

module.exports = { requestContext };