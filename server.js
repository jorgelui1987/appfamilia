'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';

app.use(cors());
app.use(express.json({ limit: '2mb' }));

let db = null;
function getDb() {
  if (!db) db = require('./db');
  return db;
}

function esc(s) {
  return String(s == null ? '' : s).slice(0, 2000);
}

async function initDb() {
  const d = getDb();
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await d.query(schema);
  const u = await d.query('SELECT COUNT(*)::int AS n FROM users');
  if (u.rows[0].n === 0) {
    await d.query(
      "INSERT INTO users (name, role, family, avatar) VALUES " +
      "('Carlos Castro','Papa','Familia Castro','https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80')," +
      "('Maria Perez','Tia','Familia Perez','https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80')"
    );
  }
  const c = await d.query('SELECT COUNT(*)::int AS n FROM channels');
  if (c.rows[0].n === 0) {
    await d.query(
      "INSERT INTO channels (id,name,subtitle,type,icon,color) VALUES " +
      "('gen','Chat General Familiar','Todos los integrantes','group','fa-users','bg-emerald-600')," +
      "('primos','Solo Primos','Lucas, Sofia y Mateo','group','fa-comments','bg-purple-600')"
    );
  }
  const p = await d.query('SELECT COUNT(*)::int AS n FROM posts');
  if (p.rows[0].n === 0) {
    const r = await d.query(
      "INSERT INTO posts (user_id,user_name,user_family,user_avatar,image_url,caption,tag) VALUES " +
      "(1,'Carlos Castro','Familia Castro','https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80','https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=800&q=80','Bienvenidos a MiFamilia con base de datos.','Cotidiano') RETURNING id"
    );
    await d.query('INSERT INTO comments (post_id,user_name,text) VALUES ($1,$2,$3)', [r.rows[0].id, 'Maria Perez', 'Que bueno que ya guardamos los recuerdos.']);
  }
}
app.get('/api/health', async (req, res) => {
  try {
    await getDb().query('SELECT 1');
    res.json({ ok: true, db: 'up' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    res.json((await getDb().query('SELECT * FROM users ORDER BY id')).rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/posts', async (req, res) => {
  try {
    const d = getDb();
    const posts = (await d.query('SELECT * FROM posts ORDER BY created_at DESC LIMIT 100')).rows;
    for (const p of posts) {
      const comments = await d.query('SELECT id,user_name AS "userName",text FROM comments WHERE post_id=$1 ORDER BY id', [p.id]);
      const likes = await d.query('SELECT user_id FROM likes WHERE post_id=$1', [p.id]);
      p.comments = comments.rows;
      p.likes = likes.rows.map((x) => x.user_id);
      p.userName = p.user_name; p.userFamily = p.user_family;
      p.userAvatar = p.user_avatar; p.imageUrl = p.image_url;
      p.timestamp = new Date(p.created_at).toLocaleString();
    }
    res.json(posts);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/posts', async (req, res) => {
  try {
    const d = getDb();
    const b = req.body || {};
    if (!b.caption || String(b.caption).trim().length < 3) return res.status(400).json({ error: 'caption minimo 3' });
    const u = (await d.query('SELECT * FROM users WHERE id=$1', [Number(b.userId) || 1])).rows[0];
    if (!u) return res.status(400).json({ error: 'usuario invalido' });
    const r = await d.query(
      'INSERT INTO posts (user_id,user_name,user_family,user_avatar,image_url,caption,tag) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [u.id, u.name, u.family, u.avatar, esc(b.imageUrl) || 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=800&q=80', esc(b.caption).slice(0, 500), esc(b.tag) || 'Cotidiano']
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/posts/:id/comments', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.text || !String(b.text).trim()) return res.status(400).json({ error: 'texto requerido' });
    const r = await getDb().query(
      'INSERT INTO comments (post_id,user_name,text) VALUES ($1,$2,$3) RETURNING id,user_name AS "userName",text',
      [Number(req.params.id), esc(b.userName).slice(0, 120) || 'Familiar', esc(b.text).slice(0, 300)]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/posts/:id/like', async (req, res) => {
  try {
    const d = getDb();
    const postId = Number(req.params.id);
    const userId = Number((req.body || {}).userId) || 1;
    const ex = await d.query('SELECT 1 FROM likes WHERE post_id=$1 AND user_id=$2', [postId, userId]);
    if (ex.rowCount > 0) {
      await d.query('DELETE FROM likes WHERE post_id=$1 AND user_id=$2', [postId, userId]);
      return res.json({ liked: false });
    }
    await d.query('INSERT INTO likes (post_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [postId, userId]);
    res.json({ liked: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/channels', async (req, res) => {
  try {
    res.json((await getDb().query('SELECT * FROM channels ORDER BY id')).rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/channels/:id/messages', async (req, res) => {
  try {
    const r = await getDb().query('SELECT sender,text,created_at FROM messages WHERE channel_id=$1 ORDER BY id LIMIT 200', [req.params.id]);
    res.json(r.rows.map((m) => ({ sender: m.sender, text: m.text, time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/channels/:id/messages', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.text || !String(b.text).trim()) return res.status(400).json({ error: 'texto requerido' });
    await getDb().query('INSERT INTO messages (channel_id,sender,text) VALUES ($1,$2,$3)', [req.params.id, esc(b.sender).slice(0, 120) || 'Familiar', esc(b.text).slice(0, 500)]);
    res.status(201).json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.use(express.static(path.join(__dirname)));

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not found' });
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => console.log('MiFamilia API en ' + HOST + ':' + PORT));
initDb().then(
  () => console.log('DB lista'),
  (e) => console.error('DB init fallo (app sigue arriba):', e.message)
);

