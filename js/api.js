'use strict';
/* MiFamilia — API client: habla con /api (Postgres). Con fallback local. */
var Api = (function () {
  async function req(method, url, body) {
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(method + ' ' + url + ' -> ' + res.status + ' ' + t);
    }
    const ct = res.headers.get('content-type') || '';
    return ct.includes('json') ? res.json() : res.text();
  }
  return {
    request: req,
    post: function (url, body) { return req('POST', url, body); },
    health: () => req('GET', '/api/health'),
    users: () => req('GET', '/api/users'),
    usersAs: (meId) => req('GET', '/api/users?meId=' + meId),
    posts: () => req('GET', '/api/posts'),
    createPost: (d) => req('POST', '/api/posts', d),
    comment: (id, d) => req('POST', '/api/posts/' + id + '/comments', d),
    like: (id, userId) => req('POST', '/api/posts/' + id + '/like', { userId }),
    channels: () => req('GET', '/api/channels'),
    createDM: (id, peerId) => req('POST', '/api/channels/dm', { id: id, peerId: peerId }),
    messages: (id) => req('GET', '/api/channels/' + id + '/messages'),
    sendMessage: (id, d) => req('POST', '/api/channels/' + id + '/messages', d),
    register: (d) => req('POST', '/api/auth/register', d),
    seedAdmin: (d) => req('POST', '/api/auth/seed-admin', d),
    login: (d) => req('POST', '/api/auth/login', d),
    reset: (d) => req('POST', '/api/auth/reset', d),
    updateAvatar: (id, avatar) => req('PUT', '/api/users/' + id + '/avatar', { avatar }),
    heartbeat: (userId) => req('POST', '/api/presence', { userId }),
    presence: () => req('GET', '/api/presence'),
    backup: (adminId) => req('GET', '/api/admin/backup?adminId=' + adminId)
  };
})();
