'use strict';
try { require('dotenv').config(); } catch (e) { /* dotenv opcional en Dokploy */ }
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

let db = null;
function getDb() {
  if (!db) db = require('./db');
  return db;
}

function esc(s, max) {
  return String(s == null ? '' : s).slice(0, max || 2000);
}
function escUrl(s) {
  return String(s == null ? '' : s);
}

async function initDb() {
  const d = getDb();
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  // Ejecuta cada sentencia por separado: si una falla (ej. tabla ya existe
  // sin la columna), las demas igual se aplican y el error queda en el log.
  const statements = schema.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
  for (const st of statements) {
    try {
      await d.query(st);
    } catch (e) {
      console.error('Schema stmt fallo (sigue):', e.message);
    }
  }
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
      "('gen','Chat General Familiar','Todos los integrantes','group','fa-users','bg-emerald-600')"
    );
  }
  // Limpieza: quita el grupo viejo 'Solo Primos' si quedo en la nube.
  try {
    await d.query("DELETE FROM messages WHERE channel_id='primos'");
  } catch (e) {}
  try {
    await d.query("DELETE FROM channels WHERE id='primos'");
  } catch (e) {}
  // Limpieza: quita 'Recetas de la Abuela' (ya no se usa).
  try {
    await d.query("DELETE FROM messages WHERE channel_id='recetas'");
  } catch (e) {}
  try {
    await d.query("DELETE FROM channels WHERE id='recetas'");
  } catch (e) {}
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
    console.error('HEALTH db down:', e.code || '', e.message);
    res.status(500).json({ ok: false, db: 'down', code: e.code || null, error: e.message, url: getDb().maskedUrl ? getDb().maskedUrl() : undefined });
  }
});

var ADMIN_PHONE = '+569 82209690';

