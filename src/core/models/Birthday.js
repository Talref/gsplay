const mongoose = require('mongoose');

const birthdaySchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, maxlength: 20 },
    discordUserId: { type: String, required: true, maxlength: 20 },
    day: { type: Number, required: true, min: 1, max: 31 },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, default: null, min: 1, max: 9999 }
  },
  { timestamps: true, collection: 'birthdays' }
);

birthdaySchema.index({ guildId: 1, discordUserId: 1 }, { unique: true });

module.exports = mongoose.models.Birthday || mongoose.model('Birthday', birthdaySchema);
