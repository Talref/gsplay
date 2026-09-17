const Guide = require('../models/Guide');

const GUIDE_SLUG = 'guide';

function toGuideDto(guide) {
  return {
    markdown: guide?.markdown || '',
    updatedAt: guide?.updatedAt || null
  };
}

async function getGuide() {
  return toGuideDto(await Guide.findOne({ slug: GUIDE_SLUG }).lean());
}

async function updateGuide(markdown) {
  const guide = await Guide.findOneAndUpdate(
    { slug: GUIDE_SLUG },
    { $set: { markdown }, $setOnInsert: { slug: GUIDE_SLUG } },
    { new: true, upsert: true, runValidators: true }
  ).lean();
  return toGuideDto(guide);
}

module.exports = { getGuide, updateGuide };
