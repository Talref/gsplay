class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function notFoundHandler(req, res, next) {
  next(new AppError(404, 'not_found', 'The requested resource was not found'));
}

function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  const isIgdbProviderError = error?.name === 'IgdbProviderError';
  const status = error instanceof AppError ? error.status : isIgdbProviderError ? 503 : 500;
  const code = error instanceof AppError ? error.code : isIgdbProviderError ? (error.authenticationFailed ? 'igdb_authentication_failed' : 'igdb_temporarily_unavailable') : 'internal_error';
  const message = isIgdbProviderError ? (error.authenticationFailed ? 'IGDB authentication is unavailable; check the provider configuration' : 'IGDB did not respond in time. Try again shortly.') : error.message;
  const body = {
    error: {
      code,
      message: status < 500 || isIgdbProviderError ? message : 'An unexpected error occurred',
      requestId: req.id
    }
  };
  if (error instanceof AppError && error.details) body.error.details = error.details;
  if (status >= 500) console.error(JSON.stringify({ level: 'error', requestId: req.id, message: error.message, stack: error.stack, errorName: error.name, errorCode: error.code, provider: error.provider, operation: error.operation, upstreamStatus: error.status, retryable: error.retryable, authenticationFailed: error.authenticationFailed }));
  if (isIgdbProviderError && error.retryable) res.set('Retry-After', '5');
  res.status(status).json(body);
}

module.exports = { AppError, errorHandler, notFoundHandler };