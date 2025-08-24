// src/services/libraryService.js
const User = require('../models/User');

// List all games owned by all users, sorted from most owned.
exports.listAllGamesSorted = async () => {
  const users = await User.find({}, 'name games').lean();

  const gameMap = new Map();

  users.forEach(user => {
    if (!Array.isArray(user.games)) return;

    user.games.forEach(game => {
      const name = game.name;
      if (!name) return;

      if (!gameMap.has(name)) {
        gameMap.set(name, {
          name,
          id: {},
          users: []
        });
      }

      const gameEntry = gameMap.get(name);

      if (game.platform && game.app_name) {
        const platformKey = `${game.platform}Id`;
        gameEntry.id[platformKey] = game.app_name;
      }

      let userEntry = gameEntry.users.find(u => u.user === user.name);
      if (!userEntry) {
        userEntry = { user: user.name, platform: [] };
        gameEntry.users.push(userEntry);
      }

      if (game.platform && !userEntry.platform.includes(game.platform)) {
        userEntry.platform.push(game.platform);
      }
    });
  });

  const gamesArray = Array.from(gameMap.values()).sort(
    (a, b) => b.users.length - a.users.length
  );

  return gamesArray;
};

// Counts the number of games owned
exports.countUserGames = async (userId) => {
  try {
    const user = await User.findById(userId, 'games');
    if (!user) {
      return null;
    }
    return user.games.length;
  } catch (error) {
    console.error('Error counting user games:', error);
    throw error;
  }
};
