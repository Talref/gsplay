const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema(
  {
    igdbId: { type: Number, required: true },
    title: { type: String, required: true },
    igdbUrl: { type: String, required: true },
    artwork: String,
    platforms: [String],
    releaseDate: Date
  },
  { _id: false }
);
const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  finalists: { type: [gameSchema], default: [] },
  winnerIgdbId: Number
});
const submissionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', required: true },
    username: { type: String, required: true },
    submittedAt: { type: Date, required: true },
    selections: [
      {
        _id: false,
        categoryId: { type: mongoose.Schema.Types.ObjectId, required: true },
        games: [gameSchema]
      }
    ]
  },
  { _id: false }
);

// An edition is the consistency boundary: accepting a final submission and checking
// the phase, deadline and previous participation happen in one atomic MongoDB write.
const schema = new mongoose.Schema(
  {
    year: { type: Number, required: true, unique: true },
    status: {
      type: String,
      enum: ['draft', 'nominations', 'review', 'voting', 'closed', 'published'],
      default: 'draft',
      required: true
    },
    version: { type: Number, default: 1, required: true },
    nominationCategories: { type: [categorySchema], default: [] },
    votingCategories: { type: [categorySchema], default: [] },
    nominationsCloseAt: Date,
    votingClosesAt: Date,
    nominations: { type: [submissionSchema], default: [], select: false },
    ballots: { type: [submissionSchema], default: [], select: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', required: true },
    publishedAt: Date
  },
  { timestamps: true, collection: 'awards_editions_v2' }
);

module.exports = mongoose.models.AwardsEditionV2 || mongoose.model('AwardsEditionV2', schema);
