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
      badge.className = 'hidden sm:inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
      badge.title = 'Conectado a la base de datos: todo se comparte entre PC y celular';
    } else {
      txt.textContent = 'Local';
      dot.className = 'w-2 h-2 rounded-full bg-amber-400';
      badge.className = 'hidden sm:inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-300';
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
        Store.users.length = 0;
        users.forEach((u) => Store.users.push(u));
        if (!Store.getUser(Store.state.currentUserId)) Store.state.currentUserId = Store.users[0].id;
      }
      if (posts) {
        Store.posts.length = 0;
        posts.map(normalizePost).forEach((p) => Store.posts.push(p));
      }
      if (channels && channels.length) {
        Store.channels.length = 0;
        channels.forEach((c) => {
          if (String(c.id).startsWith('dm-')) c.dm = true;
          Store.channels.push(c);
        });
        const ids = channels.map((c) => c.id);
        if (ids.indexOf(Store.state.activeChatId) === -1) Store.state.activeChatId = ids[0];
        for (const c of channels) {
          try { Store.messages[c.id] = await Api.messages(c.id); }
          catch (e) { if (!Store.messages[c.id]) Store.messages[c.id] = []; }
        }
      }
      Store.backend.ok = true;
      setSyncBadge('cloud');
      await syncLocalPosts();
    } catch (e) {
      Store.backend.ok = false;
      setSyncBadge('local');
    }
    loadLocalPosts();
    loadLocalMsgs();
  }

  async function refreshPosts() {
    if (!Store.backend.ok) return;
    try {
      const posts = (await Api.posts()).map(normalizePost);
      Store.posts.length = 0;
      posts.forEach((p) => Store.posts.push(p));
    } catch (e) { /* conserva datos locales */ }
  }

  async function refreshMessages(id) {
    if (!Store.backend.ok) return;
    try { Store.messages[id] = await Api.messages(id); }
    catch (e) { /* conserva datos locales */ }
  }

  async function toggleLike(postId) {
    try { await Api.like(postId, Store.state.currentUserId); await refreshPosts(); }
    catch (e) {
      Store.posts.forEach(function (p) {
        if (p.id !== Number(postId)) return;
        var i = p.likes.indexOf(Store.state.currentUserId);
        if (i > -1) p.likes.splice(i, 1);
        else p.likes.push(Store.state.currentUserId);
      });
    }
  }

  async function addComment(postId, text) {
    try {
      await Api.comment(postId, { userName: Store.currentUser().name, text: text });
      await refreshPosts();
    } catch (e) {
      Store.posts.forEach(function (p) {
        if (p.id !== Number(postId)) return;
        p.comments.push({ id: Date.now(), userName: Store.currentUser().name, text: text });
      });
    }
  }

  function saveLocalPosts() {
    try {
      const slim = Store.posts.slice(0, 30).map((p) => ({
        id: p.id, userId: p.userId, userName: p.userName, userFamily: p.userFamily,
        userAvatar: String(p.userAvatar || '').slice(0, 200000),
        imageUrl: String(p.imageUrl || '').slice(0, 2000000),
        caption: p.caption, tag: p.tag, timestamp: p.timestamp, likes: p.likes || [],
        comments: p.comments || [], local: true
      }));
      localStorage.setItem('mf-local-posts', JSON.stringify(slim));
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
        slim[k] = (Store.messages[k] || []).slice(-100);
      });
      localStorage.setItem('mf-local-msgs', JSON.stringify(slim));
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

  async function sendMessage(channelId, text) {
    try {
      await Api.sendMessage(channelId, { sender: Store.currentUser().name, text: text });
      await refreshMessages(channelId);
      saveLocalMsgs();
    } catch (e) {
      Store.messages[channelId] = Store.messages[channelId] || [];
      Store.messages[channelId].push({
        sender: Store.currentUser().name,
        text: text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        local: true
      });
      saveLocalMsgs();
    }
  }

  return { load, refreshPosts, refreshMessages, toggleLike, addComment, createPost, sendMessage };
})(Store);
