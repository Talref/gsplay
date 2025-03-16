// src/routes/userRoutes.js
const express = require('express');
const jwt = require('jsonwebtoken'); // Ensure this is correctly imported
const User = require('../models/User');
const router = express.Router();
const axios = require('axios');
const authMiddleware = require('../middleware/auth'); // For protecting routes

// Signup
router.post('/signup', async (req, res) => {
  try {
    const { name, password, isAdmin } = req.body;
    const user = new User({ name, password, isAdmin });
    await user.save();
    res.status(201).send({ message: 'User created successfully', user });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { name, password } = req.body;
    const user = await User.findOne({ name });
    if (!user) {
      return res.status(400).send({ error: 'Invalid credentials' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).send({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.send({ message: 'Logged in successfully', token });
  } catch (error) {
    console.error('Login error:', error); // Log the error for debugging
    res.status(400).send({ error: error.message });
  }
});

// Logout (client-side: delete the token)
router.post('/logout', authMiddleware, (req, res) => {
  res.send({ message: 'Logged out successfully' });
});

// Fetch current user data
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password'); // Exclude password
    if (!user) {
      return res.status(404).json({ error: 'User not found' }); // Send JSON
    }
    console.log('User data sent to frontend:', user); // Log the user data
    res.json(user); // Send user data as JSON
  } catch (error) {
    res.status(400).json({ error: error.message }); // Send JSON
  }
});

// Delete account
router.delete('/delete', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.isAdmin) {
      return res.status(403).send({ error: 'Admin accounts cannot be deleted' });
    }
    await User.findByIdAndDelete(req.user.id);
    res.send({ message: 'Account deleted successfully' });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

// Set Steam ID
router.post('/set-steam-id', authMiddleware, async (req, res) => {
  try {
    const { steamId } = req.body;
    const user = await User.findById(req.user.id);
    user.steamId = steamId;
    await user.save();
    res.send({ message: 'Steam ID updated successfully', user });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

// Refresh game list
router.post('/refresh-games', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.steamId) {
      return res.status(400).send({ error: 'Steam ID not set' });
    }

    const response = await axios.get(
      `http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${process.env.STEAM_API_KEY}&steamid=${user.steamId}&format=json&include_played_free_games=true&include_appinfo=true`
    );

    const games = response.data.response.games.map((game) => ({
      name: game.name,
      steamId: game.appid,
    }));

    user.games = games;
    await user.save();

    res.send({ message: 'Game list refreshed successfully', games });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

// Fetch user's game list
router.get('/games', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('games'); // Fetch only the games field
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ games: user.games }); // Return the games array
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Fetch all games owned by users, aggregated and sorted by ownership count
router.get('/games/all', async (req, res) => {
  try {
    // Aggregate games and their owners
    const games = await User.aggregate([
      { $unwind: '$games' }, // Flatten the games array
      {
        $group: {
          _id: '$games.steamId', // Group by Steam ID
          name: { $first: '$games.name' }, // Get the game name
          users: { $addToSet: '$name' }, // Collect unique user names
        },
      },
      {
        $project: {
          _id: 0, // Exclude the default _id field
          name: 1, // Include the game name
          steamId: '$_id', // Rename _id to steamId
          users: 1, // Include the users array
        },
      },
      { $sort: { users: -1 } }, // Sort by number of users (descending)
    ]);

    res.json(games); // Send the aggregated and sorted list
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;