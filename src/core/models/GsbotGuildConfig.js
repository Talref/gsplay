const mongoose = require('mongoose');

const gsbotGuildConfigSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true, maxlength: 20 },
    channels: {
      general: { type: String, required: true, maxlength: 20 }
    },
    roles: {
      staff: { type: String, maxlength: 20, default: null }
    }
  },
  { timestamps: true, collection: 'gsbot_guild_config' }
);

module.exports =
  mongoose.models.GsbotGuildConfig || mongoose.model('GsbotGuildConfig', gsbotGuildConfigSchema);
