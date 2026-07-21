# 🎮 GSPlay - Game Library Management System

A comprehensive game library management application built with Node.js, Express, MongoDB, and React. GSPlay integrates with the Internet Game Database (IGDB) to provide detailed game information and user library management.

> ## v2 rebuild preview
> An isolated GSPlay v2 rebuild is in progress on the `rebuild/v2` branch. It does **not** replace the legacy server or production deployment yet. See [the v2 local preview guide](docs/V2-Preview.md) for startup, testing, known limitations, and quality checks.

![GSPlay Logo](gsplay-frontend/public/gslogo.png)

## ✨ Features

### Core Functionality
- 🔍 **Advanced Game Search** - Search and filter games by name, genre, platform, and game mode
- 📚 **Personal Game Library** - Manage your personal game collection
- 👥 **Social Features** - See what games your friends own
- 🎯 **IGDB Integration** - Rich game data from Internet Game Database
- 📱 **Responsive Design** - Works on desktop and mobile devices

### Technical Features
- 🛡️ **Secure Authentication** - JWT-based user authentication
- 🚀 **High Performance** - Optimized queries and caching
- 📊 **Comprehensive Logging** - Request/response tracking and error logging
- 🧪 **Thorough Testing** - Unit, integration, and API tests
- 📖 **Complete Documentation** - API docs and setup guides

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+)
- MongoDB (v5+)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Talref/gsplay.git
   cd gsplay
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start MongoDB**
   ```bash
   sudo systemctl start mongodb
   ```

5. **Start the application**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   ```
   http://localhost:3000
   ```

For detailed setup instructions, see [Setup Guide](docs/Setup-Guide.md).

## 📁 Project Structure

```
gsplay/
├── 📁 src/                    # Backend source code
│   ├── 📁 controllers/        # Route controllers
│   ├── 📁 middleware/         # Express middleware
│   ├── 📁 models/            # MongoDB models
│   ├── 📁 routes/            # API routes
│   ├── 📁 services/          # Business logic services
│   ├── 📁 utils/             # Utility functions
│   └── 📁 validators/         # Input validation
├── 📁 gsplay-frontend/       # React frontend
├── 📁 tests/                 # Test files
│   ├── 📁 unit/              # Unit tests
│   ├── 📁 integration/       # Integration tests
│   └── 📁 api/               # API tests
├── 📁 docs/                  # Documentation
├── 📁 config/                # Configuration files
└── 📄 server.js              # Main server file
```

## 🛠️ Technology Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: Custom validation with sanitization
- **Testing**: Jest with Supertest
- **Documentation**: JSDoc

### Frontend
- **Framework**: React
- **Build Tool**: Vite
- **Styling**: CSS Modules
- **State Management**: React Context
- **HTTP Client**: Axios

### External Services
- **IGDB API**: Game data and metadata
- **Steam API**: Game ownership data (optional)

## 🧪 Testing

GSPlay includes comprehensive testing coverage:

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run specific test types
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:api         # API tests only

# Run tests in watch mode
npm run test:watch
```

### Test Structure
- **Unit Tests**: Test individual functions and utilities
- **Integration Tests**: Test service interactions
- **API Tests**: Test complete request/response cycles
- **Coverage Reports**: HTML and LCOV coverage reports

## 📚 Documentation

### API Documentation
Complete API reference with examples:
- [API Documentation](docs/API-Documentation.md)

### Setup Guide
Detailed installation and configuration:
- [Setup Guide](docs/Setup-Guide.md)

### Code Documentation
Generate technical documentation:
```bash
npm run docs
```

## 🔧 Development

### Available Scripts

```bash
# Development
npm run dev          # Start development server with nodemon
npm start           # Start production server

# Testing
npm test            # Run all tests
npm run test:watch  # Run tests in watch mode
npm run test:coverage # Run tests with coverage

# Documentation
npm run docs        # Generate JSDoc documentation

# Database
npm run db:seed     # Seed database with sample data
npm run db:migrate  # Run database migrations
```

### Development Workflow

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Write Tests First** (TDD approach)
   ```bash
   # Create test file
   touch tests/unit/path/to/your-test.test.js
   ```

3. **Implement Feature**
   ```javascript
   // Write clean, well-commented code
   function yourFeature() {
     // Implementation here
   }
   ```

4. **Run Tests**
   ```bash
   npm test
   ```

5. **Update Documentation**
   ```bash
   # Update API docs if needed
   # Update code comments
   ```

6. **Commit Changes**
   ```bash
   git add .
   git commit -m "Add: your feature description"
   ```

## 🚀 Deployment

### Production Setup

1. **Environment Configuration**
   ```env
   NODE_ENV=production
   MONGO_URI=mongodb://user:pass@host:port/db
   JWT_SECRET=your-production-secret
   ```

2. **Process Management**
   ```bash
   npm install -g pm2
   pm2 start server.js --name gsplay
   pm2 save
   pm2 startup
   ```

3. **Reverse Proxy (Nginx)**
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
       }
   }
   ```

4. **SSL Certificate**
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Guidelines
- Follow existing code style and patterns
- Write comprehensive tests for new features
- Update documentation for API changes
- Use meaningful commit messages
- Test in both development and production environments

### Code Style
- Use ESLint configuration
- Follow JavaScript Standard Style
- Write clear, concise comments
- Use meaningful variable and function names

## 📊 Performance

GSPlay is optimized for performance:

- **Database Indexing**: Optimized MongoDB indexes
- **Query Optimization**: Efficient database queries
- **Caching**: Response caching for frequently accessed data
- **Rate Limiting**: Prevents abuse and ensures fair usage
- **Compression**: Gzip compression for responses

## 🔒 Security

Security features include:

- **Input Sanitization**: Prevents XSS and injection attacks
- **Authentication**: Secure JWT-based authentication
- **Authorization**: Role-based access control
- **Rate Limiting**: Prevents brute force and DoS attacks
- **HTTPS**: SSL/TLS encryption in production
- **Security Headers**: Helmet.js security middleware

## 📈 Monitoring

Built-in monitoring features:

- **Request Logging**: Complete request/response logging
- **Error Tracking**: Comprehensive error logging with context
- **Performance Metrics**: Response times and throughput
- **Health Checks**: Application health monitoring
- **Database Monitoring**: Connection and query monitoring

## 🐛 Troubleshooting

### Common Issues

**MongoDB Connection Error**
```bash
# Check MongoDB status
sudo systemctl status mongodb

# Restart MongoDB
sudo systemctl restart mongodb
```

**Port Already in Use**
```bash
# Find process using port
lsof -i :3000

# Kill process or change port in .env
PORT=3001
```

**Test Failures**
```bash
# Clear test cache
npm test -- --clearCache

# Run specific test
npm test -- tests/unit/specific-test.test.js
```

**Verbose Logging**
```bash
# Enable detailed request logging and slow request warnings
LOG_LEVEL=verbose npm run dev
```

For more troubleshooting, see [Setup Guide](docs/Setup-Guide.md).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2025 GSPlay

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 🙏 Acknowledgments

- **IGDB** for providing comprehensive game data
- **MongoDB** for the robust database solution
- **Express.js** for the flexible web framework
- **React** for the powerful frontend library

## 📞 Support

- **Documentation**: [API Docs](docs/API-Documentation.md) | [Setup Guide](docs/Setup-Guide.md)
- **Issues**: [GitHub Issues](https://github.com/Talref/gsplay/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Talref/gsplay/discussions)

---

**Built with ❤️ for game enthusiasts by developers who love gaming**

🎮 Happy gaming! 🎮
