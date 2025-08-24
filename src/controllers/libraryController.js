// src/controllers/libraryController.js
const libraryService = require('../services/libraryService');

// Fetch all games owned by users, aggregated and sorted by ownership count
exports.getAllUserGames = async (req, res) => {
  try {
    const games = await libraryService.listAllGamesSorted();
    res.json(games);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Count User's games
exports.countUserGames = async (req, res) => {
  try {
    const { userId } = req.params; 
    const gameCount = await libraryService.countUserGames(userId);
    if (gameCount === null) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ userId, gameCount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};