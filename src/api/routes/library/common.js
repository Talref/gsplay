const mongoose = require('mongoose');
const { AppError } = require('../../http/errors');

const asPage = (value, fallback, max) =>
  Math.min(Math.max(Number.parseInt(value || fallback, 10) || fallback, 1), max);

const asId = (value, field) => {
  if (!mongoose.isObjectIdOrHexString(value))
    throw new AppError(400, 'invalid_request', `${field} must be a valid user ID`);
  return new mongoose.Types.ObjectId(value);
};

const libraryGameDto = (row) => ({
  id: String(row._id),
  providerTitle: row.providerTitle,
  providers: row.providers,
  entitlementCount: row.entitlementCount,
  canonicalGame: row.canonicalGame?._id
    ? {
        id: row.canonicalGame._id.toString(),
        title: row.canonicalGame.canonicalTitle,
        artwork: row.canonicalGame.artwork,
        igdbUrl: row.canonicalGame.igdbUrl
      }
    : null
});

module.exports = { asId, asPage, libraryGameDto };
