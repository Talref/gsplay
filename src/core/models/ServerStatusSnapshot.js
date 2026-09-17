const mongoose = require('mongoose');

const serverStatusSchema = new mongoose.Schema(
  {
    groupId: { type: String, required: true, trim: true, maxlength: 64 },
    groupName: { type: String, required: true, trim: true, maxlength: 128 },
    managerMention: {
      type: String,
      trim: true,
      match: /^<@!?\d+>$/,
      default: null
    },
    name: { type: String, required: true, trim: true, maxlength: 128 },
    identifier: { type: String, required: true, trim: true, maxlength: 128 },
    status: {
      type: String,
      enum: ['running', 'starting', 'stopping', 'offline', 'unknown', 'idle'],
      required: true
    },
    uptimeMilliseconds: { type: Number, min: 0, default: null },
    players: { type: Number, min: 0, default: undefined },
    maxPlayers: { type: Number, min: 0, default: undefined }
  },
  { _id: false }
);

const serverStatusSnapshotSchema = new mongoose.Schema(
  {
    singletonKey: { type: String, enum: ['current'], default: 'current', unique: true },
    sourceUpdatedAt: { type: Date, required: true },
    receivedAt: { type: Date, required: true },
    servers: {
      type: [serverStatusSchema],
      required: true,
      validate: {
        validator: (servers) => servers.length >= 1 && servers.length <= 100,
        message: 'servers must contain between 1 and 100 entries'
      }
    }
  },
  { timestamps: true, collection: 'server_status_snapshots_v2' }
);

module.exports =
  mongoose.models.ServerStatusSnapshotV2 ||
  mongoose.model('ServerStatusSnapshotV2', serverStatusSnapshotSchema);
