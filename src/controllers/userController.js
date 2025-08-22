// src/controllers/userController.js
const User = require('../models/User');
const dispatcher = require('../parsers/dispatcher');
const axios = require('axios');

// Fetch current user data
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password'); // Exclude password
    if (!user) {
      return res.status(404).json({ error: 'User not found' }); // Send JSON
    }
    res.json(user); // Send user data as JSON
  } catch (error) {
    res.status(400).json({ error: error.message }); // Send JSON
  }
};

// Fetch user's game list
exports.getGames = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('games'); // Fetch only the games field
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    res.json({ games: user.games }); // Return the games array
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Set Steam ID
exports.setSteamId = async (req, res) => {
  try {
    const { steamId } = req.body;
    const user = await User.findById(req.user.id);
    user.steamId = steamId;
    await user.save();
    res.send({ message: 'Steam ID aggiornato con successo!', user });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

// Refresh Steam game list
exports.refreshGames = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.steamId) {
      return res.status(400).send({ error: 'Steam ID not presente' });
    }

    const response = await axios.get(
      `http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${process.env.STEAM_API_KEY}&steamid=${user.steamId}&format=json&include_played_free_games=true&include_appinfo=true`
    );

    const steamGames = response.data.response.games.map((game) => ({
      name: game.name,
      platform: "steam",
      platformId: String(game.appid),
    }));

    // Keep all non-Steam games
    const otherGames = user.games.filter((g) => g.platform !== "steam");

    // Replace user.games with otherGames + refreshed Steam games
    const allGames = [...otherGames, ...steamGames];
    allGames.sort((a, b) => a.name.localeCompare(b.name));
    user.games = allGames;
    await user.save();

    res.send({ 
      message: 'Successo!', 
      games: user.games 
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

// Import External JSON Library
exports.importLibrary = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!req.file) {
      return res.status(400).send({ error: 'No file uploaded' });
    }

    const fileContent = req.file.buffer.toString('utf-8');

    let games;
    try {
      games = await dispatcher(fileContent, req.file.originalname);
    } catch (err) {
      return res.status(400).send({ error: `Parsing failed: ${err.message}` });
    }

    const platform = games[0]?.platform;
    if (!platform) {
      return res.status(400).send({ error: 'Parsed games missing platform' });
    }

    const updatedGames = [
      ...user.games.filter(g => g.platform !== platform),
      ...games
    ];
    updatedGames.sort((a, b) => a.name.localeCompare(b.name));
    user.games = updatedGames;
    await user.save();

    res.send({ message: 'Libreria importata, DAJEEEEE!', games: user.games });
  } catch (err) {
    res.status(400).send({ error: err.message });
  }
};
