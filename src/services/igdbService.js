const axios = require('axios');
const IgdbLookup = require('../models/IgdbLookup');
const igdbConfig = require('../../config/igdb');

class IGDBService {
  constructor() {
    this.clientId = igdbConfig.api.clientId;
    this.clientSecret = igdbConfig.api.clientSecret;
    this.baseUrl = igdbConfig.api.baseUrl;
    this.token = null;
    this.tokenExpiry = null;
    this.lookupCache = {
      genres: new Map(),
      platforms: new Map(),
      gameModes: new Map(),
      isLoaded: false
    };
  }

  async getAccessToken() {
    // Return cached token if still valid (with buffer from config)
    if (this.token && this.tokenExpiry && Date.now() < (this.tokenExpiry - igdbConfig.api.tokenRefreshBuffer)) {
      return this.token;
    }

    try {
      const response = await axios.post(igdbConfig.api.tokenUrl, {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials'
      });

      this.token = response.data.access_token;
      // Use token expiry from config
      this.tokenExpiry = Date.now() + igdbConfig.api.tokenExpiry;

      console.log('IGDB access token refreshed successfully');
      return this.token;
    } catch (error) {
      console.error('Failed to get IGDB access token:', error.response?.data || error.message);
      throw new Error('Unable to authenticate with IGDB API');
    }
  }

