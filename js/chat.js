'use strict';
/* MiFamilia — Chat: canales, mensajes y envio. */
var AppChat = (function (Store, App) {
  var $ = App.$;
  var escapeHtml = App.escapeHtml;

  function openModal(id) {
    var m = $(id);
    if (m) { m.classList.remove('hidden'); m.classList.add('flex'); }
  }
  function closeModal(id) {
    var m = $(id);
    if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
  }

  function dmId(a, b) {
    var x = Math.min(Number(a), Number(b));
    var y = Math.max(Number(a), Number(b));
    return 'dm-' + x + '-' + y;
  }

  function openDM(otherId) {
    var me = Store.currentUser();
    var other = Store.getUser(otherId);
    if (!other) { App.toast('Ese familiar ya no existe'); return; }
    if (String(other.id) === String(me.id)) return;
    var id = dmId(me.id, other.id);
    var exists = null;
    Store.channels.forEach(function (c) { if (c.id === id) exists = c; });
    if (!exists) {
      exists = {
        id: id, name: other.name, subtitle: 'Chat privado · solo ustedes dos',
        type: 'direct', avatar: other.avatar, dm: true, peerId: other.id
      };
      Store.channels.push(exists);
      Store.messages[id] = Store.messages[id] || [];
      try {
        var saved = JSON.parse(localStorage.getItem('mf-dm-channels') || '[]');
        if (saved.indexOf(id) === -1) {
          saved.push(id);
          localStorage.setItem('mf-dm-channels', JSON.stringify(saved));
        }
      } catch (e) {}
      if (Store.backend.ok) {
        Api.createDM(id, other.id).catch(function () {});
      }
    } else {
      exists.peerId = other.id;
      exists.avatar = other.avatar;
    }
    App.switchTab('chat');
    selectChannel(id);
    App.toast('Chat privado con ' + other.name.split(' ')[0] + ' (nadie mas lo ve)');
  }

  function restoreDMs() {
    try {
      var saved = JSON.parse(localStorage.getItem('mf-dm-channels') || '[]');
      // Limpia basura vieja: ids que no son dm-A-B (ej. 'maria') se borran.
      var cleaned = saved.filter(function (id) { return /^dm-(\d+)-(\d+)$/.test(String(id)); });
      if (cleaned.length !== saved.length) {
        try { localStorage.setItem('mf-dm-channels', JSON.stringify(cleaned)); } catch (e) {}
      }
      cleaned.forEach(function (id) {
        var m = /^dm-(\d+)-(\d+)$/.exec(id);
        if (!m) return;
        var me = Store.state.currentUserId;
        var peerId = Number(m[1]) === Number(me) ? Number(m[2]) : Number(m[1]);
        var peer = Store.getUser(peerId);
        if (!peer) return;
        var exists = Store.channels.some(function (c) { return c.id === id; });
        if (!exists) {
          Store.channels.push({ id: id, name: peer.name, subtitle: 'Chat privado · solo ustedes dos', type: 'direct', avatar: peer.avatar, dm: true, peerId: peer.id });
          Store.messages[id] = Store.messages[id] || [];
        }
      });
    } catch (e) {}
  }

  function peerOf(dmChannelId) {
    var m = /^dm-(\d+)-(\d+)$/.exec(String(dmChannelId || ''));
    if (!m) return null;
    var me = Number(Store.state.currentUserId);
    if (Number(m[1]) === me) return Number(m[2]);
    if (Number(m[2]) === me) return Number(m[1]);
    return null;
  }

  function ensureDMsForAllUsers() {
    // Crea el privado dm-A-B para cada familiar (sin duplicar, sin yo-mismo).
    var me = Store.currentUser();
    if (!me) return;
    Store.users.forEach(function (u) {
      if (String(u.id) === String(me.id)) return;
      var id = dmId(me.id, u.id);
      var exists = Store.channels.some(function (c) { return String(c.id) === String(id); });
      if (exists) return;
      Store.channels.push({
        id: id, name: u.name, subtitle: 'Chat privado · solo ustedes dos',
        type: 'direct', avatar: u.avatar, dm: true, peerId: u.id
      });
      Store.messages[id] = Store.messages[id] || [];
    });
    // Refresca nombres/avatares por si el familiar cambio su foto.
    Store.channels.forEach(function (c) {
      if (!c.dm) return;
      var peerId = c.peerId != null ? c.peerId : peerOf(c.id);
      if (peerId == null) return;
      var peer = Store.getUser(peerId);
      if (!peer) return;
      c.peerId = peer.id;
      c.name = peer.name;
      c.avatar = peer.avatar;
    });
  }

  function renderChannels() {
    var list = $('chat-channels-list');
    if (!list) return;
    // Asegura 1 privado por familiar (asi salen TODOS los contactos).
    try { ensureDMsForAllUsers(); } catch (e) {}
    list.innerHTML = '';
    var q = (Store.state.chatSearch || '').toLowerCase().trim();
    var meId = String(Store.state.currentUserId);
    // Solo mis privados: oculta DMs de otros (ej. dm-1-2 cuando soy Jorge)
    // y mi propio DM. Asi no se repite Maria Perez ni salgo yo.
    var chans = Store.channels.filter(function (c) {
      if (!c.dm) return true;
      var pid = c.peerId != null ? c.peerId : peerOf(c.id);
      // Legacy sin peerId ('maria', 'Tia Maria', etc.): resuelvelo por nombre.
      // Compara tambien sin 'Tia/Tio/Papa/Mama' para que 'Tia Maria' -> Maria Perez.
      if (pid == null && String(c.id).indexOf('dm-') !== 0) {
        var byName = null;
        var cname = String(c.name || '').toLowerCase();
        Store.users.forEach(function (u) {
          var uname = String(u.name || '').toLowerCase();
          if (uname === cname) byName = u;
          else {
            var first = uname.split(' ')[0];
            var cfirst = cname.replace(/^(tia|tio|papa|mama|abuela|abuelo|primo|prima)\s+/i, '').split(' ')[0];
            if (first && cfirst && (cname.indexOf(first) > -1 || uname.indexOf(cfirst) > -1)) byName = u;
          }
        });
        if (byName) { c.peerId = byName.id; pid = byName.id; }
      }
      if (pid == null) return false;
      if (String(pid) === meId) return false;
      var m = /^dm-(\d+)-(\d+)$/.exec(String(c.id));
      if (m) {
        // dm-A-B que no me incluye -> es de otros, ocultar.
        if (String(m[1]) !== meId && String(m[2]) !== meId) return false;
      }
      return true;
    });
    // Dedupe final: 1 fila por familiar (si hay legacy + dm-A-B, queda dm-A-B).
    var seenPeer = {};
    var deduped = [];
    // Ordena modernos primero para que ganen al dedupar.
    chans.slice().sort(function (a, b) {
      var am = String(a.id).indexOf('dm-') === 0 ? 0 : 1;
      var bm = String(b.id).indexOf('dm-') === 0 ? 0 : 1;
      return am - bm;
    }).forEach(function (c) {
      if (!c.dm) { deduped.push(c); return; }
      var pid = c.peerId != null ? c.peerId : peerOf(c.id);
      var key = pid != null ? 'p' + pid : 'c' + String(c.id);
      if (seenPeer[key]) return;
      seenPeer[key] = true;
      deduped.push(c);
    });
    var chans2 = deduped;
    // Grupos primero, privados despues.
    var ordered = chans2.slice().sort(function (a, b) {
      var ad = a.dm ? 1 : 0;
      var bd = b.dm ? 1 : 0;
      return ad - bd;
    });
    var shown = 0;
    var lastSection = '';
    ordered.forEach(function (ch) {
      if (q && ch.name.toLowerCase().indexOf(q) === -1 && (ch.subtitle || '').toLowerCase().indexOf(q) === -1) return;
      var section = ch.dm ? 'Privados' : 'Grupos';
      if (!q && section !== lastSection) {
        lastSection = section;
        var head = document.createElement('p');
        head.className = 'px-3.5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400';
        head.textContent = section === 'Privados' ? 'Privados (solo ustedes dos)' : 'Grupos familiares';
        list.appendChild(head);
      }
      shown++;
      var active = ch.id === Store.state.activeChatId;
      var el = document.createElement('button');
      el.type = 'button';
      el.setAttribute('role', 'option');
      el.setAttribute('aria-selected', String(active));
      el.className = 'w-full text-left p-3.5 flex items-center gap-3 transition ' + (active ? 'bg-emerald-50 border-r-4 border-emerald-600' : 'hover:bg-slate-100');
      el.dataset.channel = ch.id;
      // Presencia estilo WhatsApp: punto verde si el familiar esta en la app.
      var peerOnline = false;
      try {
        var _pid = ch.peerId != null ? ch.peerId : peerOf(ch.id);
        peerOnline = !!(_pid != null && Store.online && Store.online[String(_pid)]);
      } catch (e) {}
      var dotHtml = (!ch.dm || peerOnline) ? '' : '';
      var avatar = ch.type === 'group'
        ? '<div class="w-11 h-11 rounded-full ' + ch.color + ' text-white flex items-center justify-center"><i class="fa-solid ' + ch.icon + '"></i></div>'
        : '<span class="relative"><img src="' + escapeHtml(ch.avatar) + '" alt="" loading="lazy" class="w-11 h-11 rounded-full object-cover" />' + (ch.dm ? '<span class="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ' + (peerOnline ? 'bg-emerald-500' : 'bg-slate-400') + '" title="' + (peerOnline ? 'En linea' : 'Desconectado') + '"></span><span class="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-slate-900 text-emerald-400 rounded-full text-[9px] items-center justify-center hidden" title="Privado"><i class="fa-solid fa-lock"></i></span>' : '') + '</span>';
      var sub = ch.subtitle || '';
      // En privados muestra "en linea" como WhatsApp cuando el otro esta en la app.
      if (ch.dm && peerOnline) sub = 'en linea';
      // Contador verde estilo WhatsApp: cuantos mensajes nuevos tiene ese chat.
      var unread = 0;
      try { unread = unreadCount(ch.id); } catch (e) {}
      var badge = unread > 0 ? '<span class="ml-2 shrink-0 min-w-[22px] h-[22px] px-1.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center" title="' + unread + ' mensajes nuevos">' + (unread > 99 ? '99+' : unread) + '</span>' : '';
      el.innerHTML = avatar + '<div class="flex-1 overflow-hidden"><h4 class="font-bold text-sm truncate">' + escapeHtml(ch.name) + '</h4><p class="text-xs truncate ' + (ch.dm && peerOnline ? 'text-emerald-600 font-semibold' : 'text-slate-500') + '">' + escapeHtml(sub) + '</p></div>' + badge + dotHtml;
      list.appendChild(el);
    });
    if (!shown) {
      if (q) {
        list.innerHTML = '<div class="p-6 text-center"><p class="text-xs text-slate-400 mb-3">Sin resultados para "' + escapeHtml(Store.state.chatSearch) + '". Ese campo solo busca chats, no personas.</p><button type="button" id="chat-clear-search" class="text-xs font-bold text-emerald-600 underline">Ver todos los chats</button></div>';
        var clear = $('chat-clear-search');
        if (clear) clear.addEventListener('click', function () {
          Store.state.chatSearch = '';
          var input = $('chat-search');
          if (input) input.value = '';
          renderChannels();
        });
      } else {
        list.innerHTML = '<div class="p-6 text-center"><p class="text-xs text-slate-400 mb-1">Aun no hay chats aqui.</p><p class="text-[11px] text-slate-400">Si ves Local arriba, solo ves este dispositivo. Revisa Postgres para compartir.</p></div>';
      }
    }
  }

  function renderMessages() {
    var box = $('chat-messages-container');
    if (!box) return;
    box.innerHTML = '';
    var me = Store.currentUser().name;
    var msgs = Store.messages[Store.state.activeChatId] || [];
    if (!msgs.length) box.innerHTML = '<p class="text-center text-xs text-slate-400">Sin mensajes. Escribe el primero o manda una foto con el clip.</p>';
    msgs.forEach(function (m) {
      var isMe = m.sender === me;
      var el = document.createElement('div');
      el.className = 'flex flex-col ' + (isMe ? 'items-end' : 'items-start');
      var head = isMe ? '' : '<span class="block font-bold text-emerald-600 text-[11px] mb-1">' + escapeHtml(m.sender) + '</span>';
      var img = m.imageUrl || m.image_url || '';
      var imgHtml = img ? '<img src="' + img + '" alt="Foto del chat" loading="lazy" class="rounded-xl mb-1.5 max-w-full cursor-pointer chat-photo-img" style="max-height:220px;object-fit:cover" data-action="view-chat-photo" />' : '';
      var txtHtml = m.text ? '<p class="leading-relaxed"></p>' : '';
      el.innerHTML = '<div class="max-w-[80%] rounded-2xl p-3 shadow-sm text-xs fade-in ' + (isMe ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 rounded-tl-none') + '">' + head + imgHtml + txtHtml + '<span class="block text-[9px] text-right mt-1 ' + (isMe ? 'text-emerald-200' : 'text-slate-400') + '">' + escapeHtml(m.time) + '</span></div>';
      var p = el.querySelector('p');
      if (p) p.textContent = m.text || '';
      box.appendChild(el);
    });
    box.scrollTop = box.scrollHeight;
  }

  var pollTimer = null;
  var lastCount = 0;

  function fingerprint(id) {
    var msgs = Store.messages[id] || [];
    return msgs.length + '|' + (msgs.length ? String(msgs[msgs.length - 1].text).slice(0, 40) : '');
  }

  // No leidos estilo WhatsApp: cuenta mensajes de otros desde tu ultima lectura.
  // Se guarda por chat en localStorage para que sobreviva al cerrar la app.
  function readKey(id) { return 'mf-read-' + String(id); }
  function lastReadIdx(id) {
    try { return Number(localStorage.getItem(readKey(id)) || '0'); } catch (e) { return 0; }
  }
  function saveReadIdx(id, n) {
    try { localStorage.setItem(readKey(id), String(n)); } catch (e) {}
  }
  function unreadCount(id) {
    var msgs = Store.messages[id] || [];
    var me = null;
    try { me = Store.currentUser().name; } catch (e) {}
    var read = lastReadIdx(id);
    var n = 0;
    for (var i = read; i < msgs.length; i++) {
      if (msgs[i] && msgs[i].sender !== me) n++;
    }
    // Si estas viendo ese chat ahora, no cuenta (ya lo estas leyendo).
    try {
      var v = document.getElementById('tab-chat-view');
      if (v && !v.classList.contains('hidden') && String(Store.state.activeChatId) === String(id)) return 0;
    } catch (e) {}
    return n;
  }
  function markChatRead(id) {
    var msgs = Store.messages[id] || [];
    saveReadIdx(id, msgs.length);
    refreshTabBadge();
  }

  // Punto/contador en la barra inferior = suma de no leidos de todos los chats.
  function refreshTabBadge() {
    try {
      var total = 0;
      Store.channels.forEach(function (c) { total += unreadCount(c.id); });
      var dot = $('mob-chat-dot');
      if (!dot) return;
      if (total > 0) {
        dot.textContent = total > 99 ? '99+' : String(total);
        dot.classList.remove('hidden');
      } else {
        dot.classList.add('hidden');
      }
    } catch (e) {}
  }

  function notifyIncoming(channelId, text) {
    try {
      // Si ya estas viendo ese chat, no avises (ya lo estas leyendo).
      var inChat = false;
      try {
        var view = $('tab-chat-view');
        inChat = view && !view.classList.contains('hidden') && String(Store.state.activeChatId) === String(channelId);
      } catch (e) {}
      if (inChat) return;
      var ch = null;
      Store.channels.forEach(function (c) { if (String(c.id) === String(channelId)) ch = c; });
      var n = unreadCount(channelId);
      var name = ch ? ch.name : 'Chat';
      App.toast('Nuevo mensaje en ' + name.split(' ').slice(0, 2).join(' ') + (n > 1 ? ' (' + n + ' nuevos)' : '') + (text ? ': ' + String(text).slice(0, 60) : ''));
    } catch (e) {
      App.toast('Tienes un mensaje nuevo');
    }
    try { if (typeof Sound !== 'undefined') Sound.play(); } catch (e) {}
    try { if (navigator.vibrate) navigator.vibrate([80, 40, 80]); } catch (e) {}
    try { refreshTabBadge(); renderChannels(); } catch (e) {}
  }

  var watchTimer = null;
  var watchState = {};
  var watchReady = false;

  function snapshotAll() {
    var snap = {};
    Store.channels.forEach(function (c) {
      var msgs = Store.messages[c.id] || [];
      snap[c.id] = msgs.length + '|' + (msgs.length ? String(msgs[msgs.length - 1].text).slice(0, 40) : '');
    });
    return snap;
  }

  // Se llama despues de Backend.load(): marca el chat abierto como leido y
  // prepara el vigilante sin avisar de mensajes viejos.
  function markAllSeenNow() {
    watchState = snapshotAll();
    watchReady = true;
    try { markChatRead(Store.state.activeChatId); } catch (e) {}
    try { renderChannels(); } catch (e) {}
  }

  function startWatcher() {
    if (watchTimer) return;
    watchState = snapshotAll();
    // Al abrir la app NO avises de mensajes viejos: actualiza el estado
    // despues de la primera carga del servidor para solo avisar lo NUEVO.
    watchReady = false;
    setTimeout(function () {
      try { watchState = snapshotAll(); watchReady = true; } catch (e) {}
    }, 15000);
    watchTimer = setInterval(function () {
      if (!Store.backend.ok) return;
      if (!watchReady) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      var ids = Store.channels.map(function (c) { return c.id; });
      (function next(i) {
        if (i >= ids.length) return;
        var id = ids[i];
        Backend.refreshMessages(id).then(function () {
          var now = fingerprint(id);
          if (watchState[id] !== undefined && watchState[id] !== now) {
            var inChat = false;
            try {
              var view = $('tab-chat-view');
              inChat = view && !view.classList.contains('hidden') && String(Store.state.activeChatId) === String(id);
            } catch (e) {}
            if (!inChat) {
              var msgs = Store.messages[id] || [];
              var last = msgs[msgs.length - 1];
              if (last && last.sender !== Store.currentUser().name) {
                try { renderChannels(); refreshTabBadge(); } catch (e) {}
                notifyIncoming(id, last.text);
              }
            }
          }
          watchState[id] = now;
          next(i + 1);
        }).catch(function () { next(i + 1); });
      })(0);
    }, 8000);
  }

  function startPolling() {
    stopPolling();
    lastCount = fingerprint(Store.state.activeChatId);
    pollTimer = setInterval(function () {
      // Solo actualiza si estas en la pestana Chat y hay servidor.
      var view = $('tab-chat-view');
      if (!view || view.classList.contains('hidden')) return;
      if (!Store.backend.ok) return;
      var id = Store.state.activeChatId;
      Backend.refreshMessages(id).then(function () {
        var now = fingerprint(id);
        if (now !== lastCount) {
          lastCount = now;
          renderMessages();
          markChatRead(id);
          renderChannels();
        }
      });
    }, 5000);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  var presenceTimer = null;
  // Presencia estilo WhatsApp: aviso cada 20s que sigo en la app + pregunto
  // quienes estan en linea para pintar el punto verde. Sin servidor = nadie.
  function startPresence() {
    if (presenceTimer) return;
    Store.online = Store.online || {};
    function beat() {
      if (!Store.backend.ok) return;
      var me = null;
      try { me = Store.currentUser(); } catch (e) {}
      if (!me || !me.id) return;
      Api.heartbeat(me.id).catch(function () {});
      Api.presence().then(function (r) {
        var map = {};
        ((r && r.online) || []).forEach(function (id) { map[String(id)] = true; });
        Store.online = map;
        renderChannels();
        // Refresca el "en linea" del encabezado si estas en un privado.
        try {
          var cur = Store.state.activeChatId;
          var ch = null;
          Store.channels.forEach(function (c) { if (String(c.id) === String(cur)) ch = c; });
          if (ch && ch.dm) {
            var pid = ch.peerId != null ? ch.peerId : peerOf(ch.id);
            var on = pid != null && Store.online[String(pid)];
            var sub = $('active-chat-subtitle');
            if (sub) {
              sub.textContent = on ? 'en linea' : (ch.subtitle || '');
              sub.className = 'text-xs truncate ' + (on ? 'text-emerald-600 font-semibold' : 'text-slate-400');
            }
          }
        } catch (e) {}
      }).catch(function () {});
    }
    beat();
    presenceTimer = setInterval(beat, 20000);
    // Si el backend conecta despues (Backend.load), reintenta enseguida.
    document.addEventListener('mf-backend-ready', function () { try { beat(); } catch (e) {} });
    document.addEventListener('mf-user-changed', function () { try { beat(); } catch (e) {} });
  }

  var sseOn = false;
  function startLive() {
    if (sseOn) return;
    if (typeof EventSource === 'undefined') return;
    try {
      var src = new EventSource('/api/stream');
      sseOn = true;
      src.onmessage = function (ev) {
        try {
          var data = JSON.parse(ev.data || '{}');
          var view = $('tab-chat-view');
          if (!view || view.classList.contains('hidden')) return;
          if (!Store.backend.ok) return;
          var id = data.channel || Store.state.activeChatId;
          Backend.refreshMessages(id).then(function () {
            // Punto verde en la barra si el mensaje es de otro canal.
            var dot = $('mob-chat-dot');
            if (dot) dot.classList.toggle('hidden', String(id) === String(Store.state.activeChatId));
            if (String(id) !== String(Store.state.activeChatId)) {
              renderChannels();
              return;
            }
            var now = fingerprint(id);
            if (now !== lastCount) {
              lastCount = now;
              renderMessages();
              markChatRead(id);
              renderChannels();
            }
          });
        } catch (e) {}
      };
      src.onerror = function () { sseOn = false; };
    } catch (e) { sseOn = false; }
  }

  function showConvOnMobile() {
    if (window.innerWidth >= 640) return;
    var list = $('chat-list-pane');
    var conv = $('chat-conv-pane');
    if (list) list.classList.add('hidden');
    if (conv) { conv.classList.remove('hidden'); conv.classList.add('flex'); }
  }

  function showListOnMobile() {
    if (window.innerWidth >= 640) return;
    var list = $('chat-list-pane');
    var conv = $('chat-conv-pane');
    if (conv) { conv.classList.add('hidden'); conv.classList.remove('flex'); }
    if (list) list.classList.remove('hidden');
  }

  function selectChannel(id) {
    Store.state.activeChatId = id;
    // Lo abriste = ya lo leiste: limpia el contador verde.
    try { markChatRead(id); } catch (e) {}
    var ch = null;
    Store.channels.forEach(function (c) { if (c.id === id) ch = c; });
    if (ch) {
      var sub = ch.subtitle || '';
      // Si es privado y el otro esta en la app, muestra "en linea" arriba.
      try {
        var _pid = ch.peerId != null ? ch.peerId : peerOf(ch.id);
        if (ch.dm && _pid != null && Store.online && Store.online[String(_pid)]) sub = 'en linea';
      } catch (e) {}
      $('active-chat-title').textContent = ch.name;
      $('active-chat-subtitle').textContent = sub;
      try {
        var _on = false;
        var _p2 = ch.peerId != null ? ch.peerId : peerOf(ch.id);
        _on = !!(_p2 != null && Store.online && Store.online[String(_p2)]);
        $('active-chat-subtitle').className = 'text-xs truncate ' + (ch.dm && _on ? 'text-emerald-600 font-semibold' : 'text-slate-400');
      } catch (e) {}
      $('active-chat-icon').innerHTML = ch.type === 'group'
        ? '<i class="fa-solid ' + ch.icon + '"></i>'
        : '<img src="' + escapeHtml(ch.avatar) + '" class="w-10 h-10 rounded-full object-cover" alt="" />';
    }
    renderChannels();
    renderMessages();
    showConvOnMobile();
    lastCount = fingerprint(id);
    startPolling();
    Backend.refreshMessages(id).then(function () {
      lastCount = fingerprint(id);
      renderMessages();
    });
  }

  function nowTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function bindChat() {
    $('chat-channels-list').addEventListener('click', function (e) {
      var b = e.target.closest('[data-channel]');
      if (b) selectChannel(b.dataset.channel);
    });
    $('chat-search').addEventListener('input', function (e) {
      Store.state.chatSearch = e.target.value;
      renderChannels();
    });
    $('chat-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var input = $('chat-input-text');
      var text = input.value.trim();
      if (!text) return;
      var id = Store.state.activeChatId;
      input.value = '';
      input.focus();
      Backend.sendMessage(id, text.slice(0, 500), '').then(function () {
        renderMessages();
        lastCount = fingerprint(id);
        if (!Store.backend.ok) App.toast('Mensaje guardado en este dispositivo (sin servidor)');
      });
      renderMessages();
    });
    var back = $('chat-back-btn');
    if (back) back.addEventListener('click', showListOnMobile);
    restoreDMs();
    startPolling();
    startLive();
    startWatcher();
    startPresence();
    // Al entrar al Chat se limpia el aviso pendiente.
    document.addEventListener('click', function (e) {
      var tab = e.target.closest && e.target.closest('[data-tab="chat"]');
      if (tab) {
        try { markChatRead(Store.state.activeChatId); renderChannels(); } catch (ee) {}
      }
    });
    $('chat-photo-btn').addEventListener('click', function () {
      var f = $('chat-photo-file');
      if (f) f.click();
      else App.toast('Adjunta una foto desde el muro con Compartir recuerdo');
    });
    var chatFile = $('chat-photo-file');
    if (chatFile) chatFile.addEventListener('change', function () {
      var file = chatFile.files && chatFile.files[0];
      chatFile.value = '';
      if (!file) return;
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { App.toast('Solo JPG, PNG o WEBP'); return; }
      if (file.size > 8 * 1024 * 1024) { App.toast('La foto supera 8MB'); return; }
      var reader = new FileReader();
      reader.onload = function (ev) {
        var url = ev.target.result;
        var img = new Image();
        img.onload = function () {
          try {
            var w = img.naturalWidth || 1;
            var h = img.naturalHeight || 1;
            var scale = Math.min(1, 800 / Math.max(w, h));
            var cw = Math.max(1, Math.round(w * scale));
            var ch = Math.max(1, Math.round(h * scale));
            var cv = document.createElement('canvas');
            cv.width = cw; cv.height = ch;
            cv.getContext('2d').drawImage(img, 0, 0, cw, ch);
            url = cv.toDataURL('image/jpeg', 0.7);
          } catch (e) {}
          var id = Store.state.activeChatId;
          var caption = ($('chat-input-text') && $('chat-input-text').value.trim()) || '';
          if ($('chat-input-text')) $('chat-input-text').value = '';
          App.toast('Enviando foto...');
          Backend.sendMessage(id, caption.slice(0, 500), url).then(function () {
            renderMessages();
            lastCount = fingerprint(id);
            markChatRead(id);
            renderChannels();
          });
          renderMessages();
        };
        img.onerror = function () { App.toast('No se pudo leer esa foto'); };
        img.src = url;
      };
      reader.readAsDataURL(file);
    });
    // Toca la foto del chat para verla grande.
    $('chat-messages-container').addEventListener('click', function (e) {
      var img = e.target.closest && e.target.closest('[data-action="view-chat-photo"]');
      if (!img) return;
      if (typeof Viewer !== 'undefined' && Viewer.open) Viewer.open(img.src, 'Foto del chat', '');
      else { App.toast('Foto del chat'); }
    });
  }

  return { openModal: openModal, closeModal: closeModal, renderChannels: renderChannels, renderMessages: renderMessages, selectChannel: selectChannel, bindChat: bindChat, openDM: openDM, restoreDMs: restoreDMs, markAllSeenNow: markAllSeenNow, ensureDMsForAllUsers: ensureDMsForAllUsers, refreshTabBadge: refreshTabBadge, markChatRead: markChatRead, unreadCount: unreadCount };
})(Store, App);
