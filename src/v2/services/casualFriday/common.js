const Audit = require('../../models/CasualFridayAudit');
const { AppError } = require('../../http/errors');

const cleanDisplayTitle = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+-\s+[^\s]+\.(?:exe|app|bat|cmd|sh)$/i, '')
    .trim() || String(value || '').trim();
const https = (value, field) => {
  if (!/^https:\/\//.test(value || ''))
    throw new AppError(400, 'invalid_request', `${field} must be an HTTPS URL`);
};
const keyOfferUrl = (value) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new AppError(400, 'invalid_request', 'url must be an HTTPS URL');
  }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
    throw new AppError(
      400,
      'invalid_request',
      'url must be an HTTPS URL without embedded credentials'
    );
  }
  return url.href;
};
const keyOfferPrice = (value) => {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0.01 ||
    value > 10000 ||
    Math.abs(value - Math.round(value * 100) / 100) > 1e-9
  ) {
    throw new AppError(
      400,
      'invalid_request',
      'price must be between 0.01 and 10000 with at most two decimal places'
    );
  }
  return value;
};

async function audit(actor, kind, data) {
  await Audit.create({
    actorUserId: actor._id,
    actorUsernameSnapshot: actor.usernameDisplay,
    kind,
    ...data
  });
}

const gameDto = (game) => ({
  id: String(game._id),
  title: game.canonicalTitle,
  artwork: game.artwork,
  summary: game.summary,
  genres: game.genres || [],
  igdbUrl: game.igdbUrl
});

function itadSnapshot(rotation) {
  return {
    status: rotation.itadStatus,
    gameId: rotation.itadGameId,
    title: rotation.itadTitle,
    checkedAt: rotation.itadCheckedAt,
    error: rotation.itadError,
    offer: rotation.itadOffer || null,
    offerCheckedAt: rotation.itadOfferCheckedAt,
    offerError: rotation.itadOfferError
  };
}

const keyOfferDto = (offer) =>
  offer
    ? {
        price: offer.price,
        currency: offer.currency,
        url: offer.url,
        updatedAt: offer.updatedAt
      }
    : null;

function rotationSnapshot(rotation, game) {
  return {
    displayTitle: rotation.displayTitle,
    artwork: rotation.artworkOverride || game.artwork,
    info: rotation.info || game.summary,
    playerCountMin: rotation.playerCountMin,
    playerCountMax: rotation.playerCountMax,
    playerCountLabel: rotation.playerCountLabel,
    joinInstructions: rotation.joinInstructions,
    hostMode: rotation.hostMode,
    acquisitionKind: rotation.acquisitionKind,
    acquisitionUrl: rotation.acquisitionUrl,
    availabilityNote: rotation.availabilityNote
  };
}

module.exports = {
  audit,
  cleanDisplayTitle,
  gameDto,
  https,
  itadSnapshot,
  keyOfferDto,
  keyOfferPrice,
  keyOfferUrl,
  rotationSnapshot
};
