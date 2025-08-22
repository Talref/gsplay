// src/controllers/libraryController.js
const libraryService = require('../services/libraryService');

// Fetch all games owned by users, aggregated and sorted by ownership count
exports.getAllUserGames = async (req, res) => {
  try {
    // The service handles fetching all users and games
    const games = await libraryService.listAllGamesSorted();

    // The controller now sends the response
    res.json(games);
  } catch (error) {
    console.error(error); // Log the error for debugging
    res.status(500).json({ error: error.message });
  }
};