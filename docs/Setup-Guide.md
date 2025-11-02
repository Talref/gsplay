# GSPlay Setup Guide

## Overview

GSPlay is a full-stack application with:
- **Backend**: Node.js/Express API with MongoDB
- **Frontend**: React/Vite single-page application
- **Database**: MongoDB for data storage

## Prerequisites

- Node.js (v18+)
- MongoDB (v5+)
- Git

## Quick Setup

### 1. Clone and Install
```bash
git clone https://github.com/Talref/gsplay.git
cd gsplay
npm install
```

### 2. Configure Environment
Create `.env` file (see Environment Variables section below)

### 3. Start Services
```bash
# Start MongoDB
sudo systemctl start mongodb

# Start backend
npm run dev

# Build frontend (in another terminal)
cd gsplay-frontend
npm install && npm run build
```

## Environment Configuration

### .env File Setup

Create a `.env` file in the project root with the following variables:

```env
# Application Environment
NODE_ENV=development

# Server Settings
PORT=3000
HOST=localhost

# Database Connection
MONGO_URI=mongodb://localhost:27017/gsplay

# Logging Level (minimal/info/verbose/quiet)
LOG_LEVEL=info

# Security Secrets
SESSION_SECRET=your_session_secret_here
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here

# API Keys (get from respective services)
STEAM_API_KEY=your_steam_api_key
TW_CLIENTID=your_twitch_client_id
TW_CLIENTSECRET=your_twitch_client_secret

# RetroAchievements (optional)
RETROACHIEVEMENT_USERNAME=your_username
RETROACHIEVEMENT_API_KEY=your_api_key

# CORS Settings
CORS_ORIGIN=http://localhost:5173
```

### Environment Variables Explained

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | `development` | Environment mode (`development`/`production`) |
| `PORT` | No | `3000` | Server port number |
| `HOST` | No | `localhost` | Server host binding |
| `MONGO_URI` | Yes | - | MongoDB connection string |
| `LOG_LEVEL` | No | `info` | Logging verbosity: `minimal`, `info`, `verbose`, `quiet` |
| `SESSION_SECRET` | Yes | - | Session encryption key (random string) |
| `JWT_SECRET` | Yes | - | JWT token signing key (random string) |
| `JWT_REFRESH_SECRET` | Yes | - | Refresh token signing key (random string) |
| `STEAM_API_KEY` | Yes | - | Steam Web API key from [Steam](https://steamcommunity.com/dev/apikey) |
| `TW_CLIENTID` | No | - | Twitch Client ID for IGDB API |
| `TW_CLIENTSECRET` | No | - | Twitch Client Secret for IGDB API |
| `RETROACHIEVEMENT_USERNAME` | No | - | RetroAchievements username |
| `RETROACHIEVEMENT_API_KEY` | No | - | RetroAchievements API key |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed frontend origins |

### Logging Configuration

The `LOG_LEVEL` variable controls application logging:

- **`minimal`**: Only essential startup/shutdown messages
- **`info`**: General operational messages (recommended)
- **`verbose`**: Detailed request/response logging
- **`quiet`**: Suppress all non-error logs

**Example**: Set `LOG_LEVEL=verbose` to see all API requests during development.

### API Keys Setup

#### Steam API Key
1. Visit [Steam Community Dev](https://steamcommunity.com/dev/apikey)
2. Create application and get API key
3. Add to `.env`: `STEAM_API_KEY=your_key_here`

#### IGDB/Twitch API (Optional)
1. Go to [Twitch Developer Console](https://dev.twitch.tv/console/apps)
2. Create application
3. Add Client ID/Secret to `.env`

#### RetroAchievements (Optional)
1. Visit [RetroAchievements](https://retroachievements.org/)
2. Get username and API key from profile
3. Add to `.env`

### Database Setup

#### Local MongoDB
```bash
# Install and start
sudo apt install mongodb
sudo systemctl start mongodb

# Test connection
mongosh --eval "db.runCommand('ping')"
```

#### Production MongoDB
For authentication, update `MONGO_URI`:
```
MONGO_URI=mongodb://username:password@host:port/database?authSource=admin
```

## Development Workflow

### Running Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:api

# Run tests in watch mode
npm run test:watch
```

### Code Quality
```bash
# Generate documentation
npm run docs

# Check code style (if ESLint configured)
npm run lint
```

### Database Management
```bash
# Connect to MongoDB
mongosh gsplay

# View collections
show collections

# Query games
db.games.find().limit(5)

# Count total games
db.games.countDocuments()
```

## Testing

### Test Routines
```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run specific test suites
npm run test:unit      # Unit tests
npm run test:integration  # Integration tests
npm run test:api       # API tests

# Run tests in watch mode (re-run on file changes)
npm run test:watch

# Run tests with verbose output
npm test -- --verbose
```

### Test Structure
- **Unit tests**: Test individual functions and modules
- **Integration tests**: Test component interactions
- **API tests**: Test HTTP endpoints and responses
- **Coverage reports**: Shows which code is tested

### Writing Tests
Tests are located in the `tests/` directory. Use the existing patterns:
- Unit tests: `tests/unit/`
- API tests: `tests/api/`
- Setup: `tests/setup.js`

## Production Deployment

For production, set `NODE_ENV=production` and configure your web server to proxy requests to the Node.js application. Basic Caddy example:

```caddy
yourdomain.com {
    reverse_proxy localhost:3000
}
```

## Troubleshooting

### Common Issues

#### MongoDB Connection Error
```bash
# Check MongoDB status
sudo systemctl status mongodb

# Restart MongoDB
sudo systemctl restart mongodb

# Check MongoDB logs
sudo journalctl -u mongodb -f
```

#### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port in .env
PORT=3001
```

#### IGDB API Errors
```bash
# Verify API credentials
curl -X POST "https://id.twitch.tv/oauth2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET&grant_type=client_credentials"
```

#### Build Errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear npm cache
npm cache clean --force
```

### Debug Mode
```bash
# Enable debug logging
DEBUG=* npm run dev

# Check application logs
tail -f logs/app.log
```

## File Structure
```
gsplay/
├── src/                 # Backend source code
├── gsplay-frontend/     # React frontend
├── tests/              # Test files
├── docs/               # Documentation
├── config/             # Configuration files
├── .env                # Environment variables
└── server.js           # Main server file
```
