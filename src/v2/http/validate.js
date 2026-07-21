const { AppError } = require('./errors');

function object(value, label = 'body') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError(400, 'invalid_request', `${label} must be an object`);
  return value;
}

function string(value, field, { min = 1, max = 512 } = {}) {
  if (typeof value !== 'string') throw new AppError(400, 'invalid_request', `${field} must be a string`);
  const result = value.trim();
  if (result.length < min || result.length > max) throw new AppError(400, 'invalid_request', `${field} must contain between ${min} and ${max} characters`);
  return result;
}

function exactKeys(value, permitted) {
  const unknown = Object.keys(value).filter((key) => !permitted.includes(key));
  if (unknown.length) throw new AppError(400, 'invalid_request', 'Request contains unsupported fields', { fields: unknown });
}

module.exports = { exactKeys, object, string };