const axios = require('axios');
const IgdbLookup = require('../models/IgdbLookup');

class IGDBService {
  constructor() {
    this.clientId = process.env.TW_CLIENTID;
    this.clientSecret = process.env.TW_CLIENTSECRET;
    this.baseUrl = 'https://api.igdb.com/v4';
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
    // Return cached token if still valid (with 5min buffer)
    if (this.token && this.tokenExpiry && Date.now() < (this.tokenExpiry - 300000)) {
      return this.token;
    }

    try {
      const response = await axios.post('https://id.twitch.tv/oauth2/token', {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials'
      });

      this.token = response.data.access_token;
      // Token expires in 60 days, but we'll refresh every 50 days for safety
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);

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

      if (lookups.length === 3) {
        // Check if data is fresh (less than 30 days old)
        const oldestUpdate = Math.min(...lookups.map(l => l.lastUpdated.getTime()));
        const isFresh = Date.now() - oldestUpdate < 30 * 24 * 60 * 60 * 1000;

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
          console.log('IGDB lookup tables loaded from database');
          return;
        }
      }

      // Fetch fresh data from IGDB if no data or data is stale
      console.log('Fetching fresh IGDB lookup data...');
      await this.refreshLookupTables();

    } catch (error) {
      console.error('Failed to initialize lookup tables:', error);
      throw error;
    }
  }

  async refreshLookupTables() {
    try {
      const [genres, platforms, gameModes] = await Promise.all([
        this.makeRequest('genres', 'fields id, name; limit 500;'),
        this.makeRequest('platforms', 'fields id, name; limit 500;'),
        this.makeRequest('game_modes', 'fields id, name; limit 500;')
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

  async searchGames(searchTerm, limit = 5) { // Reduced limit to avoid rate limits
    await this.ensureLookupTablesLoaded();

    // Get basic search results first
    const searchQuery = `
      search "${searchTerm}";
      fields name, id, rating, cover.image_id, first_release_date;
      limit ${limit};
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

        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
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
      fields name, id, genres, platforms, game_modes, rating, cover.image_id,
             videos.video_id, summary, involved_companies.company.name,
             first_release_date, url;
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
