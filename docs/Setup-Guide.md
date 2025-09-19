# GSPlay Setup Guide

## Prerequisites

Before setting up GSPlay, ensure you have the following installed:

### Required Software
- **Node.js** (v18.0.0 or higher) - [Download](https://nodejs.org/)
- **MongoDB** (v5.0 or higher) - [Download](https://www.mongodb.com/try/download/community)
- **Git** - [Download](https://git-scm.com/)

### Optional Tools
- **VS Code** - Recommended IDE with extensions for JavaScript/Node.js
- **Postman** - For API testing
- **MongoDB Compass** - GUI for MongoDB management

## Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/Talref/gsplay.git
cd gsplay
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your configuration
nano .env
```

### 4. Database Setup
```bash
# Start MongoDB service
sudo systemctl start mongodb
# or on macOS: brew services start mongodb/brew/mongodb-community

# Verify MongoDB is running
mongosh --eval "db.adminCommand('ismaster')"
```

### 5. Start the Application
```bash
# Development mode
npm run dev

# Production mode
npm start
```

### 6. Verify Installation
```bash
# Check server health
curl http://localhost:3000/health

# Check configuration
curl http://localhost:3000/config-test
```

## Detailed Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
NODE_ENV=development
PORT=3000
HOST=localhost

# Database Configuration
MONGO_URI=mongodb://localhost:27017/gsplay

# IGDB API Configuration (via Twitch)
TW_CLIENTID=your_twitch_client_id_here
TW_CLIENTSECRET=your_twitch_client_secret_here

# Steam API Configuration
STEAM_API_KEY=your_steam_api_key_here

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your_refresh_secret_here

# Session Configuration
SESSION_SECRET=your_session_secret_here

# CORS Configuration
CORS_ORIGIN=http://localhost:5173
```

### IGDB API Setup

1. **Create Twitch Developer Account**
   - Visit [Twitch Developer Console](https://dev.twitch.tv/console/apps)
   - Create a new application
   - Note: IGDB API is now managed through Twitch

2. **Configure API Keys**
   ```env
   TW_CLIENTID=your_twitch_client_id_here
   TW_CLIENTSECRET=your_twitch_client_secret_here
   ```

### MongoDB Configuration

#### Local MongoDB Setup
```bash
# Install MongoDB (Ubuntu/Debian)
sudo apt update
sudo apt install mongodb

# Start MongoDB
sudo systemctl start mongodb
sudo systemctl enable mongodb
```

#### MongoDB with Authentication (Production)
```bash
# Create admin user
mongosh
use admin
db.createUser({
  user: "gsplay_admin",
  pwd: "secure_password_here",
  roles: ["userAdminAnyDatabase", "dbAdminAnyDatabase", "readWriteAnyDatabase"]
})

# Update .env
MONGO_URI=mongodb://gsplay_admin:secure_password_here@localhost:27017/gsplay?authSource=admin
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

## Frontend Setup

### React Frontend
```bash
# Navigate to frontend directory
cd gsplay-frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Frontend Configuration
Update `gsplay-frontend/src/config/api.js`:
```javascript
export const API_BASE_URL = 'http://localhost:3000/api';
```

## Production Deployment

### 1. Environment Configuration
```env
NODE_ENV=production
PORT=3000
MONGO_URI=mongodb://username:password@host:port/database?authSource=admin
JWT_SECRET=your_production_jwt_secret
CORS_ORIGIN=https://yourdomain.com
TW_CLIENTID=your_twitch_client_id_here
TW_CLIENTSECRET=your_twitch_client_secret_here
```

### 2. Process Management
```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start server.js --name gsplay

# Save PM2 configuration
pm2 save
pm2 startup
```

### 3. Caddy Configuration

Create a `Caddyfile` in your project root:

```caddyfile
yourdomain.com {
    # Automatic HTTPS with Let's Encrypt
    reverse_proxy localhost:3000

    # Security headers
    header {
        # Enable HSTS
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        # Prevent clickjacking
        X-Frame-Options "DENY"
        # XSS protection
        X-XSS-Protection "1; mode=block"
        # Prevent MIME type sniffing
        X-Content-Type-Options "nosniff"
        # Referrer policy
        Referrer-Policy "strict-origin-when-cross-origin"
    }

    # Gzip compression
    encode gzip

    # Rate limiting (optional)
    rate_limit {
        zone static {
            key {remote_host}
            window 1m
            events 100
        }
    }

    # Logging
    log {
        output file /var/log/caddy/gsplay.log
        format json
    }
}
```

### 4. Start Caddy

⚠️ **Important**: Only proceed if you're setting up Caddy for the first time or you understand how to merge configurations.

```bash
# Install Caddy (if not already installed)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy

# Check if Caddyfile already exists
if [ -f /etc/caddy/Caddyfile ]; then
    echo "⚠️  WARNING: Caddyfile already exists!"
    echo "Please backup your existing configuration:"
    echo "sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.backup"
    echo ""
    echo "Then manually add your GSPlay configuration to /etc/caddy/Caddyfile"
    echo "or replace the entire file if this is a fresh Caddy installation."
else
    # Safe to copy for new installations
    sudo cp Caddyfile /etc/caddy/Caddyfile
fi

# Validate configuration before applying
sudo caddy validate --config /etc/caddy/Caddyfile

# Reload Caddy configuration
sudo systemctl reload caddy

# Check status
sudo systemctl status caddy
```

#### Alternative: Manual Configuration
If you prefer to manually configure Caddy:

1. **Check existing configuration**:
   ```bash
   sudo cat /etc/caddy/Caddyfile
   ```

2. **Create backup** (if file exists):
   ```bash
   sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.backup
   ```

3. **Add your domain configuration** to the existing Caddyfile or replace it entirely.

4. **Validate and reload**:
   ```bash
   sudo caddy validate --config /etc/caddy/Caddyfile
   sudo systemctl reload caddy
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

## Performance Optimization

### Database Indexes
```javascript
// Create indexes for better query performance
db.games.createIndex({ name: 1 });
db.games.createIndex({ genres: 1 });
db.games.createIndex({ igdbId: 1 });
db.games.createIndex({ "owners.userId": 1 });
```

### Caching
```javascript
// Implement Redis for session storage and caching
npm install redis connect-redis
```

### Monitoring
```javascript
// Add monitoring with PM2
pm2 install pm2-logrotate
pm2 install pm2-server-monit
```

## Contributing

### Development Guidelines
1. Follow existing code style
2. Write tests for new features
3. Update documentation
4. Use meaningful commit messages
5. Test in both development and production modes

### Branch Strategy
```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes and commit
git add .
git commit -m "Add new feature"

# Push and create PR
git push origin feature/new-feature
```

## Support

### Getting Help
1. Check this documentation
2. Review error logs
3. Check GitHub issues
4. Create a new issue with:
   - Error messages
   - Environment details
   - Steps to reproduce

### Community
- **GitHub Repository**: https://github.com/Talref/gsplay
- **Issues**: Report bugs and request features
- **Discussions**: Ask questions and share ideas

---

## Quick Reference

### Useful Commands
```bash
# Start development
npm run dev

# Run tests
npm test

# Generate docs
npm run docs

# Check health
curl http://localhost:3000/health

# View logs
pm2 logs gsplay
```

### File Structure
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

### Ports
- **Backend API**: http://localhost:3000 (default, change it in .env)
- **Frontend**: http://localhost:5173
- **MongoDB**: localhost:27017
- **MongoDB Express**: localhost:8081 (optional)

This setup guide should get you up and running quickly. For more advanced configurations, refer to the API documentation and individual service documentation.
