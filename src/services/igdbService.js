const axios = require('axios');

class IGDBService {
  constructor() {
    this.clientId = process.env.TW_CLIENTID;
    this.clientSecret = process.env.TW_CLIENTSECRET;
    this.baseUrl = 'https://api.igdb.com/v4';
    this.token = null;
    this.tokenExpiry = null;
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
