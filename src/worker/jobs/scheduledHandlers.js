const { BIRTHDAY_JOB_TYPE } = require('../../core/services/birthdayService');

function createScheduledJobHandlers() {
  return {
    [BIRTHDAY_JOB_TYPE]: async () => ({ ready: true })
  };
}

module.exports = { createScheduledJobHandlers };
