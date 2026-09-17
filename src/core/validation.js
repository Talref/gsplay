const { ApplicationError } = require('./errors');

function object(value, label = 'body') {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ApplicationError('invalid', 'invalid_request', `${label} must be an object`);
  return value;
}

function exactKeys(value, permitted) {
  const unknown = Object.keys(value).filter((key) => !permitted.includes(key));
  if (unknown.length)
    throw new ApplicationError(
      'invalid',
      'invalid_request',
      'Request contains unsupported fields',
      { fields: unknown }
    );
}

module.exports = { exactKeys, object };
