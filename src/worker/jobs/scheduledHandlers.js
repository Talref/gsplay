const { BIRTHDAY_JOB_TYPE } = require('../../core/services/birthdayService');
const { TEMPORARY_TAG_EXPIRATION_JOB_TYPE } = require('../../core/services/temporaryTagService');

function createScheduledJobHandlers() {
  return {
    [BIRTHDAY_JOB_TYPE]: async () => ({ ready: true }),
    [TEMPORARY_TAG_EXPIRATION_JOB_TYPE]: async () => ({ ready: true })
  };
}

module.exports = { createScheduledJobHandlers };
