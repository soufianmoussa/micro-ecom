const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(express.json());

// CORS Configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
  credentials: true,
};
app.use(cors(corsOptions));

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'admin',
  host: process.env.POSTGRES_HOST || 'postgres',
  database: 'order_db',
  password: process.env.POSTGRES_PASSWORD || 'password',
  port: process.env.POSTGRES_PORT || 5432,
});

const CART_SERVICE_URL = process.env.CART_SERVICE_URL || 'http://cart-service:4001';

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'order-service' });
});

app.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready', service: 'order-service' });
  } catch (err) {
    res.status(503).json({ status: 'not-ready', error: err.message });
  }
});

// Init DB
const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        total_items INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Order tables initialized');
  } catch (err) {
    console.error('Order DB Init Error:', err);
  }
};
setTimeout(initDB, 5000);

app.post('/order', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    // Fetch cart
    const cartRes = await axios.get(`${CART_SERVICE_URL}/cart/${userId}`);
    const cart = cartRes.data;

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const totalItems = cart.items.reduce((acc, i) => acc + i.qty, 0);

    // Persist Order
    const result = await pool.query(
      'INSERT INTO orders (user_id, total_items) VALUES ($1, $2) RETURNING id',
      [userId, totalItems]
    );
    const orderId = result.rows[0].id;

    // Clear cart
    await axios.post(`${CART_SERVICE_URL}/cart/${userId}/clear`);

    res.json({ id: orderId, message: 'Order created' });
  } catch (err) {
    console.error('Order creation error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

app.get('/orders/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Orders fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

const PORT = process.env.PORT || 4002;
app.listen(PORT, () => console.log(`Order service running on ${PORT}`));
