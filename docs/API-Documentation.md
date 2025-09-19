# GSPlay API Documentation

## Overview

GSPlay is a comprehensive game library management application that integrates with IGDB (Internet Game Database) to provide detailed game information and user library management.

## Base URL
```
http://localhost:3000/api
```

## Authentication

Most endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "pagination": { ... },
  "filters": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_TYPE",
    "message": "Human readable message",
    "details": { ... },
    "timestamp": "2025-01-19T16:00:00.000Z",
    "requestId": "req_123456789"
  }
}
```

## Games API

### Search Games

Search and filter games in the database.

**Endpoint:** `GET /games/search`

**Query Parameters:**
- `name` (string, optional): Search term for game name
- `genres` (string[], optional): Filter by genres
- `platforms` (string[], optional): Filter by platforms
- `gameModes` (string[], optional): Filter by game modes
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20, max: 100)
- `sortBy` (string, optional): Sort field (name, rating, releaseDate, ownerCount, createdAt)
- `sortOrder` (string, optional): Sort order (asc, desc)

**Example Request:**
```bash
GET /api/games/search?name=mario&genres=platform&page=1&limit=10
```

**Success Response (200):**
```json
{
  "games": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Super Mario Bros",
      "genres": ["Platform", "Adventure"],
      "availablePlatforms": ["NES", "SNES"],
      "gameModes": ["Single Player"],
      "rating": 95,
      "artwork": "mario-artwork.jpg",
      "releaseDate": "1985-09-13T00:00:00.000Z",
      "ownerCount": 42
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 156,
    "pages": 16,
    "hasNext": true,
    "hasPrev": false,
    "nextPage": 2,
    "prevPage": null
  },
  "filters": {
    "name": "mario",
    "genres": ["platform"],
    "platforms": [],
    "gameModes": []
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid search parameters
- `500 Internal Server Error`: Database or server error

### Get Game Details

Get detailed information about a specific game.

**Endpoint:** `GET /games/:id`

**Path Parameters:**
- `id` (string, required): MongoDB ObjectId of the game

**Example Request:**
```bash
GET /api/games/507f1f77bcf86cd799439011
```

**Success Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "Super Mario Bros",
  "description": "Classic platformer game...",
  "genres": ["Platform", "Adventure"],
  "availablePlatforms": ["NES", "SNES"],
  "gameModes": ["Single Player"],
  "rating": 95,
  "artwork": "mario-artwork.jpg",
  "releaseDate": "1985-09-13T00:00:00.000Z",
  "videos": ["trailer1.mp4"],
  "publishers": ["Nintendo"],
  "igdbUrl": "https://www.igdb.com/games/super-mario-bros",
  "owners": [
    {
      "userId": "user123",
      "name": "John Doe",
      "platforms": ["NES"]
    }
  ],
  "ownerCount": 42
}
```

**Error Responses:**
- `400 Bad Request`: Invalid game ID format
- `404 Not Found`: Game not found
- `500 Internal Server Error`: Database or server error

## User API

### User Registration

Create a new user account.

**Endpoint:** `POST /auth/register`

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "user123",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "token": "jwt-token-here"
  }
}
```

### User Login

Authenticate user and get JWT token.

**Endpoint:** `POST /auth/login`

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "user123",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "token": "jwt-token-here"
  }
}
```

## Admin API

### Force Game Enrichment

Trigger IGDB enrichment for games in the database.

**Endpoint:** `POST /admin/force-enrichment`

**Headers:**
```
Authorization: Bearer <admin-jwt-token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Game enrichment started",
    "totalGames": 1743,
    "enrichedCount": 0
  }
}
```

## Error Codes

### Common Error Codes
- `VALIDATION_ERROR`: Input validation failed
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `INTERNAL_SERVER_ERROR`: Server error occurred

### Game-Specific Errors
- `GAME_NOT_FOUND`: Game not found in database
- `INVALID_GAME_ID`: Invalid game ID format

### Authentication Errors
- `INVALID_CREDENTIALS`: Wrong email or password
- `TOKEN_EXPIRED`: JWT token has expired
- `TOKEN_INVALID`: Invalid JWT token

## Rate Limiting

API endpoints are rate limited to prevent abuse:
- **Authenticated requests**: 1000 requests per hour
- **Unauthenticated requests**: 100 requests per hour

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1640995200
```

## Data Formats

### Game Object
```javascript
{
  _id: "MongoDB ObjectId",
  name: "String (required)",
  description: "String",
  genres: ["String"],
  availablePlatforms: ["String"],
  gameModes: ["String"],
  rating: "Number (0-100)",
  artwork: "String (URL)",
  releaseDate: "Date",
  videos: ["String (URLs)"],
  publishers: ["String"],
  igdbUrl: "String (URL)",
  owners: [{
    userId: "MongoDB ObjectId",
    name: "String",
    platforms: ["String"]
  }],
  ownerCount: "Number",
  createdAt: "Date",
  updatedAt: "Date"
}
```

### User Object
```javascript
{
  _id: "MongoDB ObjectId",
  name: "String (required)",
  email: "String (required, unique)",
  password: "String (hashed)",
  role: "String (user/admin)",
  createdAt: "Date",
  updatedAt: "Date"
}
```

## Best Practices

### Search Optimization
- Use specific search terms for better results
- Combine multiple filters for precise results
- Use pagination for large result sets

### Error Handling
- Always check the `success` field in responses
- Handle different error codes appropriately
- Use request IDs for debugging when contacting support

### Authentication
- Store JWT tokens securely
- Refresh tokens before they expire
- Include tokens in all authenticated requests

## Support

For API issues or questions:
1. Check this documentation first
2. Review error messages for specific guidance
3. Include request IDs when reporting issues
4. Check server logs for detailed error information
