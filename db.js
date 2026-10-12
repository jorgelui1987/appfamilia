'use strict';
const { Pool } = require('pg');

function maskedUrl() {
  const raw = process.env.DATABASE_URL || '';
  // Oculta password para logs: postgresql://user:***@host:port/db
  return raw.replace(/:\/\/([^:]+):([^@]*)@/i, '://$1:***@');
}

if (!process.env.DATABASE_URL) {
  console.error('FALTA DATABASE_URL en variables de entorno de Dokploy');
} else {
  try {
    const u = new URL(process.env.DATABASE_URL);
    console.log('DB config -> host:' + u.hostname + ' port:' + (u.port || '5432') + ' db:' + u.pathname.replace('/', '') + ' user:' + u.username);
  } catch (e) {
    console.error('DATABASE_URL mal formada:', e.message, '| valor (enmascarado):', maskedUrl());
  }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 8000,
  idleTimeoutMillis: 30000,
  max: 10
});

pool.on('error', (err) => console.error('PG pool error:', err.code || '', err.message));
pool.on('connect', () => console.log('PG pool: nueva conexion OK'));

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query, maskedUrl };
