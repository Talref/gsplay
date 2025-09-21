// src/services/retroAchievementsCronService.js
const RetroGame = require('../models/RetroGame');
const User = require('../models/User');
const retroAchievementsService = require('./retroAchievementsService');

class RetroAchievementsCronService {
  async updateProgressForActiveGame() {
    try {
      // Find the active game
      const activeGame = await RetroGame.findOne({ isActive: true });
      if (!activeGame) {
        console.log('No active Game of the Month found');
        return;
      }

      console.log(`🔄 Updating progress for GoM: ${activeGame.gomId} (${activeGame.gameName})`);

      // Get all users with RetroAchievements linked
      const usersWithRA = await User.find({
        retroAchievementsULID: { $exists: true, $ne: null },
        retroAchievementsUsername: { $exists: true, $ne: null }
      });

      if (usersWithRA.length === 0) {
        console.log('No users with RetroAchievements linked');
        return;
      }

      let updatedCount = 0;

      for (const user of usersWithRA) {
        try {
          // Check if user is already tracked in this game
          const existingUserIndex = activeGame.users.findIndex(
            u => u.userId === user.retroAchievementsULID
          );

          // Get user's rank and score for this game
          const rankAndScore = await retroAchievementsService.getUserGameRankAndScore(
            activeGame.gameId,
            user.retroAchievementsUsername
          );

          // If user has no points, skip them
          if (!rankAndScore || rankAndScore.totalScore <= 0) {
            continue;
          }

          // Get detailed progress
          const detailedProgress = await retroAchievementsService.getGameInfoAndUserProgress(
            activeGame.gameId,
            user.retroAchievementsUsername
          );

          // Filter achievements earned this month (since GoM started)
          const gomStartDate = activeGame.createdAt;
          const newAchievements = this.filterAchievementsByDate(
            detailedProgress.achievements,
            gomStartDate
          );

          // Update achievement ownership arrays
          this.updateAchievementOwnership(activeGame, newAchievements, user.retroAchievementsULID);

          // Parse completion percentage (remove % and convert to number)
          const completionPercentage = parseFloat(detailedProgress.userCompletion.replace('%', '')) || 0;

          // Update or add user progress
          const userProgress = {
            userId: user.retroAchievementsULID,
            username: user.retroAchievementsUsername,
            completionPercentage,
            totalPoints: rankAndScore.totalScore
          };

          if (existingUserIndex >= 0) {
            // Update existing user
            activeGame.users[existingUserIndex] = userProgress;
          } else {
            // Add new user
            activeGame.users.push(userProgress);
          }

          updatedCount++;

        } catch (error) {
          console.warn(`Failed to update progress for user ${user.retroAchievementsUsername}:`, error.message);
          // Continue with other users
        }
      }

      // Save the updated game
      await activeGame.save();

      console.log(`✅ Updated progress for ${updatedCount} users in GoM ${activeGame.gomId}`);

    } catch (error) {
      console.error('❌ Failed to update progress for active game:', error);
      throw error;
    }
  }

  filterAchievementsByDate(achievements, startDate) {
    const newAchievements = {
      softcore: [],
      hardcore: []
    };

    // TEMPORARILY DISABLED DATE FILTERING FOR TESTING
    // Include ALL achievements regardless of date for testing purposes
    Object.values(achievements).forEach(achievement => {
      // Check softcore unlock
      if (achievement.dateEarned) {
        // TEMP: Always include for testing
        // const earnedDate = new Date(achievement.dateEarned);
        // if (earnedDate >= startDate) {
          newAchievements.softcore.push(achievement.id);
        // }
      }

      // Check hardcore unlock
      if (achievement.dateEarnedHardcore) {
        // TEMP: Always include for testing
        // const earnedHardcoreDate = new Date(achievement.dateEarnedHardcore);
        // if (earnedHardcoreDate >= startDate) {
          newAchievements.hardcore.push(achievement.id);
        // }
      }
    });

    return newAchievements;
  }

  updateAchievementOwnership(retroGame, newAchievements, userULID) {
    retroGame.achievements.forEach(achievement => {
      // Add to softcore owners if newly earned
      if (newAchievements.softcore.includes(achievement.achievementId)) {
        if (!achievement.softcoreOwners.includes(userULID)) {
          achievement.softcoreOwners.push(userULID);
        }
      }

      // Add to hardcore owners if newly earned
      if (newAchievements.hardcore.includes(achievement.achievementId)) {
        if (!achievement.hardcoreOwners.includes(userULID)) {
          achievement.hardcoreOwners.push(userULID);
        }
      }
    });
  }
}

module.exports = new RetroAchievementsCronService();
