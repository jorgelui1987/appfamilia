'use strict';
const { Pool } = require('pg');

function buildUrlFromParts() {
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || '5432';
  const db = process.env.DB_DATABASE;
  const user = process.env.DB_USERNAME;
  const pass = process.env.DB_PASSWORD;
  if (!host || !db || !user) return '';
  // encodeURIComponent protege el @ y caracteres raros del password.
  return 'postgresql://' + encodeURIComponent(user) + ':' + encodeURIComponent(pass || '') + '@' + host + ':' + port + '/' + db;
}

function effectiveUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  return buildUrlFromParts();
}

function maskedUrl() {
  const raw = effectiveUrl();
  return raw.replace(/:\/\/([^:]+):([^@]*)@/i, '://$1:***@');
}

if (!effectiveUrl()) {
  console.error('FALTA DB: ni DATABASE_URL ni DB_HOST/DB_DATABASE/DB_USERNAME estan configuradas');
} else {
  try {
    const u = new URL(effectiveUrl());
    console.log('DB config -> host:' + u.hostname + ' port:' + (u.port || '5432') + ' db:' + u.pathname.replace('/', '') + ' user:' + u.username);
  } catch (e) {
    console.error('DB URL mal formada:', e.message, '| valor (enmascarado):', maskedUrl());
  }
}

const pool = new Pool({
  connectionString: effectiveUrl() || undefined,
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
