// src/controllers/gameController.js
const Game = require('../models/Game');
const { buildCompleteQueryOptions } = require('../services/queryBuilders/gameQueryBuilder');
const { transformGamesForList } = require('../services/dataTransformers/gameTransformer');
const { createPaginationMetadata } = require('../services/dataTransformers/paginationTransformer');
const { validateSearchParams } = require('../services/validators/searchValidators');
const { createErrorResponse, createNotFoundResponse } = require('../utils/errors/errorResponseFormatter');
const ERROR_TYPES = require('../utils/errors/errorTypes');
const HTTP_STATUS = require('../utils/errors/httpStatusCodes');

// Search games with filters
exports.searchGames = async (req, res) => {
  try {
    // Validate and sanitize input parameters
    const validation = validateSearchParams(req.query);
    if (!validation.isValid) {
      const errorResponse = createErrorResponse(
        ERROR_TYPES.VALIDATION_ERROR,
        'Invalid search parameters',
        { fields: validation.errors },
        req.requestId
      );
      return res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse);
    }

    const params = validation.validated;

    // Build query options using the query builder
    const queryOptions = buildCompleteQueryOptions(params);
    let games;
    let total;

    if (queryOptions.useAggregation) {
      // Use aggregation pipeline for ownerCount sorting
      games = await Game.aggregate(queryOptions.aggregation).exec();
      // Get total count using the match query
      total = await Game.countDocuments(queryOptions.aggregation[0].$match);
    } else {
      // Execute standard find query
      games = await Game.find(queryOptions.query)
        .select('name genres availablePlatforms gameModes rating artwork releaseDate owners')
        .sort(queryOptions.sort)
        .skip(queryOptions.skip)
        .limit(queryOptions.limit)
        .lean();

      // Get total count for pagination
      total = await Game.countDocuments(queryOptions.query);
    }

    // Transform games for response
    const transformedGames = transformGamesForList(games);

    // Create pagination metadata
    const pagination = createPaginationMetadata(total, params.page, params.limit);

    res.json({
      games: transformedGames,
      pagination,
      filters: {
        name: params.name,
        genres: params.genres,
        platforms: params.platforms,
        gameModes: params.gameModes
      }
    });

  } catch (error) {
    console.error('Game search error:', error);

    // Use standardized error response
    const errorResponse = createErrorResponse(
      ERROR_TYPES.INTERNAL_SERVER_ERROR,
      'Failed to search games',
      process.env.NODE_ENV === 'development' ? { originalError: error.message } : undefined,
      req.requestId
    );

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(errorResponse);
  }
};

const { validateGameId } = require('../services/validators/searchValidators');
const { transformGameForDetails } = require('../services/dataTransformers/gameTransformer');

// Get detailed game information with owners
exports.getGameDetails = async (req, res) => {
  try {
    // Validate game ID
    const idValidation = validateGameId(req.params.id);
    if (!idValidation.isValid) {
      const errorResponse = createErrorResponse(
        ERROR_TYPES.INVALID_FORMAT,
        'Invalid game ID format',
        { field: 'id', value: req.params.id },
        req.requestId
      );
      return res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse);
    }

    const gameId = idValidation.validated;

    const game = await Game.findById(gameId)
      .populate('owners.userId', 'name') // Populate owner names
      .lean();

    if (!game) {
      const errorResponse = createNotFoundResponse('Game', req.requestId);
      return res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse);
    }

    // Transform game for detailed response
    const gameDetails = transformGameForDetails(game);

    res.json(gameDetails);

  } catch (error) {
    console.error('Game details error:', error);

    // Use standardized error response
    const errorResponse = createErrorResponse(
      ERROR_TYPES.INTERNAL_SERVER_ERROR,
      'Failed to get game details',
      process.env.NODE_ENV === 'development' ? { originalError: error.message } : undefined,
      req.requestId
    );

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(errorResponse);
  }
};

const { getFilterOptions } = require('../services/queryBuilders/filterQueryBuilder');

// Get available filter options
exports.getFilterOptions = async (req, res) => {
  try {
    const filterOptions = await getFilterOptions();
    res.json(filterOptions);
  } catch (error) {
    console.error('Filter options error:', error);
    res.status(500).json({ error: 'Failed to get filter options' });
  }
};
