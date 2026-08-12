const CanonicalGame = require('../../models/CanonicalGame');
const Proposal = require('../../models/CasualFridayGameProposal');
const Rotation = require('../../models/CasualFridayRotationGame');
const { AppError } = require('../../http/errors');
const { audit, gameDto } = require('./common');

const visibleGame = { hiddenAt: null, archivedAt: null, mergedIntoId: null };

function memberProposalDto(proposal, actorId, inRotation = false) {
  return {
    status: inRotation ? 'approved' : proposal?.status || null,
    proposerCount: proposal?.proposedBy?.length || 0,
    proposedByMe: Boolean(
      proposal?.proposedBy?.some((proposerId) => String(proposerId) === String(actorId))
    ),
    inRotation
  };
}

async function getMemberProposal(actor, canonicalGameId) {
  const [game, proposal, inRotation] = await Promise.all([
    CanonicalGame.exists({ _id: canonicalGameId, ...visibleGame }),
    Proposal.findOne({ canonicalGameId }).lean(),
    Rotation.exists({ canonicalGameId, status: 'active' })
  ]);
  if (!game) throw new AppError(404, 'not_found', 'Catalogue game was not found');
  return memberProposalDto(proposal, actor._id, Boolean(inRotation));
}

async function proposeGame(actor, canonicalGameId) {
  const [game, inRotation] = await Promise.all([
    CanonicalGame.exists({ _id: canonicalGameId, ...visibleGame }),
    Rotation.exists({ canonicalGameId, status: 'active' })
  ]);
  if (!game) throw new AppError(404, 'not_found', 'Catalogue game was not found');
  if (inRotation)
    throw new AppError(409, 'rotation_game_exists', 'Game is already in the active rotation');

  let proposal;
  try {
    proposal = await Proposal.findOneAndUpdate(
      { canonicalGameId },
      {
        $addToSet: { proposedBy: actor._id },
        $set: {
          status: 'pending',
          reviewedBy: null,
          reviewedAt: null,
          adminNote: '',
          rotationGameId: null
        }
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
    proposal = await Proposal.findOneAndUpdate(
      { canonicalGameId },
      {
        $addToSet: { proposedBy: actor._id },
        $set: {
          status: 'pending',
          reviewedBy: null,
          reviewedAt: null,
          adminNote: '',
          rotationGameId: null
        }
      },
      { new: true, runValidators: true }
    );
  }
  await audit(actor, 'rotation_game_proposed', {
    details: { proposalId: proposal._id, canonicalGameId }
  });
  return memberProposalDto(proposal, actor._id);
}

function toolsProposalDto(proposal, game) {
  return {
    id: String(proposal._id),
    status: proposal.status,
    proposerCount: proposal.proposedBy.length,
    proposers: proposal.proposedBy
      .filter((user) => user?._id)
      .map((user) => ({ id: String(user._id), username: user.usernameDisplay })),
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt,
    game: gameDto(game)
  };
}

async function listPendingProposals() {
  const proposals = await Proposal.find({ status: 'pending' })
    .populate('proposedBy', 'usernameDisplay')
    .sort({ updatedAt: -1 });
  const games = await CanonicalGame.find({
    _id: { $in: proposals.map((proposal) => proposal.canonicalGameId) },
    ...visibleGame
  });
  const gameMap = new Map(games.map((game) => [String(game._id), game]));
  return proposals
    .filter((proposal) => gameMap.has(String(proposal.canonicalGameId)))
    .map((proposal) => toolsProposalDto(proposal, gameMap.get(String(proposal.canonicalGameId))));
}

async function approveProposal(actor, canonicalGameId, rotationGameId) {
  const proposal = await Proposal.findOneAndUpdate(
    { canonicalGameId },
    {
      $set: {
        status: 'approved',
        reviewedBy: actor._id,
        reviewedAt: new Date(),
        adminNote: '',
        rotationGameId
      }
    },
    { new: true }
  );
  if (proposal)
    await audit(actor, 'rotation_proposal_approved', {
      rotationGameId,
      details: { proposalId: proposal._id, canonicalGameId }
    });
}

async function rejectProposal(actor, proposalId, adminNote) {
  const proposal = await Proposal.findOneAndUpdate(
    { _id: proposalId, status: 'pending' },
    {
      $set: {
        status: 'rejected',
        reviewedBy: actor._id,
        reviewedAt: new Date(),
        adminNote,
        rotationGameId: null
      }
    },
    { new: true, runValidators: true }
  );
  if (!proposal) throw new AppError(404, 'not_found', 'Pending game proposal was not found');
  await audit(actor, 'rotation_proposal_rejected', {
    details: { proposalId: proposal._id, canonicalGameId: proposal.canonicalGameId, adminNote }
  });
}

module.exports = {
  approveProposal,
  getMemberProposal,
  listPendingProposals,
  proposeGame,
  rejectProposal
};
