// src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');

// Import controllers
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const adminController = require('../controllers/adminController');
const libraryController = require('../controllers/libraryController');
const gameController = require('../controllers/gameController');
const retroAchievementsController = require('../controllers/retroAchievementsController');

// Import middlewares
const authMiddleware = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

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
router.post('/set-retroachievements-username', authMiddleware, userController.setRetroAchievementsUsername);
router.post('/refresh-games', authMiddleware, userController.refreshGames);
router.post('/import-library', authMiddleware, upload.single('file'), userController.importLibrary);

// Admin Routes
router.get('/users', authMiddleware, adminController.getAllUsers);
router.delete('/users/:id', authMiddleware, adminController.deleteUser);
router.post('/admin/restore-failed-games', authMiddleware, adminController.restoreFailedGames);
router.post('/admin/force-enrichment', authMiddleware, adminController.forceGameEnrichment);
router.post('/admin/scan-all-users', authMiddleware, adminController.scanAllUsersGames);
router.post('/admin/drop-games-collection', authMiddleware, adminController.dropGamesCollection);
router.get('/admin/game-stats', authMiddleware, adminController.getGameStats);

// Library Routes
router.get('/users/games/all', libraryController.getAllUserGames);
router.get('/user/:userId/game-count', libraryController.countUserGames);

// Game Search Routes (Public - no auth required for discovery)
router.get('/games/search', gameController.searchGames);
router.get('/games/:id/details', gameController.getGameDetails);
router.get('/games/filters', gameController.getFilterOptions);

// RetroAchievements Routes
router.get('/retro-games', retroAchievementsController.getAvailableGomIds);
router.get('/retro-games/active', retroAchievementsController.getActiveGameOfMonth);
router.put('/retro-games/active/description', authMiddleware, retroAchievementsController.updateActiveGameDescription);
router.get('/retro-games/:gomId', retroAchievementsController.getGameOfMonth);

// Admin RetroAchievements Routes
router.post('/admin/set-game-of-month', authMiddleware, retroAchievementsController.setGameOfMonth);

module.exports = router;
