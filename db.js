'use strict';
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => console.error('PG pool error:', err.message));

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query };
