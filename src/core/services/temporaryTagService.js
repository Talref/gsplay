const mongoose = require('mongoose');
const TemporaryTag = require('../models/TemporaryTag');
const TemporaryTagInvite = require('../models/TemporaryTagInvite');
const { enqueueScheduledJob } = require('../jobs/scheduledJobService');

const TEMPORARY_TAG_EXPIRATION_JOB_TYPE = 'temporary_tag_expiration';

function normalizeTagName(name) {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('it-IT');
}

function validateTemporaryTag({ name, buttonLabel, expiresAt }, now = new Date()) {
  const cleanName = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
  const cleanButtonLabel = typeof buttonLabel === 'string' ? buttonLabel.trim() : '';
  if (!cleanName || cleanName.length > 100) throw new Error('Nome del tag non valido.');
  if (!cleanButtonLabel || cleanButtonLabel.length > 80)
    throw new Error('Etichetta del bottone non valida.');
  if (expiresAt !== null && (!(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime())))
    throw new Error('Scadenza non valida.');
  if (expiresAt && expiresAt <= now) throw new Error('La scadenza deve essere nel futuro.');
  return { name: cleanName, buttonLabel: cleanButtonLabel };
}

function expirationDedupeKey(tagId) {
  return `temporary-tag-expiration:${tagId}`;
}

async function scheduleTemporaryTagExpiration(tag) {
  if (!tag.expiresAt) return null;
  return enqueueScheduledJob({
    type: TEMPORARY_TAG_EXPIRATION_JOB_TYPE,
    payload: { guildId: tag.guildId, tagId: tag.id },
    runAt: tag.expiresAt,
    dedupeKey: expirationDedupeKey(tag.id)
  });
}

async function createTemporaryTag(input, now = new Date()) {
  const { name, buttonLabel } = validateTemporaryTag(input, now);
  const normalizedName = normalizeTagName(name);
  if (
    await TemporaryTag.exists({
      guildId: input.guildId,
      normalizedName,
      status: { $ne: 'deleted' }
    })
  )
    throw new Error('Esiste già un tag attivo con questo nome.');
  let tag;
  try {
    tag = await TemporaryTag.create({
      guildId: input.guildId,
      discordRoleId: input.discordRoleId,
      name,
      normalizedName,
      buttonLabel,
      expiresAt: input.expiresAt,
      createdBy: input.createdBy
    });
    await scheduleTemporaryTagExpiration(tag);
    return tag;
  } catch (error) {
    if (tag) await TemporaryTag.deleteOne({ _id: tag._id });
    if (error?.code === 11000) throw new Error('Esiste già un tag attivo con questo nome.');
    throw error;
  }
}

function activeTemporaryTag(guildId, tagId) {
  if (!mongoose.isObjectIdOrHexString(tagId)) return null;
  return TemporaryTag.findOne({ _id: tagId, guildId, status: 'active' });
}

function deletableTemporaryTag(guildId, tagId) {
  if (!mongoose.isObjectIdOrHexString(tagId)) return null;
  return TemporaryTag.findOne({
    _id: tagId,
    guildId,
    status: { $in: ['active', 'deleting'] }
  });
}

function listActiveTemporaryTags(guildId) {
  return TemporaryTag.find({ guildId, status: 'active' }).sort({ expiresAt: 1, name: 1 });
}

async function recordTemporaryTagInvite({ tagId, guildId, channelId, messageId, createdBy }) {
  const invite = await TemporaryTagInvite.create({
    tagId,
    guildId,
    channelId,
    messageId,
    createdBy
  });
  const stillActive = await TemporaryTag.exists({ _id: tagId, guildId, status: 'active' });
  if (stillActive) return invite;
  await TemporaryTagInvite.deleteOne({ _id: invite._id });
  const error = new Error('Il tag non è più attivo.');
  error.code = 'temporary_tag_not_active';
  throw error;
}

function activeTemporaryTagInvites(tagId) {
  return TemporaryTagInvite.find({ tagId, disabledAt: null }).sort({ createdAt: 1 });
}

function countActiveTemporaryTagInvites(tagId) {
  return TemporaryTagInvite.countDocuments({ tagId, disabledAt: null });
}

function markTemporaryTagInviteDisabled(inviteId, now = new Date()) {
  return TemporaryTagInvite.updateOne(
    { _id: inviteId, disabledAt: null },
    { $set: { disabledAt: now } }
  );
}

function archiveTemporaryTag(tagId, deletedBy = null, now = new Date()) {
  return TemporaryTag.findOneAndUpdate(
    { _id: tagId, status: { $in: ['active', 'deleting'] } },
    { $set: { status: 'deleted', deletedBy, deletedAt: now } },
    { new: true }
  );
}

function beginTemporaryTagDeletion(tagId) {
  return TemporaryTag.findOneAndUpdate(
    { _id: tagId, status: 'active' },
    { $set: { status: 'deleting' } },
    { new: true }
  );
}

module.exports = {
  TEMPORARY_TAG_EXPIRATION_JOB_TYPE,
  activeTemporaryTag,
  activeTemporaryTagInvites,
  archiveTemporaryTag,
  beginTemporaryTagDeletion,
  countActiveTemporaryTagInvites,
  createTemporaryTag,
  deletableTemporaryTag,
  expirationDedupeKey,
  listActiveTemporaryTags,
  markTemporaryTagInviteDisabled,
  normalizeTagName,
  recordTemporaryTagInvite,
  scheduleTemporaryTagExpiration,
  validateTemporaryTag
};
