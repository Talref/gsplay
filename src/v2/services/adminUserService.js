const User = require('../models/User');
const LibraryItem = require('../models/LibraryItem');
const RefreshSession = require('../models/RefreshSession');
const SyncJob = require('../models/SyncJob');
const CanonicalGame = require('../models/CanonicalGame');
const GameAlias = require('../models/GameAlias');
const CanonicalGameMerge = require('../models/CanonicalGameMerge');
const CatalogueReassignment = require('../models/CatalogueReassignment');
const RetroChallenge = require('../models/RetroChallenge');
const AdminUserAction = require('../models/AdminUserAction');
const { AppError } = require('../http/errors');

const userDto = (user) => ({
  id: user._id.toString(),
  username: user.usernameDisplay,
  role: user.role,
  createdAt: user.createdAt,
  hasSteamAccount: Boolean(user.steamAccount?.steamId),
  hasRetroAchievements: Boolean(user.retroAchievements?.username)
});

function escapedRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function searchUsers(query, limit = 10) {
  const normalized = User.normalizeUsername(query);
  const users = await User.find({
    $or: [
      { usernameNormalized: { $regex: `^${escapedRegex(normalized)}`, $options: 'i' } },
      { usernameDisplay: { $regex: escapedRegex(query), $options: 'i' } }
    ]
  })
    .sort({ usernameNormalized: 1 })
    .limit(limit);
  return users.map(userDto);
}

async function updateUserRole({ actor, subjectId, role }) {
  if (String(actor._id) === String(subjectId))
    throw new AppError(
      409,
      'admin_self_mutation_forbidden',
      'You cannot change your own role here'
    );
  const subject = await User.findById(subjectId);
  if (!subject) throw new AppError(404, 'not_found', 'User was not found');
  if (subject.role === 'admin')
    throw new AppError(409, 'admin_role_protected', 'Admin accounts cannot be changed here');
  const beforeRole = subject.role;
  subject.role = role;
  await subject.save();
  await AdminUserAction.create({
    actorUserId: actor._id,
    subjectUserId: subject._id,
    subjectUsername: subject.usernameDisplay,
    kind: 'role_changed',
    beforeRole,
    afterRole: role
  });
  return userDto(subject);
}

async function hideOrphanedProviderGames(gameIds, actorId) {
  if (!gameIds.length) return [];
  const activeCounts = await LibraryItem.aggregate([
    { $match: { canonicalGameId: { $in: gameIds }, removedAt: null } },
    { $group: { _id: '$canonicalGameId', count: { $sum: 1 } } }
  ]);
  const owned = new Set(activeCounts.map((row) => String(row._id)));
  const orphanIds = gameIds.filter((id) => !owned.has(String(id)));
  if (!orphanIds.length) return [];
  const referencedIds = new Set(
    (await GameAlias.distinct('canonicalGameId', { canonicalGameId: { $in: orphanIds } })).map(
      String
    )
  );
  const games = await CanonicalGame.find({
    _id: { $in: orphanIds.filter((id) => !referencedIds.has(String(id))) },
    origin: 'provider_discovery',
    hiddenAt: null,
    archivedAt: null,
    mergedIntoId: null
  });
  await CanonicalGame.updateMany(
    { _id: { $in: games.map((game) => game._id) } },
    { $set: { hiddenAt: new Date(), hiddenBy: actorId } }
  );
  return games.map((game) => ({ id: game._id.toString(), title: game.canonicalTitle }));
}

async function deleteUser({ actor, subjectId, confirmation, reason }) {
  if (String(actor._id) === String(subjectId))
    throw new AppError(
      409,
      'admin_self_deletion_forbidden',
      'You cannot delete your own account here'
    );
  const subject = await User.findById(subjectId);
  if (!subject) throw new AppError(404, 'not_found', 'User was not found');
  if (subject.role === 'admin')
    throw new AppError(409, 'admin_deletion_protected', 'Admin accounts cannot be deleted here');
  if (confirmation !== `DELETE ${subject.usernameDisplay}`)
    throw new AppError(
      400,
      'invalid_confirmation',
      `Type DELETE ${subject.usernameDisplay} to confirm deletion`
    );
  const ownedGameIds = await LibraryItem.distinct('canonicalGameId', {
    userId: subject._id,
    canonicalGameId: { $ne: null }
  });
  const [libraryItems, sessions, jobs] = await Promise.all([
    LibraryItem.deleteMany({ userId: subject._id }),
    RefreshSession.deleteMany({ userId: subject._id }),
    SyncJob.updateMany(
      { userId: subject._id, status: { $in: ['queued', 'running'] } },
      {
        $set: {
          status: 'failed',
          completedAt: new Date(),
          diagnostics: [
            { code: 'user_deleted', message: 'Cancelled because the account was deleted' }
          ]
        }
      }
    )
  ]);
  await Promise.all([
    CanonicalGame.updateMany(
      { metadataReviewedBy: subject._id },
      { $set: { metadataReviewedBy: null } }
    ),
    CanonicalGame.updateMany({ archivedBy: subject._id }, { $set: { archivedBy: null } }),
    CanonicalGame.updateMany({ hiddenBy: subject._id }, { $set: { hiddenBy: null } }),
    GameAlias.updateMany({ reviewedBy: subject._id }, { $set: { reviewedBy: null } }),
    CanonicalGameMerge.updateMany({ mergedBy: subject._id }, { $set: { mergedBy: null } }),
    CatalogueReassignment.updateMany(
      { reassignedBy: subject._id },
      { $set: { reassignedBy: null } }
    ),
    RetroChallenge.updateMany({ activatedBy: subject._id }, { $set: { activatedBy: null } })
  ]);
  const hiddenOrphans = await hideOrphanedProviderGames(ownedGameIds, actor._id);
  await User.deleteOne({ _id: subject._id });
  await AdminUserAction.create({
    actorUserId: actor._id,
    subjectUserId: subject._id,
    subjectUsername: subject.usernameDisplay,
    kind: 'user_deleted',
    beforeRole: subject.role,
    reason,
    details: {
      deletedLibraryItems: libraryItems.deletedCount,
      revokedSessions: sessions.deletedCount,
      cancelledJobs: jobs.modifiedCount,
      hiddenOrphans
    }
  });
  return {
    username: subject.usernameDisplay,
    deletedLibraryItems: libraryItems.deletedCount,
    revokedSessions: sessions.deletedCount,
    cancelledJobs: jobs.modifiedCount,
    hiddenOrphans
  };
}

module.exports = { deleteUser, searchUsers, updateUserRole, userDto };
