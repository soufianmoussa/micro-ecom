const express = require('express');
const cors = require('cors');
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
  database: 'product_db',
  password: process.env.POSTGRES_PASSWORD || 'password',
  port: process.env.POSTGRES_PORT || 5432,
});

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'product-service' });
});

app.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready', service: 'product-service' });
  } catch (err) {
    res.status(503).json({ status: 'not-ready', error: err.message });
  }
});

// Init DB
const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT
      );
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        description TEXT,
        category_id INTEGER REFERENCES categories(id),
        image_url TEXT
      );
    `);

    // Seed if empty
    const { rowCount } = await pool.query('SELECT * FROM categories');
    // Always sync products to ensure images are updated
    // categories
    const cats = await pool.query(`
        INSERT INTO categories (name, description) VALUES 
        ('Electronics', 'Gadgets and devices'),
        ('Clothing', 'Apparel and fashion'),
        ('Home', 'Home and living')
        ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
        RETURNING *;
      `);

    const catMap = {};
    // Fetch all to ensure we have IDs even if they existed
    const allCats = await pool.query('SELECT * FROM categories');
    allCats.rows.forEach(c => catMap[c.name] = c.id);

    // Products
    const products = [
      { id: 'p1', name: 'Smart Watch', price: 199.99, description: 'Advanced fitness tracking', category: 'Electronics', image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=500&q=80' },
      { id: 'p2', name: 'Wireless Earbuds', price: 89.99, description: 'High fidelity sound', category: 'Electronics', image_url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=500&q=80' },
      { id: 'p3', name: 'Cotton Hoodie', price: 45.00, description: 'Comfortable casual wear', category: 'Clothing', image_url: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=500&q=80' },
      { id: 'p4', name: 'Denim Jeans', price: 59.99, description: 'Classic blue jeans', category: 'Clothing', image_url: 'https://images.unsplash.com/photo-1542272617-08f0863200ed?auto=format&fit=crop&w=500&q=80' },
      { id: 'p5', name: 'Pour-Over Maker', price: 120.00, description: 'Brew the perfect cup', category: 'Home', image_url: 'https://images.unsplash.com/photo-1520970014086-2208d1579ff7?auto=format&fit=crop&w=500&q=80' },
      { id: 'p6', name: 'Modern Desk Lamp', price: 25.50, description: 'LED adjustable lamp', category: 'Home', image_url: 'https://images.unsplash.com/photo-1507473888900-52e1adad54cd?auto=format&fit=crop&w=500&q=80' },
      { id: 'p7', name: 'Gaming Mouse', price: 49.99, description: 'RGB high precision', category: 'Electronics', image_url: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=500&q=80' },
      { id: 'p8', name: 'Graphic Tee', price: 20.00, description: 'Cool design print', category: 'Clothing', image_url: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&w=500&q=80' },
      { id: 'p9', name: '4K Monitor', price: 299.99, description: 'Ultra HD Display', category: 'Electronics', image_url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=500&q=80' },
      { id: 'p10', name: 'Leather Wallet', price: 35.00, description: 'Genuine leather', category: 'Clothing', image_url: 'https://images.unsplash.com/photo-1627123424574-18bd75f3194c?auto=format&fit=crop&w=500&q=80' },
      { id: 'p11', name: 'Ceramic Pot', price: 15.00, description: 'Minimalist plant pot', category: 'Home', image_url: 'https://images.unsplash.com/photo-1485955900006-10f5132d7586?auto=format&fit=crop&w=500&q=80' },
      { id: 'p12', name: 'Mechanical Keyboard', price: 89.00, description: 'Clicky switches', category: 'Electronics', image_url: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=500&q=80' }
    ];

    for (const p of products) {
      await pool.query(
        `INSERT INTO products (id, name, price, description, category_id, image_url) 
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET 
             name = EXCLUDED.name,
             price = EXCLUDED.price,
             description = EXCLUDED.description,
             category_id = EXCLUDED.category_id,
             image_url = EXCLUDED.image_url`,
        [p.id, p.name, p.price, p.description, catMap[p.category], p.image_url]
      );
    }
    console.log('Seeding synced.');
  } catch (err) {
    console.error('DB Init Error:', err);
  }
};

// Wait for DB to be ready
setTimeout(initDB, 5000);

app.get('/products', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const offset = (page - 1) * limit;

    // Filters
    const { category, search, minPrice, maxPrice, sort } = req.query;

    let baseQuery = 'FROM products p LEFT JOIN categories c ON p.category_id = c.id';
    let whereClauses = [];
    let params = [];

    // 1. Category
    if (category) {
      params.push(category);
      whereClauses.push(`c.name = $${params.length}`);
    }

    // 2. Search
    if (search) {
      params.push(`%${search}%`);
      whereClauses.push(`(p.name ILIKE $${params.length} OR p.description ILIKE $${params.length})`);
    }

    // 3. Price
    if (minPrice) {
      params.push(minPrice);
      whereClauses.push(`p.price >= $${params.length}`);
    }
    if (maxPrice) {
      params.push(maxPrice);
      whereClauses.push(`p.price <= $${params.length}`);
    }

    // Assemble WHERE
    if (whereClauses.length > 0) {
      baseQuery += ' WHERE ' + whereClauses.join(' AND ');
    }

    // Sorting
    let orderBy = 'ORDER BY p.id ASC'; // Default
    if (sort === 'price_asc') orderBy = 'ORDER BY p.price ASC';
    else if (sort === 'price_desc') orderBy = 'ORDER BY p.price DESC';
    else if (sort === 'newest') orderBy = 'ORDER BY p.id DESC'; // Assuming ID roughly correlates to time or added time if we had it

    // Get Total Count
    const countRes = await pool.query(`SELECT COUNT(*) ${baseQuery}`, params);
    const total = parseInt(countRes.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    // Get Data
    const dataQuery = `SELECT p.*, c.name as category_name ${baseQuery} ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const dataParams = [...params, limit, offset];

    const result = await pool.query(dataQuery, dataParams);

    res.json({
      products: result.rows,
      meta: {
        total,
        page,
        totalPages,
        limit
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/products/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Product service running on ${PORT}`));
