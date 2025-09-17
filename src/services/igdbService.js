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
          lookups.forEach(lookup => {
            this.lookupCache[lookup.type] = new Map(Object.entries(lookup.data));
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

  // Placeholder function for game retrieval - to be implemented after reading API docs
  async searchGames(searchTerm, limit = 10) {
    // TODO: Implement actual IGDB query after reading docs
    console.log(`Placeholder: Searching for games with term "${searchTerm}", limit: ${limit}`);
    return [];
  }

  async getGameDetails(igdbId) {
    // TODO: Implement actual IGDB query after reading docs
    console.log(`Placeholder: Getting details for game ID ${igdbId}`);
    return null;
  }
}

module.exports = new IGDBService();
