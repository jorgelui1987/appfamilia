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
        channels.forEach((c) => Store.channels.push(c));
        const ids = channels.map((c) => c.id);
        if (ids.indexOf(Store.state.activeChatId) === -1) Store.state.activeChatId = ids[0];
        for (const c of channels) {
          try { Store.messages[c.id] = await Api.messages(c.id); }
          catch (e) { if (!Store.messages[c.id]) Store.messages[c.id] = []; }
        }
      }
      Store.backend.ok = true;
    } catch (e) {
      Store.backend.ok = false;
    }
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

  async function createPost(data) {
    const res = await Api.createPost(data);
    await refreshPosts();
    return res;
  }

  async function sendMessage(channelId, text) {
    try {
      await Api.sendMessage(channelId, { sender: Store.currentUser().name, text: text });
      await refreshMessages(channelId);
    } catch (e) {
      Store.messages[channelId] = Store.messages[channelId] || [];
      Store.messages[channelId].push({ sender: Store.currentUser().name, text: text, time: 'Ahora' });
    }
  }

  return { load, refreshPosts, refreshMessages, toggleLike, addComment, createPost, sendMessage };
})(Store);
