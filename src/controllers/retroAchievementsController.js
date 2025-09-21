// src/controllers/retroAchievementsController.js
const RetroGame = require('../models/RetroGame');
const retroAchievementsService = require('../services/retroAchievementsService');

// POST /api/admin/set-game-of-month
// Body: { gameId: number }
const setGameOfMonth = async (req, res) => {
  try {
    const { gameId } = req.body;

    if (!gameId || typeof gameId !== 'number') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_GAME_ID', message: 'Valid gameId is required' }
      });
    }

    // Check if RetroGame already exists for this gameId
    let retroGame = await RetroGame.findOne({ gameId });

    if (retroGame) {
      // Update existing game - just reactivate it
      console.log('Found existing RetroGame, reactivating:', retroGame.gomId);
      retroGame.isActive = true; // This will deactivate other active games via pre-save hook
      await retroGame.save();

      res.json({
        success: true,
        data: {
          gomId: retroGame.gomId,
          gameName: retroGame.gameName,
          consoleName: retroGame.consoleName,
          totalAchievements: retroGame.achievements.length,
          action: 'reactivated'
        }
      });
      return;
    }

    // Generate gomId for current month (e.g., "2025-09.1")
    const now = new Date();
    const yearMonth = now.toISOString().slice(0, 7); // "2025-09"

    // Find the highest priority for this month and increment
    const existingGames = await RetroGame.find({
      gomId: new RegExp(`^${yearMonth}\\.`)
    }).sort({ gomId: -1 });

    let priority = 1;
    if (existingGames.length > 0) {
      const lastGomId = existingGames[0].gomId;
      const lastPriority = parseInt(lastGomId.split('.')[1]);
      priority = lastPriority + 1;
    }

    const gomId = `${yearMonth}.${priority}`;
    console.log('Generated gomId:', gomId);

    // Fetch game data from RetroAchievements
    const gameData = await retroAchievementsService.getGameExtended(gameId);
    console.log('Game data received:', !!gameData, gameData?.title, gameData?.consoleName);

    if (!gameData) {
      throw new Error('Failed to fetch game data from RetroAchievements');
    }

    // Create achievement definitions
    const achievements = Object.values(gameData.achievements).map(achievement => ({
      achievementId: achievement.id,
      badgeId: achievement.badgeName,
      name: achievement.title,
      description: achievement.description,
      points: achievement.points,
      softcoreOwners: [],
      hardcoreOwners: []
    }));

    // Create the RetroGame document
    retroGame = new RetroGame({
      gameId: gameData.id,
      gameName: gameData.title,
      consoleName: gameData.consoleName,
      gomId,
      isActive: true, // This will deactivate other active games via pre-save hook
      imageIcon: gameData.imageIcon,
      imageTitle: gameData.imageTitle,
      imageIngame: gameData.imageIngame,
      imageBoxArt: gameData.imageBoxArt,
      achievements,
      users: []
    });

    await retroGame.save();

    res.json({
      success: true,
      data: {
        gomId,
        gameName: gameData.title,
        consoleName: gameData.consoleName,
        totalAchievements: achievements.length
      }
    });

  } catch (error) {
    console.error('Failed to set game of month:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to set game of month' }
    });
  }
};

// GET /api/retro-games
const getAvailableGomIds = async (req, res) => {
  try {
    const retroGames = await RetroGame.find({}, 'gomId gameName isActive createdAt')
      .sort({ createdAt: -1 });

    const gomIds = retroGames.map(game => ({
      gomId: game.gomId,
      gameName: game.gameName,
      isActive: game.isActive,
      createdAt: game.createdAt
    }));

    res.json({
      success: true,
      data: gomIds
    });

  } catch (error) {
    console.error('Failed to get available GoM IDs:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve available games' }
    });
  }
};

// GET /api/retro-games/active
const getActiveGameOfMonth = async (req, res) => {
  try {
    const activeGame = await RetroGame.findOne({ isActive: true });

    if (!activeGame) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No active Game of the Month' }
      });
    }

    res.json({
      success: true,
      data: {
        gomId: activeGame.gomId,
        gameId: activeGame.gameId,
        gameName: activeGame.gameName,
        consoleName: activeGame.consoleName,
        isActive: activeGame.isActive,
        imageIcon: activeGame.imageIcon,
        imageTitle: activeGame.imageTitle,
        imageIngame: activeGame.imageIngame,
        imageBoxArt: activeGame.imageBoxArt,
        description: activeGame.description,
        achievements: activeGame.achievements,
        users: activeGame.users,
        createdAt: activeGame.createdAt,
        updatedAt: activeGame.updatedAt
      }
    });

  } catch (error) {
    console.error('Failed to get active game of month:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve active game data' }
    });
  }
};

// GET /api/retro-games/:gomId
const getGameOfMonth = async (req, res) => {
  try {
    const { gomId } = req.params;

    const retroGame = await RetroGame.findOne({ gomId });

    if (!retroGame) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Game of the Month not found' }
      });
    }

    res.json({
      success: true,
      data: {
        gomId: retroGame.gomId,
        gameId: retroGame.gameId,
        gameName: retroGame.gameName,
        consoleName: retroGame.consoleName,
        isActive: retroGame.isActive,
        imageIcon: retroGame.imageIcon,
        imageTitle: retroGame.imageTitle,
        imageIngame: retroGame.imageIngame,
        imageBoxArt: retroGame.imageBoxArt,
        achievements: retroGame.achievements,
        users: retroGame.users,
        createdAt: retroGame.createdAt,
        updatedAt: retroGame.updatedAt
      }
    });

  } catch (error) {
    console.error('Failed to get game of month:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve game data' }
    });
  }
};

// PUT /api/retro-games/active/description
const updateActiveGameDescription = async (req, res) => {
  try {
    const { description } = req.body;

    if (typeof description !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_DESCRIPTION', message: 'Description must be a string' }
      });
    }

    const activeGame = await RetroGame.findOneAndUpdate(
      { isActive: true },
      { description: description.trim() },
      { new: true }
    );

    if (!activeGame) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No active Game of the Month' }
      });
    }

    res.json({
      success: true,
      data: {
        gomId: activeGame.gomId,
        description: activeGame.description
      }
    });

  } catch (error) {
    console.error('Failed to update active game description:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update game description' }
    });
  }
};

module.exports = {
  setGameOfMonth,
  getAvailableGomIds,
  getActiveGameOfMonth,
  getGameOfMonth,
  updateActiveGameDescription
};