app.get('/api/users', async (req, res) => {
  try {
    let rows;
    try {
      rows = (await getDb().query('SELECT id,name,role,family,avatar,birthdate,is_admin,phone FROM users ORDER BY id')).rows;
    } catch (e) {
      try {
        rows = (await getDb().query('SELECT id,name,role,family,avatar,birthdate FROM users ORDER BY id')).rows;
      } catch (e2) {
        rows = (await getDb().query('SELECT id,name,role,family,avatar FROM users ORDER BY id')).rows;
      }
    }
    // Nunca expone pass_hash; el telefono solo lo ve el admin.
    const meId = Number(req.query.meId) || 0;
    let iAmAdmin = false;
    try {
      if (meId) {
        const me = (await getDb().query('SELECT is_admin,phone FROM users WHERE id=$1', [meId])).rows[0];
        iAmAdmin = !!me && (Number(me.is_admin) === 1 || String(me.phone || '').replace(/\s/g, '') === '+56982209690');
      }
    } catch (e) {}
    res.json(rows.map((u) => ({
      id: u.id, name: u.name, role: u.role, family: u.family, avatar: u.avatar,
      birthdate: u.birthdate || '', is_admin: Number(u.is_admin) === 1,
      phone: iAmAdmin ? (u.phone || '') : ''
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

var COUNTRIES = [
  { code: '+52', name: 'Mexico', flag: '🇲🇽' },
  { code: '+57', name: 'Colombia', flag: '🇨🇴' },
  { code: '+34', name: 'Espana', flag: '🇪🇸' },
  { code: '+1', name: 'EE.UU.', flag: '🇺🇸' },
  { code: '+54', name: 'Argentina', flag: '🇦🇷' },
  { code: '+569', name: 'Chile movil', flag: '🇨🇱' },
  { code: '+56', name: 'Chile', flag: '🇨🇱' },
  { code: '+51', name: 'Peru', flag: '🇵🇪' },
  { code: '+58', name: 'Venezuela', flag: '🇻🇪' },
  { code: '+502', name: 'Guatemala', flag: '🇬🇹' },
  { code: '+503', name: 'El Salvador', flag: '🇸🇻' },
  { code: '+504', name: 'Honduras', flag: '🇭🇳' },
  { code: '+505', name: 'Nicaragua', flag: '🇳🇮' },
  { code: '+506', name: 'Costa Rica', flag: '🇨🇷' },
  { code: '+507', name: 'Panama', flag: '🇵🇦' },
  { code: '+593', name: 'Ecuador', flag: '🇪🇨' },
  { code: '+591', name: 'Bolivia', flag: '🇧🇴' },
  { code: '+595', name: 'Paraguay', flag: '🇵🇾' },
  { code: '+598', name: 'Uruguay', flag: '🇺🇾' },
  { code: '+55', name: 'Brasil', flag: '🇧🇷' }
];

function normPhone(prefix, number) {
  var digits = String(number || '').replace(/\D/g, '').slice(0, 15);
  return { phone: prefix + ' ' + digits, digits: digits };
}

function avatarFor(name) {
  var initial = encodeURIComponent((name || 'F').trim().charAt(0).toUpperCase() || 'F');
  return 'https://ui-avatars.com/api/?name=' + initial + '&background=10b981&color=fff&size=150';
}

// Crea el admin si aun no existe (para entrar la primera vez).
// POST /api/auth/seed-admin { name, phone, password, birthdate, family }
app.post('/api/auth/seed-admin', async (req, res) => {
  try {
    const b = req.body || {};
    const name = String(b.name || 'Admin').trim().slice(0, 80) || 'Admin';
    const pass = String(b.password || '');
    const birthdate = String(b.birthdate || '1980-01-01').slice(0, 10);
    const family = String(b.family || 'Mi Familia').trim().slice(0, 80) || 'Mi Familia';
    if (pass.length < 6) return res.status(400).json({ error: 'Contrasena minimo 6 caracteres' });
    const d = getDb();
    // Acepta el admin aunque venga con espacios, con +56 o +569: basta que termine en 82209690.
    const allDigits = String(b.prefix || '') + ' ' + String(b.phone || '');
    const onlyDigits = allDigits.replace(/\D/g, '');
    if (!onlyDigits.endsWith('82209690')) return res.status(403).json({ error: 'Solo el numero del admin (+569 82209690).' });
    const np = { phone: '+569 82209690', digits: '82209690' };
    const ex = (await d.query('SELECT id FROM users WHERE phone=$1', [np.phone])).rows[0];
    if (ex) {
      await d.query('UPDATE users SET is_admin=1 WHERE id=$1', [ex.id]);
      return res.json({ ok: true, created: false });
    }
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(pass, 10);
    try {
      await d.query(
        'INSERT INTO users (name,role,family,avatar,phone,pass_hash,birthdate,is_admin) VALUES ($1,$2,$3,$4,$5,$6,$7,1)',
        [name, 'Admin', family, avatarFor(name), np.phone, hash, birthdate]
      );
    } catch (e) {
      if (e.code === '23505') {
        await d.query('UPDATE users SET is_admin=1 WHERE phone=$1', [np.phone]);
        return res.json({ ok: true, created: false });
      }
      throw e;
    }
    res.status(201).json({ ok: true, created: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const b = req.body || {};
    const name = String(b.name || '').trim().slice(0, 80);
    const prefix = String(b.prefix || '+52').trim().slice(0, 6);
    const np = normPhone(prefix, b.phone);
    const pass = String(b.password || '');
    const family = String(b.family || 'Mi Familia').trim().slice(0, 80) || 'Mi Familia';
    const role = String(b.role || 'Familiar').trim().slice(0, 40) || 'Familiar';
    const birthdate = String(b.birthdate || '').slice(0, 10);
    let avatar = String(b.avatar || '').slice(0, 8 * 1024 * 1024);
    if (name.length < 2) return res.status(400).json({ error: 'Nombre minimo 2 caracteres' });
    if (!birthdate) return res.status(400).json({ error: 'Fecha de nacimiento requerida' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) return res.status(400).json({ error: 'Fecha de nacimiento invalida' });
    if (np.digits.length < 7) return res.status(400).json({ error: 'Numero de telefono invalido (minimo 7 digitos)' });
    if (pass.length < 6) return res.status(400).json({ error: 'Contrasena minimo 6 caracteres' });
    if (avatar && !/^data:image\/(jpeg|png|webp);base64,/.test(avatar) && !/^https?:\/\//.test(avatar)) {
      return res.status(400).json({ error: 'Foto de perfil invalida' });
    }
    if (!avatar) avatar = avatarFor(name);
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(pass, 10);
    const d = getDb();
    let row;
    // El numero del admin siempre queda como admin.
    const isAdmin = np.phone.replace(/\s/g, '') === '+56982209690' ? 1 : 0;
    try {
      try {
        const r = await d.query(
          'INSERT INTO users (name,role,family,avatar,phone,pass_hash,birthdate,is_admin) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,name,role,family,avatar,phone,birthdate,is_admin',
          [name, role, family, avatar, np.phone, hash, birthdate, isAdmin]
        );
        row = r.rows[0];
      } catch (e) {
        if (/birthdate|is_admin|column/i.test(e.message || '')) {
          try {
            const r = await d.query(
              'INSERT INTO users (name,role,family,avatar,phone,pass_hash) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,name,role,family,avatar,phone',
              [name, role, family, avatar, np.phone, hash]
            );
            row = r.rows[0];
            row.birthdate = birthdate;
            row.is_admin = isAdmin;
            try { await d.query('UPDATE users SET birthdate=$1,is_admin=$2 WHERE id=$3', [birthdate, isAdmin, row.id]); } catch (ee) {}
          } catch (e2) {
            if (e2.code === '23505') return res.status(409).json({ error: 'Ese numero ya esta registrado. Inicia sesion.' });
            throw e2;
          }
        } else throw e;
      }
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'Ese numero ya esta registrado. Inicia sesion.' });
      console.error('REGISTER fallo:', e.code, e.message);
      throw e;
    }
    res.status(201).json({ user: row });
  } catch (e) {
    console.error('REGISTER 500:', e.code || '', e.message || e);
    res.status(500).json({ error: (e.code ? e.code + ' ' : '') + (e.message || 'Error interno') });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const b = req.body || {};
    const prefix = String(b.prefix || '+52').trim().slice(0, 6);
    const np = normPhone(prefix, b.phone);
    const pass = String(b.password || '');
    if (!np.digits || !pass) return res.status(400).json({ error: 'Telefono y contrasena requeridos' });
    const d = getDb();
    const r = await d.query('SELECT * FROM users WHERE phone=$1', [np.phone]);
    const u = r.rows[0];
    if (!u || !u.pass_hash) return res.status(401).json({ error: 'Credenciales invalidas' });
    const bcrypt = require('bcryptjs');
    const ok = await bcrypt.compare(pass, u.pass_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciales invalidas' });
    // Si es el numero del admin pero aun no tiene la marca, la corrige.
    try {
      if (String(u.phone || '').replace(/\s/g, '') === '+56982209690' && Number(u.is_admin) !== 1) {
        await d.query('UPDATE users SET is_admin=1 WHERE id=$1', [u.id]);
        u.is_admin = 1;
      }
    } catch (e) {}
    res.json({ user: { id: u.id, name: u.name, role: u.role, family: u.family, avatar: u.avatar, phone: u.phone, birthdate: u.birthdate || '', is_admin: Number(u.is_admin) === 1 } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/reset', async (req, res) => {
  // Solo el ADMIN puede resetear claves. El familiar olvidado le escribe
  // por WhatsApp al admin y el admin le crea la clave temporal desde la app.
  // Body: { prefix, phone, newPassword, helperId }
  try {
    const b = req.body || {};
    const np = normPhone(String(b.prefix || '+52').trim().slice(0, 6), b.phone);
    const newPass = String(b.newPassword || '');
    const helperId = Number(b.helperId) || 0;
    if (np.digits.length < 7) return res.status(400).json({ error: 'Numero invalido' });
    if (newPass.length < 6) return res.status(400).json({ error: 'Nueva contrasena minimo 6 caracteres' });
    const d = getDb();
    const helper = (await d.query('SELECT id,name,is_admin,phone FROM users WHERE id=$1', [helperId])).rows[0];
    if (!helper) return res.status(403).json({ error: 'Solo el admin con sesion puede resetear claves.' });
    const helperIsAdmin = Number(helper.is_admin) === 1 || String(helper.phone || '').replace(/\s/g, '') === '+56982209690';
    if (!helperIsAdmin) return res.status(403).json({ error: 'Solo el admin puede resetear claves. Escribele por WhatsApp al +569 82209690.' });
    const target = (await d.query('SELECT id,name FROM users WHERE phone=$1', [np.phone])).rows[0];
    if (!target) return res.status(404).json({ error: 'Ese numero no esta registrado.' });
    if (target.id === helperId) return res.status(400).json({ error: 'Ya estas dentro: cambia tu clave desde tu perfil.' });
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(newPass, 10);
    await d.query('UPDATE users SET pass_hash=$1 WHERE id=$2', [hash, target.id]);
    console.log('RESET clave para ' + target.name + ' ayudado por ' + helper.name);
    res.json({ ok: true, name: target.name });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/users/:id/avatar', async (req, res) => {
  try {
    const avatar = String((req.body || {}).avatar || '').slice(0, 8 * 1024 * 1024);
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(avatar)) {
      return res.status(400).json({ error: 'Foto invalida. Usa JPG, PNG o WEBP.' });
    }
    const r = await getDb().query(
      'UPDATE users SET avatar=$1 WHERE id=$2 RETURNING id,name,role,family,avatar,phone',
      [avatar, Number(req.params.id)]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ user: r.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Backup solo-admin: descarga todo (usuarios sin claves, fotos, chats).
// El admin lo guarda cada semana en su PC/Drive.
app.get('/api/admin/backup', async (req, res) => {
  try {
    const adminId = Number(req.query.adminId) || 0;
    const d = getDb();
    const admin = (await d.query('SELECT id,is_admin,phone FROM users WHERE id=$1', [adminId])).rows[0];
    const ok = !!admin && (Number(admin.is_admin) === 1 || String(admin.phone || '').replace(/\s/g, '') === '+56982209690');
    if (!ok) return res.status(403).json({ error: 'Solo el admin puede descargar el respaldo.' });
    const users = (await d.query('SELECT id,name,role,family,avatar,birthdate,phone,created_at FROM users ORDER BY id')).rows;
    const posts = (await d.query('SELECT * FROM posts ORDER BY id')).rows;
    for (const p of posts) {
      p.comments = (await d.query('SELECT id,user_name,text,created_at FROM comments WHERE post_id=$1 ORDER BY id', [p.id])).rows;
      p.likes = (await d.query('SELECT user_id FROM likes WHERE post_id=$1', [p.id])).rows.map((x) => x.user_id);
    }
    const channels = (await d.query('SELECT * FROM channels ORDER BY id')).rows;
    let messages = [];
    try {
      messages = (await d.query('SELECT id,channel_id,sender,text,LEFT(image_url,200000) AS image_url,created_at FROM messages ORDER BY id LIMIT 2000')).rows;
    } catch (e) {
      messages = (await d.query('SELECT id,channel_id,sender,text,created_at FROM messages ORDER BY id LIMIT 2000')).rows;
    }
    res.json({ app: 'MiFamilia', at: new Date().toISOString(), users, posts, channels, messages });
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
      [u.id, u.name, u.family, u.avatar, escUrl(b.imageUrl) || 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=800&q=80', esc(b.caption, 500), esc(b.tag) || 'Cotidiano']
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

app.post('/api/channels/dm', async (req, res) => {
  // Crea el canal privado dm-A-B si no existe (solo lo ven esos dos).
  try {
    const b = req.body || {};
    const id = String(b.id || '').slice(0, 40);
    const m = /^dm-(\d+)-(\d+)$/.exec(id);
    if (!m) return res.status(400).json({ error: 'canal invalido' });
    const d = getDb();
    const ex = await d.query('SELECT * FROM channels WHERE id=$1', [id]);
    if (ex.rows[0]) return res.json(ex.rows[0]);
    const peer = (await d.query('SELECT id,name,avatar FROM users WHERE id=$1', [Number(b.peerId)])).rows[0];
    if (!peer) return res.status(404).json({ error: 'familiar no encontrado' });
    const r = await d.query(
      "INSERT INTO channels (id,name,subtitle,type,icon,color,avatar) VALUES ($1,$2,'Chat privado · solo ustedes dos','direct','','',$3) RETURNING *",
      [id, peer.name, peer.avatar || '']
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/channels/:id/messages', async (req, res) => {
  try {
    let rows;
    try {
      rows = (await getDb().query('SELECT sender,text,image_url,created_at FROM messages WHERE channel_id=$1 ORDER BY id LIMIT 200', [req.params.id])).rows;
    } catch (e) {
      // Si la columna image_url aun no existe (DB vieja), lee sin ella.
      rows = (await getDb().query('SELECT sender,text,created_at FROM messages WHERE channel_id=$1 ORDER BY id LIMIT 200', [req.params.id])).rows;
    }
    res.json(rows.map((m) => ({ sender: m.sender, text: m.text || '', imageUrl: m.image_url || '', time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/channels/:id/messages', async (req, res) => {
  try {
    const b = req.body || {};
    const text = String(b.text || '').trim();
    const imageUrl = String(b.imageUrl || '').slice(0, 350000);
    if (!text && !imageUrl) return res.status(400).json({ error: 'texto o foto requerido' });
    try {
      await getDb().query('INSERT INTO messages (channel_id,sender,text,image_url) VALUES ($1,$2,$3,$4)', [req.params.id, esc(b.sender).slice(0, 120) || 'Familiar', esc(text).slice(0, 500), imageUrl]);
    } catch (e) {
      // DB vieja sin columna image_url: guarda como texto con marcador.
      if (imageUrl && /image_url|column/i.test(e.message || '')) {
        await getDb().query('INSERT INTO messages (channel_id,sender,text) VALUES ($1,$2,$3)', [req.params.id, esc(b.sender).slice(0, 120) || 'Familiar', (text ? esc(text).slice(0, 400) + ' ' : '') + '[foto]']);
      } else if (!imageUrl) {
        await getDb().query('INSERT INTO messages (channel_id,sender,text) VALUES ($1,$2,$3)', [req.params.id, esc(b.sender).slice(0, 120) || 'Familiar', esc(text).slice(0, 500)]);
      } else throw e;
    }
    notifyChannel(req.params.id);
    res.status(201).json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Presencia estilo WhatsApp: quien esta con la app abierta sale "en linea".
// Memoria en el servidor (se pierde al redeploy, no pasa nada: se rellena solo).
const presence = new Map(); // userId -> lastSeenMs
app.post('/api/presence', async (req, res) => {
  try {
    const id = Number((req.body || {}).userId) || 0;
    if (!id) return res.status(400).json({ error: 'userId requerido' });
    presence.set(id, Date.now());
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/presence', async (req, res) => {
  try {
    const now = Date.now();
    const online = [];
    presence.forEach((ts, id) => {
      if (now - ts < 45000) online.push(id);
      else presence.delete(id);
    });
    res.json({ online });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Tiempo real simple con SSE: avisa a la PWA cuando hay mensaje nuevo.
const sseClients = [];
function notifyChannel(channelId) {
  const payload = 'data: ' + JSON.stringify({ channel: channelId, at: Date.now() }) + '\n\n';
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try { sseClients[i].res.write(payload); }
    catch (e) { sseClients.splice(i, 1); }
  }
}

app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write('retry: 5000\n\n');
  const client = { res };
  sseClients.push(client);
  req.on('close', () => {
    const i = sseClients.indexOf(client);
    if (i > -1) sseClients.splice(i, 1);
  });
});

app.use(express.static(path.join(__dirname), {
  setHeaders: function (res, filePath) {
    if (filePath.endsWith('sw.js')) res.setHeader('Service-Worker-Allowed', '/');
    if (filePath.endsWith('.webmanifest')) res.setHeader('Content-Type', 'application/manifest+json');
  }
}));

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not found' });
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => console.log('MiFamilia API en ' + HOST + ':' + PORT));
initDb().then(
  () => console.log('DB lista'),
  (e) => console.error('DB init fallo (app sigue arriba):', e.message)
);

