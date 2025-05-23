// src/routes/userRoutes.js
const express = require('express');
const jwt = require('jsonwebtoken'); 
const User = require('../models/User');
const router = express.Router();
const axios = require('axios');
const authMiddleware = require('../middleware/auth'); // For protecting routes
const authLimiter = require('../middleware/rateLimiter'); // For rate limiting

// Signup
router.post('/signup', authLimiter, async (req, res) => {
  try {
    const { name, password, isAdmin } = req.body;

    // Check if the username already exists
    const existingUser = await User.findOne({ name });
    if (existingUser) {
      return res.status(400).send({ error: 'Username already exists.' });
    }

    // Create a new user
    const user = new User({ name, password, isAdmin });
    await user.save();
    res.status(201).send({ message: 'User created successfully', user });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const { name, password } = req.body;
    const user = await User.findOne({ name });
    
    if (!user || !(await user.comparePassword(password))) {
      return res.status(400).json({ error: 'Invalid credentials' }); // Consistent JSON response
    }

    // Access Token (15min expiry)
    const accessToken = jwt.sign(
      { id: user._id, isAdmin: user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Refresh Token (7d expiry)
    const refreshToken = jwt.sign(
      { id: user._id, isAdmin: user.isAdmin },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Set httpOnly cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.json({ message: 'Logged in successfully' }); // No token in response body

  } catch (error) {
    console.error('Login error:', error);
    res.status(400).json({ error: error.message }); // Consistent JSON error
  }
});

// Refresh the login token
router.post('/refresh-token', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) throw new Error("No refresh token");

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) throw new Error("User not found");

    // Issue a new accessToken (same as login)
    const newAccessToken = jwt.sign(
      { id: user._id, isAdmin: user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.status(204).end(); 
  } catch (error) {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
});

// Logout (client-side: delete the token)
router.post('/logout', (req, res) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.send({ message: 'Logged out successfully' });
});

// Fetch current user data
router.get('/users/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password'); // Exclude password
    if (!user) {
      return res.status(404).json({ error: 'User not found' }); // Send JSON
    }
    res.json(user); // Send user data as JSON
  } catch (error) {
    res.status(400).json({ error: error.message }); // Send JSON
  }
});

// Fetch all users (admin only)
router.get('/users', authMiddleware, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const users = await User.find({}).select('-password'); // Exclude passwords
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
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

// Delete a user (admin only)
router.delete('/users/:id', authMiddleware, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    // Prevent admin from deleting themselves
    if (req.user.id === req.params.id) {
      return res.status(403).json({ error: 'You cannot delete your own account.' });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
router.get('/user/games', authMiddleware, async (req, res) => {
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
router.get('/users/games/all', async (req, res) => {
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