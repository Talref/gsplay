const Birthday = require('../models/Birthday');
const GsbotGuildConfig = require('../models/GsbotGuildConfig');
const ScheduledJob = require('../models/ScheduledJob');
const TemporaryTag = require('../models/TemporaryTag');
const TemporaryTagInvite = require('../models/TemporaryTagInvite');
const { BIRTHDAY_JOB_TYPE } = require('./birthdayService');
const { TEMPORARY_TAG_EXPIRATION_JOB_TYPE } = require('./temporaryTagService');

const GSBOT_SCHEDULED_JOB_TYPES = [BIRTHDAY_JOB_TYPE, TEMPORARY_TAG_EXPIRATION_JOB_TYPE];

async function resetGsbotGuildData(guildId) {
  const scheduledJobs = await ScheduledJob.deleteMany({
    type: { $in: GSBOT_SCHEDULED_JOB_TYPES },
    'payload.guildId': guildId
  });
  const temporaryTagInvites = await TemporaryTagInvite.deleteMany({ guildId });
  const temporaryTags = await TemporaryTag.deleteMany({ guildId });
  const birthdays = await Birthday.deleteMany({ guildId });
  const guildConfigurations = await GsbotGuildConfig.deleteMany({ guildId });

  return {
    birthdays: birthdays.deletedCount,
    guildConfigurations: guildConfigurations.deletedCount,
    temporaryTags: temporaryTags.deletedCount,
    temporaryTagInvites: temporaryTagInvites.deletedCount,
    scheduledJobs: scheduledJobs.deletedCount
  };
}

module.exports = { GSBOT_SCHEDULED_JOB_TYPES, resetGsbotGuildData };
