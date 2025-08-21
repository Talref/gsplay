// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors'); 
const cookieParser = require('cookie-parser');
const userRoutes = require('./src/routes/userRoutes');
const authMiddleware = require('./src/middleware/auth');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Routes
app.use('/api', userRoutes);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
