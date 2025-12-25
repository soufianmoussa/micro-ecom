const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(express.json());

// CORS Configuration
const allowedOrigins = [
  "http://16.170.251.169",
  "http://16.170.251.169:80",
  "http://16.170.251.169:8080", // frontend origin
  "http://localhost:3000",
  "http://localhost:8080",
  process.env.CORS_ORIGIN
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // IMPORTANT: don't throw an Error (it becomes 500)
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'admin',
  host: process.env.POSTGRES_HOST || 'postgres',
  database: 'cart_db',
  password: process.env.POSTGRES_PASSWORD || 'password',
  port: process.env.POSTGRES_PORT || 5432,
});

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'cart-service' });
});

app.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready', service: 'cart-service' });
  } catch (err) {
    res.status(503).json({ status: 'not-ready', error: err.message });
  }
});

// Init DB
const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        user_id VARCHAR(50) NOT NULL,
        product_id VARCHAR(50) NOT NULL,
        qty INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (user_id, product_id)
      );
    `);
    console.log('Cart tables initialized');
  } catch (err) {
    console.error('Cart DB Init Error:', err);
  }
};
setTimeout(initDB, 5000);

app.get('/cart/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query('SELECT product_id as "productId", qty FROM cart_items WHERE user_id = $1', [userId]);
    res.json({ items: result.rows });
  } catch (err) {
    console.error('Cart fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

app.post('/cart/:userId/add', async (req, res) => {
  try {
    const { userId } = req.params;
    const { productId, qty } = req.body;
    if (!productId || !qty) return res.status(400).json({ error: 'Missing productId or qty' });

    // Upsert
    await pool.query(`
      INSERT INTO cart_items (user_id, product_id, qty) 
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, product_id) 
      DO UPDATE SET qty = cart_items.qty + $3
    `, [userId, productId, qty]);

    // Return updated cart
    const result = await pool.query('SELECT product_id as "productId", qty FROM cart_items WHERE user_id = $1', [userId]);
    res.json({ items: result.rows });
  } catch (err) {
    console.error('Cart add error:', err);
    res.status(500).json({ error: 'Failed to add to cart' });
  }
});

app.post('/cart/:userId/clear', async (req, res) => {
  try {
    const { userId } = req.params;
    await pool.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Cart clear error:', err);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => console.log(`Cart service running on ${PORT}`));
