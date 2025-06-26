const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./database'); // Import the database connection
const authenticateToken = require('./authMiddleware'); // Import the auth middleware

const app = express();
const port = process.env.PORT || 3000; // Use environment variable for port

// Use environment variable for JWT secret (important for security)
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_replace_this_in_env';
const saltRounds = 10;

// --- Middleware ---
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- Helper Functions ---

// Generic function to handle database errors and send response
function handleDbError(res, err, contextMessage) {
  console.error(`Database error during ${contextMessage}:`, err.message);
  return res.status(500).json({ message: `Server error during ${contextMessage}` });
}

// Generic function to handle missing fields
function handleMissingFields(res, requiredFields, body) {
  const missing = requiredFields.filter(field => !(field in body) || !body[field]);
  if (missing.length > 0) {
    console.error(`Missing required fields: ${missing.join(', ')}`);
    return res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` });
  }
  return null; // Indicates no missing fields
}

// --- Authentication Routes ---

// Register Route
app.post('/register', async (req, res) => {
  const required = ['firstName', 'lastName', 'email', 'phone', 'password'];
  const missingFieldsError = handleMissingFields(res, required, req.body);
  if (missingFieldsError) return missingFieldsError;

  const { firstName, lastName, email, phone, password } = req.body;

  try {
    db.get('SELECT email FROM users WHERE email = ?', [email], async (err, row) => {
      if (err) return handleDbError(res, err, 'registration check');
      if (row) return res.status(400).json({ message: 'Email already registered' });

      const hashedPassword = await bcrypt.hash(password, saltRounds);
      const sql = 'INSERT INTO users (firstName, lastName, email, phone, password) VALUES (?, ?, ?, ?, ?)';

      db.run(sql, [firstName, lastName, email, phone, hashedPassword], function(err) {
        if (err) return handleDbError(res, err, 'user insertion');
        console.log(`User registered with ID: ${this.lastID}`);
        res.status(201).json({ message: 'User registered successfully' });
      });
    });
  } catch (error) {
    console.error('Error during registration hashing:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Login Route
app.post('/login', (req, res) => {
  const required = ['email', 'password'];
  const missingFieldsError = handleMissingFields(res, required, req.body);
  if (missingFieldsError) return missingFieldsError;

  const { email, password } = req.body;

  const sql = 'SELECT * FROM users WHERE email = ?';
  db.get(sql, [email], async (err, user) => {
    if (err) return handleDbError(res, err, 'login user lookup');
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    try {
      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(401).json({ message: 'Invalid email or password' });

      const userPayload = { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, phone: user.phone };
      const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '1h' });

      res.json({ message: 'Login successful', token, user: userPayload });
    } catch (compareError) {
        console.error('Error during password comparison:', compareError);
        res.status(500).json({ message: 'Server error during login' });
    }
  });
});

// --- Protected Routes (Require Authentication) ---

// Middleware to apply authentication to subsequent routes
app.use(authenticateToken);

// Get User's Test Drives
app.get('/my-test-drives', (req, res) => {
  const userId = req.user.id;
  console.log(`[GET /my-test-drives] Fetching drives for userId: ${userId}`);

  const sql = 'SELECT id, carModel, preferredDate, preferredTime, createdAt FROM test_drives WHERE userId = ? ORDER BY createdAt DESC';
  db.all(sql, [userId], (err, rows) => {
    if (err) return handleDbError(res, err, 'retrieving test drives');
    console.log(`[GET /my-test-drives] Found ${rows.length} drives for userId: ${userId}`);
    res.json(rows || []); // Ensure response is always an array
  });
});

// Generic handler for submitting data to a table
async function handleProtectedPost(req, res, options) {
    const { tableName, requiredFields, columns, successMessage, logContext } = options;
    const userId = req.user.id;

    const missingFieldsError = handleMissingFields(res, requiredFields, req.body);
    if (missingFieldsError) return missingFieldsError;

    console.log(`[POST /${tableName}] Received request for userId: ${userId}`, req.body);

    const values = columns.map(col => req.body[col] || null); // Get values from body, default to null if missing (for optional fields)
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${tableName} (userId, ${columns.join(', ')}) VALUES (?, ${placeholders})`;

    db.run(sql, [userId, ...values], function(err) {
        if (err) return handleDbError(res, err, `saving ${logContext}`);
        console.log(`[POST /${tableName}] ${logContext} saved successfully with ID: ${this.lastID} for userId: ${userId}`);
        res.status(201).json({ message: successMessage, [`${logContext}Id`]: this.lastID });
    });
}

// Schedule Test Drive Route
app.post('/test-drive', (req, res) => {
    handleProtectedPost(req, res, {
        tableName: 'test_drives',
        requiredFields: ['carModel', 'name', 'email', 'phone', 'preferredDate', 'preferredTime'],
        columns: ['carModel', 'name', 'email', 'phone', 'preferredDate', 'preferredTime'],
        successMessage: 'Test drive scheduled successfully',
        logContext: 'testDrive'
    });
});

// Contact Message Route
app.post('/contact', (req, res) => {
    handleProtectedPost(req, res, {
        tableName: 'messages',
        requiredFields: ['name', 'email', 'phone', 'interest', 'message'],
        columns: ['name', 'email', 'phone', 'interest', 'message'],
        successMessage: 'Message sent successfully',
        logContext: 'message'
    });
});

// Financing Request Route
app.post('/financing-request', (req, res) => {
    // Add specific validation for amount and term before generic handler
    const { amount, term } = req.body;
    if (amount && (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)) {
        return res.status(400).json({ message: 'Invalid loan amount' });
    }
    if (term && (isNaN(parseInt(term)) || parseInt(term) <= 0)) {
        return res.status(400).json({ message: 'Invalid loan term' });
    }

    handleProtectedPost(req, res, {
        tableName: 'financing_requests',
        requiredFields: ['name', 'email', 'phone', 'amount', 'term'],
        columns: ['name', 'email', 'phone', 'amount', 'term', 'message'], // message is optional
        successMessage: 'Financing request submitted successfully. A specialist will contact you soon.',
        logContext: 'financingRequest'
    });
});


// --- Basic Routes ---

// Basic route for testing server
app.get('/', (req, res) => {
  res.send('AutoHub Backend is running!');
});

// --- Error Handling Middleware (Catch-all) ---
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({ message: 'Something went wrong on the server!' });
});

// --- Start Server ---
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
