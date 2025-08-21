// src/middleware/auth.js
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const token = req.cookies.accessToken; 
  if (!token) {
    return res.status(401).send({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; 
    next();
  } catch (error) {
    // Any error in verifying the token (expired, malformed, etc.)
    // should result in a 401 Unauthorized status.
    // The frontend is specifically looking for a 401 to trigger the
    // token refresh mechanism.
    res.status(401).send({ error: 'Invalid or expired token.' });
  }
};

module.exports = authMiddleware;