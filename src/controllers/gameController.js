// src/controllers/gameController.js
const Game = require('../models/Game');

// Search games with filters
exports.searchGames = async (req, res) => {
  try {
    const {
      name = '',
      genres = [],
      platforms = [],
      gameModes = [],
      page = 1,
      limit = 20,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    // Build MongoDB query
    const query = {};

    // Text search on name
    if (name && name.trim()) {
      query.$text = { $search: name.trim() };
    }

    // Array filters
    if (genres.length > 0) {
      const genreArray = Array.isArray(genres) ? genres : [genres];
      query.genres = { $in: genreArray };
    }

    if (platforms.length > 0) {
      let platformArray = Array.isArray(platforms) ? platforms : [platforms];

      // Expand "PC" category to include all PC platforms
      if (platformArray.includes('PC')) {
        const pcPlatforms = ['PC (Microsoft Windows)', 'Linux', 'Mac'];
        // Replace "PC" with actual PC platforms, and keep any other selected platforms
        platformArray = platformArray.filter(p => p !== 'PC').concat(pcPlatforms);
      }

      query.availablePlatforms = { $in: platformArray };
    }

    if (gameModes.length > 0) {
      const modeArray = Array.isArray(gameModes) ? gameModes : [gameModes];
      query.gameModes = { $in: modeArray };
    }

    // Only return enriched games (with IGDB data)
    query.igdbId = { $exists: true, $ne: null, $ne: -1 };

    // Sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const games = await Game.find(query)
      .select('name genres availablePlatforms gameModes rating artwork releaseDate owners')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const total = await Game.countDocuments(query);

    // Transform owners count
    const gamesWithOwnerCount = games.map(game => ({
      ...game,
      ownerCount: game.owners ? game.owners.length : 0,
      owners: undefined // Remove owners array from response
    }));

    res.json({
      games: gamesWithOwnerCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      filters: {
        name,
        genres: Array.isArray(genres) ? genres : [genres].filter(Boolean),
        platforms: Array.isArray(platforms) ? platforms : [platforms].filter(Boolean),
        gameModes: Array.isArray(gameModes) ? gameModes : [gameModes].filter(Boolean)
      }
    });

  } catch (error) {
    console.error('Game search error:', error);
    res.status(500).json({ error: 'Failed to search games' });
  }
};

// Get detailed game information with owners
exports.getGameDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const game = await Game.findById(id)
      .populate('owners.userId', 'name') // Populate owner names
      .lean();

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Transform owners data
    const owners = game.owners ? game.owners.map(owner => ({
      userId: owner.userId._id,
      name: owner.userId.name,
      platforms: owner.platforms
    })) : [];

    const gameDetails = {
      ...game,
      owners,
      ownerCount: owners.length
    };

    res.json(gameDetails);

  } catch (error) {
    console.error('Game details error:', error);
    res.status(500).json({ error: 'Failed to get game details' });
  }
};

// Get available filter options
exports.getFilterOptions = async (req, res) => {
  try {
    // Curated list of relevant platforms for your community
    // Updated to match IGDB's exact platform names from database
    const curatedPlatforms = [
      'PC (Microsoft Windows)', // IGDB's exact name for PC
      'Linux',
      'Mac', // IGDB calls macOS this
      'PlayStation 4',
      'PlayStation 5',
      'Xbox One',
      'Xbox Series X|S', // IGDB uses | not /
      'Xbox', // Generic Xbox
      'Nintendo Switch',
      'Nintendo Switch 2' // Future-proofing
    ];

    // Get distinct values for other filters
    const [genres, allPlatforms, gameModes] = await Promise.all([
      Game.distinct('genres'),
      Game.distinct('availablePlatforms'),
      Game.distinct('gameModes')
    ]);

    // Filter platforms to only include curated ones that exist in database
    let availablePlatforms = curatedPlatforms.filter(platform =>
      allPlatforms.includes(platform)
    );

    // Group PC platforms under single "PC" category for better UX
    const pcPlatforms = ['PC (Microsoft Windows)', 'Linux', 'Mac'];
    const hasAnyPcPlatform = pcPlatforms.some(platform => availablePlatforms.includes(platform));

    if (hasAnyPcPlatform) {
      // Remove individual PC platforms and add unified "PC" category
      availablePlatforms = availablePlatforms.filter(platform => !pcPlatforms.includes(platform));
      availablePlatforms.unshift('PC'); // Add PC at the beginning
    }

    // Filter out null/undefined values and sort
    const filterOptions = {
      genres: genres.filter(Boolean).sort(),
      platforms: availablePlatforms.sort(),
      gameModes: gameModes.filter(Boolean).sort()
    };

    res.json(filterOptions);

  } catch (error) {
    console.error('Filter options error:', error);
    res.status(500).json({ error: 'Failed to get filter options' });
  }
};
