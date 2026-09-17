const mongoose = require('mongoose');
const { AppError } = require('../../http/errors');
const { exactKeys, object, string } = require('../../http/validate');

const id = (value, field) => {
  if (!mongoose.isObjectIdOrHexString(value))
    throw new AppError(400, 'invalid_request', `${field} must be valid`);
  return value;
};

const integer = (value, field) => {
  if (!Number.isInteger(value))
    throw new AppError(400, 'invalid_request', `${field} must be an integer`);
  return value;
};

function rotationBody(value, mode) {
  object(value);
  const allowed = [
    'displayTitle',
    'artworkOverride',
    'info',
    'playerCountMin',
    'playerCountMax',
    'playerCountLabel',
    'joinInstructions',
    'hostMode',
    'acquisitionKind',
    'acquisitionUrl',
    'availabilityNote'
  ];
  if (mode === 'catalogue') allowed.push('canonicalGameId');
  if (mode === 'igdb') allowed.push('igdbUrl');
  if (mode === 'manual') allowed.push('title');
  exactKeys(value, allowed);

  const result = {
    ...value,
    playerCountMin: integer(value.playerCountMin, 'playerCountMin'),
    playerCountMax: integer(value.playerCountMax, 'playerCountMax')
  };
  if (mode === 'catalogue') result.canonicalGameId = id(value.canonicalGameId, 'canonicalGameId');
  if (mode === 'igdb') {
    const url = new URL(string(value.igdbUrl, 'igdbUrl', { max: 2048 }));
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'www.igdb.com' ||
      !/^\/games\/([a-z0-9][a-z0-9-]{0,254})\/?$/.test(url.pathname)
    )
      throw new AppError(400, 'invalid_request', 'igdbUrl must be an IGDB game URL');
    result.igdbSlug = url.pathname.split('/')[2];
  }
  return result;
}

module.exports = { id, integer, rotationBody };
