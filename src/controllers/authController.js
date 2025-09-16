// src/controllers/authController.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// User Signup
exports.signup = async (req, res) => {
  try {
    const { name, password, isAdmin } = req.body;
    const existingUser = await User.findOne({ name });
    if (existingUser) {
      return res.status(400).send({ error: 'Username already exists.' });
    }
    const user = new User({ name, password, isAdmin });
    await user.save();
    res.status(201).send({ message: 'User created successfully', user });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

// User Login
exports.login = async (req, res) => {
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
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days, to match token expiry
        });

        // Return the user object to save a follow-up request on the client
        const userPayload = await User.findById(user._id).select('-password').lean();

        res.json({ message: 'Logged in successfully', user: userPayload });

    } catch (error) {
        console.error('Login error:', error);
        res.status(400).json({ error: error.message });
    }
};

// Refresh User Token
exports.refreshToken = async (req, res) => {
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
};

// Logout User
exports.logout = (req, res) => {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.send({ message: 'Logged out successfully' });
};
