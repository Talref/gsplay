// src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');

// Import controllers
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const adminController = require('../controllers/adminController');
const libraryController = require('../controllers/libraryController');

// Import middlewares
const authMiddleware = require('../middleware/auth');
const authLimiter = require('../middleware/rateLimiter');

// Configure Multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/json') {
      return cb(new Error('Only JSON files are allowed'));
    }
    cb(null, true);
  }
});

// Auth Routes
router.post('/signup', authLimiter, authController.signup);
router.post('/login', authLimiter, authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout);

// User Profile Routes
router.get('/users/me', authMiddleware, userController.getMe);
router.get('/user/games', authMiddleware, userController.getGames);
router.post('/set-steam-id', authMiddleware, userController.setSteamId);
router.post('/refresh-games', authMiddleware, userController.refreshGames);
router.post('/import-library', authMiddleware, upload.single('file'), userController.importLibrary);

// Admin Routes
router.get('/users', authMiddleware, adminController.getAllUsers);
router.delete('/users/:id', authMiddleware, adminController.deleteUser);

// Library Routes
router.get('/users/games/all', libraryController.getAllUserGames);

module.exports = router;