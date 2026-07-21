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
  const status = error instanceof AppError ? error.status : 500;
  const body = {
    error: {
      code: error instanceof AppError ? error.code : 'internal_error',
      message: status < 500 ? error.message : 'An unexpected error occurred',
      requestId: req.id
    }
  };
  if (error instanceof AppError && error.details) body.error.details = error.details;
  if (status >= 500) console.error(JSON.stringify({ level: 'error', requestId: req.id, message: error.message, stack: error.stack }));
  res.status(status).json(body);
}

module.exports = { AppError, errorHandler, notFoundHandler };