const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(cors());

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'admin',
  host: process.env.POSTGRES_HOST || 'postgres',
  database: 'cart_db',
  password: process.env.POSTGRES_PASSWORD || 'password',
  port: 5432,
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

app.post('/cart/:userId/clear', async (req, res) => {
  try {
    const { userId } = req.params;
    await pool.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 4001;
app.listen(PORT, () => console.log(`Cart service running on ${PORT}`));
