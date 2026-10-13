'use strict';
/* MiFamilia — Backend: sincroniza Store (local) con /api (Postgres). */
var Backend = (function (Store) {
  function normalizePost(p) {
    p.userName = p.userName || p.user_name || 'Familiar';
    p.userFamily = p.userFamily || p.user_family || '';
    p.userAvatar = p.userAvatar || p.user_avatar || '';
    p.imageUrl = p.imageUrl || p.image_url || '';
    p.timestamp = p.timestamp || (p.created_at ? new Date(p.created_at).toLocaleString() : 'Ahora');
    p.likes = p.likes || [];
    p.comments = p.comments || [];
    return p;
  }

  function setSyncBadge(mode) {
    var badge = document.getElementById('sync-badge');
    var dot = document.getElementById('sync-dot');
    var txt = document.getElementById('sync-text');
    if (!badge || !dot || !txt) return;
    if (mode === 'cloud') {
      txt.textContent = 'Nube';
      dot.className = 'w-2 h-2 rounded-full bg-emerald-400';
      badge.className = 'hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
      badge.title = 'Conectado a la base de datos: todo se comparte entre PC y celular';
    } else {
      txt.textContent = 'Local';
      dot.className = 'w-2 h-2 rounded-full bg-amber-400';
      badge.className = 'hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-300';
      badge.title = 'Sin base de datos: solo ves lo de este dispositivo. Revisa Postgres en Dokploy.';
    }
  }

  async function syncLocalPosts() {
    // Sube los posts creados en modo local cuando el servidor vuelve.
    let pend = [];
    try { pend = Store.posts.filter((p) => p.local); } catch (e) { pend = []; }
    if (!pend.length) return;
    let ok = 0;
    for (const p of pend) {
      try {
        await Api.createPost({ userId: p.userId, caption: p.caption, tag: p.tag, imageUrl: p.imageUrl });
        ok++;
        Store.posts = Store.posts.filter((x) => x !== p);
      } catch (e) { break; }
    }
    if (ok > 0) {
      try {
        const posts = (await Api.posts()).map(normalizePost);
        Store.posts.length = 0;
        posts.forEach((x) => Store.posts.push(x));
        loadLocalPosts();
      } catch (e) {}
      App.toast('Sincronizados ' + ok + ' recuerdos a la nube');
    }
  }

  async function load() {
    try {
      await Api.health();
      const users = await Api.users();
      const posts = await Api.posts();
      const channels = await Api.channels();
      if (users && users.length) {
        // Fusiona servidor + locales: no borra tus cuentas del dispositivo.
        users.forEach((u) => {
          const ex = Store.getUser(u.id);
          if (!ex) Store.users.push(u);
          else { ex.name = u.name; ex.role = u.role; ex.family = u.family; ex.avatar = u.avatar; }
        });
        // Dedupe usuarios por nombre (ej. 'Carlos' local + 'Carlos Castro' nube):
        // fusiona al de id menor y deja 1 por persona para no duplicar privados.
        try {
          const seenName = {};
          const dupIds = [];
          Store.users.forEach((u) => {
            const k = String(u.name || '').trim().toLowerCase();
            if (!k) return;
            if (!seenName[k]) seenName[k] = u;
            else {
              const keep = Number(seenName[k].id) <= Number(u.id) ? seenName[k] : u;
              const drop = keep === seenName[k] ? u : seenName[k];
              seenName[k] = keep;
              dupIds.push(String(drop.id));
              if (String(Store.state.currentUserId) === String(drop.id)) Store.state.currentUserId = keep.id;
            }
          });
          if (dupIds.length) {
            for (let i = Store.users.length - 1; i >= 0; i--) {
              if (dupIds.indexOf(String(Store.users[i].id)) > -1) Store.users.splice(i, 1);
            }
          }
        } catch (e) {}
        if (!Store.getUser(Store.state.currentUserId)) Store.state.currentUserId = Store.users[0].id;
      }
      if (posts) {
        Store.posts.length = 0;
        posts.map(normalizePost).forEach((p) => Store.posts.push(p));
      }
      if (channels && channels.length) {
        // Grupo viejo eliminado: nunca mostrar 'primos' aunque siga en la nube.
        const clean = channels.filter((c) => String(c.id) !== 'primos');
        const keepDM = Store.channels.filter((c) => c.dm && /^dm-(\d+)-(\d+)$/.test(String(c.id)));
        Store.channels.length = 0;
        clean.forEach((c) => {
          if (String(c.id).startsWith('dm-')) c.dm = true;
          Store.channels.push(c);
        });
        // Legacy viejo ('maria','Tia Maria'...): NO reponerlo, ya hay dm-A-B.
        // Limpia tambien mensajes locales huerfanos de esos ids.
        try {
          Object.keys(Store.messages || {}).forEach((k) => {
            if (k === 'primos' || (k === 'maria' && !clean.some((c) => String(c.id) === 'maria'))) delete Store.messages[k];
          });
        } catch (e) {}
        // Repone los DM locales que el servidor aun no conoce.
        keepDM.forEach((dm) => {
          const exists = Store.channels.some((c) => String(c.id) === String(dm.id));
          if (!exists) Store.channels.push(dm);
        });
        const ids = clean.map((c) => c.id);
        if (ids.indexOf(Store.state.activeChatId) === -1) Store.state.activeChatId = ids[0];
        for (const c of clean) {
          try {
            const srv = await Api.messages(c.id);
            Store.messages[c.id] = srv;
            mergeMsgs(c.id, srv);
          }
          catch (e) { if (!Store.messages[c.id]) Store.messages[c.id] = []; }
        }
      }
      Store.backend.ok = true;
      setSyncBadge('cloud');
      await syncLocalPosts();
      try { document.dispatchEvent(new CustomEvent('mf-backend-ready')); } catch (e) {}
    } catch (e) {
      Store.backend.ok = false;
      setSyncBadge('local');
    }
    loadLocalPosts();
    if (typeof AppChat !== 'undefined' && AppChat.restoreDMs) AppChat.restoreDMs();
    loadLocalMsgs();
    // Marca lo cargado como ya visto + asegura 1 DM por familiar.
    try {
      if (typeof AppChat !== 'undefined' && AppChat.ensureDMsForAllUsers) AppChat.ensureDMsForAllUsers();
    } catch (e) {}
    try {
      if (typeof AppChat !== 'undefined' && AppChat.markAllSeenNow) AppChat.markAllSeenNow();
    } catch (e) {}
    try {
      if (typeof AppChat !== 'undefined' && AppChat.renderChannels) AppChat.renderChannels();
    } catch (e) {}
    try {
      if (typeof AppChat !== 'undefined' && AppChat.refreshTabBadge) AppChat.refreshTabBadge();
    } catch (e) {}
  }

  async function refreshPosts() {
    if (!Store.backend.ok) return;
    try {
      const posts = (await Api.posts()).map(normalizePost);
      // Conserva fotos locales: la nube no las conoce y si las borramos
      // se pierden comentarios/likes hechos en este dispositivo.
      const locals = Store.posts.filter((p) => !/^\d+$/.test(String(p.id)));
      Store.posts.length = 0;
      posts.forEach((p) => Store.posts.push(p));
      locals.forEach((lp) => {
        if (!Store.posts.some((p) => String(p.id) === String(lp.id))) Store.posts.push(lp);
      });
      loadLocalPosts();
      // Dedupe comentarios (el optimista 'tmp-...' + el que llego de la nube).
      Store.posts.forEach((p) => {
        if (!Array.isArray(p.comments)) return;
        const seen = {};
        p.comments = p.comments.filter((c) => {
          const k = String(c.userName) + '|' + String(c.text);
          if (seen[k]) return false;
          seen[k] = true;
          return true;
        });
      });
    } catch (e) { /* conserva datos locales */ }
  }

  function normMsg(m) {
    return {
      sender: m.sender || 'Familiar',
      text: m.text || '',
      imageUrl: m.imageUrl || m.image_url || '',
      time: m.time || '',
      local: !!m.local
    };
  }

  function mergeMsgs(id, serverMsgs) {
    const local = (Store.messages[id] || []).filter((m) => m.local).map(normMsg);
    const seen = {};
    const out = [];
    (serverMsgs || []).map(normMsg).forEach((m) => {
      const k = m.sender + '|' + m.text + '|' + String(m.imageUrl || '').slice(-40) + '|' + m.time;
      if (!seen[k]) { seen[k] = true; out.push(m); }
    });
    local.forEach((m) => {
      const k = m.sender + '|' + m.text + '|' + String(m.imageUrl || '').slice(-40) + '|' + m.time;
      if (!seen[k]) { seen[k] = true; out.push(m); }
    });
    Store.messages[id] = out;
    saveLocalMsgs();
  }

  async function refreshMessages(id) {
    if (!Store.backend.ok) return;
    try {
      const srv = await Api.messages(id);
      mergeMsgs(id, srv);
    } catch (e) { /* conserva datos locales */ }
  }

  async function toggleLike(postId) {
    try {
      // Solo intenta en la nube si el id es numerico (los 'local-...' no existen alla).
      if (!/^\d+$/.test(String(postId))) throw new Error('local');
      await Api.like(postId, Store.state.currentUserId); await refreshPosts();
    }
    catch (e) {
      Store.posts.forEach(function (p) {
        if (String(p.id) !== String(postId)) return;
        p.likes = p.likes || [];
        var i = p.likes.indexOf(Store.state.currentUserId);
        if (i > -1) p.likes.splice(i, 1);
        else p.likes.push(Store.state.currentUserId);
      });
      saveLocalPosts();
    }
  }

  async function addComment(postId, text) {
    const me = Store.currentUser();
    const clean = String(text).slice(0, 300);
    // 1) Pintalo al instante (optimista) para que nunca parezca que no sirvio.
    Store.posts.forEach(function (p) {
      if (String(p.id) !== String(postId)) return;
      p.comments = p.comments || [];
      p.comments.push({ id: 'tmp-' + Date.now(), userName: me.name, text: clean });
    });
    // Fotos locales: solo guarda en el dispositivo.
    if (!/^\d+$/.test(String(postId))) { saveLocalPosts(); return { local: true }; }
    try {
      await Api.comment(postId, { userName: me.name, text: clean });
      await refreshPosts();
      // Si la nube no trajo el comentario (ej. fallo silencioso), conserva el optimista.
      let found = null;
      Store.posts.forEach(function (p) { if (String(p.id) === String(postId)) found = p; });
      if (found && !(found.comments || []).some((c) => c.text === clean && c.userName === me.name)) {
        found.comments.push({ id: Date.now(), userName: me.name, text: clean });
        saveLocalPosts();
      }
      return { ok: true };
    } catch (e) {
      // Sin servidor: queda el optimista + guarda local.
      saveLocalPosts();
      return { local: true };
    }
  }

  function saveLocalPosts() {
    try {
      // Guarda max 12 fotos locales (las data: pesan MBs y llenan el localStorage
      // -> ahi las fotos se ponian en blanco al bajar). Recorta imagenes gigantes.
      const slim = Store.posts.filter((p) => p.local || !/^\d+$/.test(String(p.id))).slice(0, 12).map((p) => ({
        id: p.id, userId: p.userId, userName: p.userName, userFamily: p.userFamily,
        userAvatar: String(p.userAvatar || '').slice(0, 20000),
        imageUrl: String(p.imageUrl || '').slice(0, 350000),
        caption: p.caption, tag: p.tag, timestamp: p.timestamp, likes: p.likes || [],
        comments: (p.comments || []).slice(-20), local: true
      }));
      try {
        localStorage.setItem('mf-local-posts', JSON.stringify(slim));
      } catch (e) {
        // Cuota llena: guarda sin imagenes (texto + comentarios) antes que perder todo.
        const tiny = slim.map((p) => ({ ...p, imageUrl: '', userAvatar: '' }));
        try { localStorage.setItem('mf-local-posts', JSON.stringify(tiny)); } catch (e2) {}
      }
    } catch (e) {}
  }

  function loadLocalPosts() {
    try {
      const raw = JSON.parse(localStorage.getItem('mf-local-posts') || '[]');
      if (Array.isArray(raw)) {
        raw.forEach((lp) => {
          const exists = Store.posts.some((p) => String(p.id) === String(lp.id));
          if (!exists) Store.posts.unshift(normalizePost(lp));
        });
      }
    } catch (e) {}
  }

  function saveLocalMsgs() {
    try {
      const slim = {};
      Object.keys(Store.messages || {}).forEach((k) => {
        // Las fotos pesan mucho: en local guarda max 30 por chat y recorta.
        slim[k] = (Store.messages[k] || []).slice(-30).map((m) => ({
          sender: m.sender, text: String(m.text || '').slice(0, 500),
          imageUrl: String(m.imageUrl || m.image_url || '').slice(0, 120000),
          time: m.time, local: !!m.local
        }));
      });
      try {
        localStorage.setItem('mf-local-msgs', JSON.stringify(slim));
      } catch (e) {
        // Cuota llena: guarda sin fotos antes que perder los textos.
        const tiny = {};
        Object.keys(slim).forEach((k) => {
          tiny[k] = slim[k].map((m) => ({ sender: m.sender, text: m.text, imageUrl: '', time: m.time, local: m.local }));
        });
        try { localStorage.setItem('mf-local-msgs', JSON.stringify(tiny)); } catch (e2) {}
      }
    } catch (e) {}
  }

  function loadLocalMsgs() {
    try {
      const raw = JSON.parse(localStorage.getItem('mf-local-msgs') || '{}');
      Object.keys(raw || {}).forEach((k) => {
        if (!Array.isArray(Store.messages[k]) || !Store.messages[k].length) {
          Store.messages[k] = raw[k];
        } else {
          const seen = {};
          Store.messages[k].forEach((m) => { seen[m.sender + '|' + m.text + '|' + m.time] = true; });
          raw[k].forEach((m) => {
            const key = m.sender + '|' + m.text + '|' + m.time;
            if (!seen[key]) Store.messages[k].push(m);
          });
        }
      });
    } catch (e) {}
  }

  async function createPost(data) {
    try {
      const res = await Api.createPost(data);
      await refreshPosts();
      return res;
    } catch (e) {
      // Sin servidor: publica en modo local y sigue funcionando.
      const me = Store.currentUser();
      const post = normalizePost({
        id: 'local-' + Date.now(), userId: me.id, userName: me.name,
        userFamily: me.family, userAvatar: me.avatar,
        imageUrl: data.imageUrl || '', caption: data.caption, tag: data.tag || 'Cotidiano',
        timestamp: 'Ahora', likes: [], comments: [], local: true
      });
      Store.posts.unshift(post);
      saveLocalPosts();
      return { local: true, post };
    }
  }

  async function sendMessage(channelId, text, imageUrl) {
    const img = String(imageUrl || '').slice(0, 350000);
    // Si es DM y hay nube, asegura el canal en Postgres antes de enviar.
    if (Store.backend.ok && String(channelId).startsWith('dm-')) {
      try {
        const m = /^dm-(\d+)-(\d+)$/.exec(String(channelId));
        const me = String(Store.currentUser().id);
        const peerId = m ? (String(m[1]) === me ? m[2] : m[1]) : null;
        if (peerId) {
          await Api.createDM(channelId, Number(peerId));
        }
      } catch (e) { /* sigue: el POST del mensaje lo intentara igual */ }
    }
    try {
      await Api.sendMessage(channelId, { sender: Store.currentUser().name, text: text || '', imageUrl: img });
      await refreshMessages(channelId);
      saveLocalMsgs();
    } catch (e) {
      Store.messages[channelId] = Store.messages[channelId] || [];
      Store.messages[channelId].push({
        sender: Store.currentUser().name,
        text: text || '',
        imageUrl: img,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        local: true
      });
      saveLocalMsgs();
    }
  }

  return { load, refreshPosts, refreshMessages, toggleLike, addComment, createPost, sendMessage };
})(Store);