  async makeRequest(endpoint, query) {
    const token = await this.getAccessToken();

    try {
      const response = await axios.post(`${this.baseUrl}/${endpoint}`, query, {
        headers: {
          'Client-ID': this.clientId,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'text/plain'
        }
      });

      return response.data;
    } catch (error) {
      console.error(`IGDB API error for ${endpoint}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async initializeLookupTables() {
    if (this.lookupCache.isLoaded) return;

    try {
      // Try to load from database first
      const lookups = await IgdbLookup.find({});

      const requiredTables = igdbConfig.lookups.requiredTables;
      if (lookups.length === requiredTables.length) {
        // Check if data is fresh using config
        const oldestUpdate = Math.min(...lookups.map(l => l.lastUpdated.getTime()));
        const isFresh = Date.now() - oldestUpdate < igdbConfig.lookups.refreshInterval;

        if (isFresh) {
          // Load from database into memory cache
          // Convert string keys back to numbers for proper lookup
          lookups.forEach(lookup => {
            const map = new Map();
            lookup.data.forEach((value, key) => {
              map.set(parseInt(key), value);
            });
            this.lookupCache[lookup.type] = map;
          });
          this.lookupCache.isLoaded = true;
          console.log('✅ IGDB lookup tables loaded from database');
          return;
        }
      }

      // Fetch fresh data from IGDB if no data or data is stale
      console.log('🔄 Fetching fresh IGDB lookup data...');
      await this.refreshLookupTables();

    } catch (error) {
      // Handle database authentication/connection errors gracefully
      if (error.code === 13 || error.message.includes('authentication')) {
        console.warn('⚠️ Database authentication required for IGDB lookup tables');
        console.warn('📝 IGDB functionality will work without cached lookup tables');
        // Mark as loaded to prevent further attempts
        this.lookupCache.isLoaded = true;
        return;
      }

      console.error('❌ Failed to initialize IGDB lookup tables:', error.message);
      // Don't throw - let the service continue without lookup tables
      this.lookupCache.isLoaded = true;
    }
  }

  async refreshLookupTables() {
    try {
      const batchSize = igdbConfig.lookups.batchSize;
      const [genres, platforms, gameModes] = await Promise.all([
        this.makeRequest('genres', `fields ${igdbConfig.fields.genre.join(', ')}; limit ${batchSize};`),
        this.makeRequest('platforms', `fields ${igdbConfig.fields.platform.join(', ')}; limit ${batchSize};`),
        this.makeRequest('game_modes', `fields ${igdbConfig.fields.gameMode.join(', ')}; limit ${batchSize};`)
      ]);

      // Update memory cache
      this.lookupCache.genres = new Map(genres.map(g => [g.id, g.name]));
      this.lookupCache.platforms = new Map(platforms.map(p => [p.id, p.name]));
      this.lookupCache.gameModes = new Map(gameModes.map(gm => [gm.id, gm.name]));
      this.lookupCache.isLoaded = true;

      // Persist to database
      await Promise.all([
        IgdbLookup.findOneAndUpdate(
          { type: 'genres' },
          {
            data: Object.fromEntries(this.lookupCache.genres),
            lastUpdated: new Date()
          },
          { upsert: true, new: true }
        ),
        IgdbLookup.findOneAndUpdate(
          { type: 'platforms' },
          {
            data: Object.fromEntries(this.lookupCache.platforms),
            lastUpdated: new Date()
          },
          { upsert: true, new: true }
        ),
        IgdbLookup.findOneAndUpdate(
          { type: 'gameModes' },
          {
            data: Object.fromEntries(this.lookupCache.gameModes),
            lastUpdated: new Date()
          },
          { upsert: true, new: true }
        )
      ]);

      console.log('IGDB lookup tables refreshed and persisted');
    } catch (error) {
      console.error('Failed to refresh lookup tables:', error);
      throw error;
    }
  }

  async searchGames(searchTerm, limit = igdbConfig.requests.defaultLimit) {
    await this.ensureLookupTablesLoaded();

    // Validate limit against config
    const actualLimit = Math.min(limit, igdbConfig.requests.maxLimit);

    // Get basic search results first
    const searchQuery = `
      search "${searchTerm}";
      fields ${igdbConfig.fields.game.join(', ')};
      limit ${actualLimit};
    `;

    try {
      const searchResults = await this.makeRequest('games', searchQuery);

      // Get detailed data for each result
      const detailedResults = [];
      for (const game of searchResults) {
        try {
          const details = await this.getGameDetails(game.id);

          if (details) {
            detailedResults.push({
              id: game.id,
              name: game.name,
              genres: details.genres || [],
              platforms: details.availablePlatforms || [],
              gameModes: details.gameModes || [],
              rating: game.rating || details.rating,
              artwork: game.cover?.image_id ?
                `https://images.igdb.com/igdb/image/upload/t_720p/${game.cover.image_id}.jpg` :
                details.artwork,
              releaseDate: game.first_release_date ? new Date(game.first_release_date * 1000) : details.releaseDate
            });
          }
        } catch (error) {
          console.warn(`Failed to get details for game ${game.id}:`, error.message);
          // Still include basic info if details fail
          detailedResults.push({
            id: game.id,
            name: game.name,
            genres: [],
            platforms: [],
            gameModes: [],
            rating: game.rating,
            artwork: game.cover?.image_id ?
              `https://images.igdb.com/igdb/image/upload/t_720p/${game.cover.image_id}.jpg` :
              null,
            releaseDate: game.first_release_date ? new Date(game.first_release_date * 1000) : null
          });
        }

        // Rate limit delay from config
        await new Promise(resolve => setTimeout(resolve, igdbConfig.requests.rateLimitDelay));
      }

      return detailedResults;
    } catch (error) {
      console.error('IGDB search error:', error);
      throw error;
    }
  }

  async getGameDetails(igdbId) {
    await this.ensureLookupTablesLoaded();

    const query = `
      where id = ${igdbId};
      fields ${igdbConfig.fields.game.join(', ')};
    `;

    try {
      const results = await this.makeRequest('games', query);

      if (results.length === 0) return null;

      const game = results[0];

      const resolvedGenres = game.genres?.map(id => this.lookupCache.genres.get(id)).filter(Boolean) || [];
      const resolvedPlatforms = game.platforms?.map(id => this.lookupCache.platforms.get(id)).filter(Boolean) || [];
      const resolvedGameModes = game.game_modes?.map(id => this.lookupCache.gameModes.get(id)).filter(Boolean) || [];

      return {
        id: game.id,
        name: game.name,
        description: game.summary,
        genres: resolvedGenres,
        availablePlatforms: resolvedPlatforms,
        gameModes: resolvedGameModes,
        rating: game.rating,
        artwork: game.cover?.image_id ?
          `https://images.igdb.com/igdb/image/upload/t_720p/${game.cover.image_id}.jpg` :
          null,
        releaseDate: game.first_release_date ? new Date(game.first_release_date * 1000) : null,
        videos: game.videos?.map(v => v.video_id).filter(Boolean) || [],
        publishers: game.involved_companies?.map(c => c.company?.name).filter(Boolean) || [],
        igdbUrl: game.url
      };
    } catch (error) {
      console.error('IGDB details error:', error);
      throw error;
    }
  }

  async ensureLookupTablesLoaded() {
    if (!this.lookupCache.isLoaded) {
      await this.initializeLookupTables();
    }
  }
}

module.exports = new IGDBService();
