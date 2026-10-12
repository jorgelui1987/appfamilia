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
    health: () => req('GET', '/api/health'),
    users: () => req('GET', '/api/users'),
    posts: () => req('GET', '/api/posts'),
    createPost: (d) => req('POST', '/api/posts', d),
    comment: (id, d) => req('POST', '/api/posts/' + id + '/comments', d),
    like: (id, userId) => req('POST', '/api/posts/' + id + '/like', { userId }),
    channels: () => req('GET', '/api/channels'),
    messages: (id) => req('GET', '/api/channels/' + id + '/messages'),
    sendMessage: (id, d) => req('POST', '/api/channels/' + id + '/messages', d),
    register: (d) => req('POST', '/api/auth/register', d),
    login: (d) => req('POST', '/api/auth/login', d),
    updateAvatar: (id, avatar) => req('PUT', '/api/users/' + id + '/avatar', { avatar })
  };
})();
