const Rotation = require('../../models/CasualFridayRotationGame');
const { ItadProviderError } = require('../../providers/itadClient');

function resetItad(rotation) {
  if (['free', 'web'].includes(rotation.acquisitionKind)) {
    Object.assign(rotation, {
      itadStatus: 'not_required',
      itadCheckedAt: undefined,
      itadError: undefined,
      itadGameId: undefined,
      itadTitle: undefined,
      itadOffer: null,
      itadOfferCheckedAt: undefined,
      itadOfferError: undefined
    });
  } else {
    Object.assign(rotation, {
      itadStatus: 'pending',
      itadCheckedAt: undefined,
      itadError: undefined,
      itadGameId: undefined,
      itadTitle: undefined,
      itadOffer: null,
      itadOfferCheckedAt: undefined,
      itadOfferError: undefined
    });
  }
}

async function verifyItad(rotation, itadClient) {
  if (['free', 'web'].includes(rotation.acquisitionKind)) {
    resetItad(rotation);
    return;
  }
  try {
    const previousGameId = rotation.itadGameId;
    const found = await itadClient.lookupTitle(rotation.displayTitle);
    const matchedGameId = found.outcome === 'matched' ? found.game.id : undefined;
    Object.assign(rotation, {
      itadCheckedAt: new Date(),
      itadStatus:
        found.outcome === 'matched'
          ? 'verified'
          : found.outcome === 'ambiguous'
            ? 'ambiguous'
            : 'not_found',
      itadGameId: matchedGameId,
      itadTitle: found.outcome === 'matched' ? found.game.title : undefined,
      itadError: undefined
    });
    if (!matchedGameId || matchedGameId !== previousGameId) {
      Object.assign(rotation, {
        itadOffer: null,
        itadOfferCheckedAt: undefined,
        itadOfferError: undefined
      });
    }
  } catch (error) {
    Object.assign(rotation, {
      itadStatus: 'error',
      itadCheckedAt: new Date(),
      itadError: error instanceof ItadProviderError ? error.message : 'ITAD verification failed'
    });
  }
}

async function refreshOneRotationOffer(rotation, itadClient, now = new Date()) {
  if (rotation.itadStatus !== 'verified' || !rotation.itadGameId) return;
  try {
    const offers = await itadClient.bestOffers([rotation.itadGameId]);
    Object.assign(rotation, {
      itadOffer: offers.get(rotation.itadGameId) || null,
      itadOfferCheckedAt: now,
      itadOfferError: undefined
    });
  } catch (error) {
    rotation.itadOfferError =
      error instanceof ItadProviderError ? error.message : 'ITAD price refresh failed';
  }
}

async function refreshRotationOffers({ itadClient, now = new Date() }) {
  const rotations = await Rotation.find({
    status: 'active',
    acquisitionKind: { $nin: ['free', 'web'] },
    itadStatus: 'verified',
    itadGameId: { $exists: true, $ne: null }
  });
  if (!rotations.length) return { checked: 0, offers: 0, batches: 0 };
  let offers = 0;
  let batches = 0;
  for (let offset = 0; offset < rotations.length; offset += 200) {
    const batch = rotations.slice(offset, offset + 200);
    const ids = [...new Set(batch.map((rotation) => rotation.itadGameId))];
    try {
      const results = await itadClient.bestOffers(ids);
      const operations = batch.map((rotation) => {
        const offer = results.get(rotation.itadGameId) || null;
        if (offer) offers += 1;
        return {
          updateOne: {
            filter: { _id: rotation._id, status: 'active', itadGameId: rotation.itadGameId },
            update: {
              $set: { itadOffer: offer, itadOfferCheckedAt: now },
              $unset: { itadOfferError: 1 }
            }
          }
        };
      });
      await Rotation.bulkWrite(operations);
      batches += 1;
    } catch (error) {
      const message =
        error instanceof ItadProviderError ? error.message : 'ITAD price refresh failed';
      await Rotation.updateMany(
        { _id: { $in: batch.map((rotation) => rotation._id) } },
        { $set: { itadOfferError: message } }
      );
    }
  }
  return { checked: rotations.length, offers, batches };
}

module.exports = {
  refreshOneRotationOffer,
  refreshRotationOffers,
  resetItad,
  verifyItad
};
