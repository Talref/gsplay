class ApplicationError extends Error {
  constructor(category, code, message, details) {
    super(message);
    this.name = 'ApplicationError';
    this.category = category;
    this.code = code;
    this.details = details;
  }
}

module.exports = { ApplicationError };
