const jwt = require('jsonwebtoken');

// Use the same secret key logic as server.js (environment variable preferred)
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_replace_this_in_env';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token == null) {
    return res.status(401).json({ message: 'Authentication token required' }); // if there isn't any token
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error('JWT Verification Error:', err);
      return res.status(403).json({ message: 'Invalid or expired token' }); // if token is invalid
    }
    req.user = user; // Add user payload to request object
    next(); // pass the execution to the next handler
  });
};

module.exports = authenticateToken;
