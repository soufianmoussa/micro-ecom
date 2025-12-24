const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = 4003;
const SECRET_KEY = 'supersecretkey';

const pool = new Pool({
    user: process.env.POSTGRES_USER || 'admin',
    host: process.env.POSTGRES_HOST || 'postgres',
    database: 'user_db',
    password: process.env.POSTGRES_PASSWORD || 'password',
    port: 5432,
});

// Init DB
const initDB = async () => {
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL,
        address TEXT,
        phone VARCHAR(20)
      );
    `);
        // Attempt to add columns if table existed but columns didn't (migration)
        try {
            await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT');
            await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)');
        } catch (e) { /* ignore if exists */ }

        console.log('User table initialized');
    } catch (err) {
        console.error('User DB Init Error:', err);
    }
};
setTimeout(initDB, 5000);

app.post('/auth/register', async (req, res) => {
    try {
        const { username, password, address, phone } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

        const result = await pool.query(
            'INSERT INTO users (username, password, address, phone) VALUES ($1, $2, $3, $4) RETURNING id, username, address, phone',
            [username, password, address || '', phone || '']
        );
        res.status(201).json({ message: 'User registered', user: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: 'User already exists' });
        res.status(500).json({ error: err.message });
    }
});

app.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await pool.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password]);
        if (result.rowCount === 0) return res.status(401).json({ error: 'Invalid credentials' });

        const user = result.rows[0];
        const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ token, user: { id: user.id, username: user.username, address: user.address, phone: user.phone } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/profile/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username, address, phone FROM users WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/profile/:id', async (req, res) => {
    try {
        const { address, phone } = req.body;
        const result = await pool.query(
            'UPDATE users SET address = $1, phone = $2 WHERE id = $3 RETURNING id, username, address, phone',
            [address, phone, req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => console.log(`User Service running on ${PORT}`));
