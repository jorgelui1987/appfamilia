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

  function renderChannels() {
    var list = $('chat-channels-list');
    if (!list) return;
    list.innerHTML = '';
    var q = (Store.state.chatSearch || '').toLowerCase().trim();
    var shown = 0;
    Store.channels.forEach(function (ch) {
      if (q && ch.name.toLowerCase().indexOf(q) === -1 && (ch.subtitle || '').toLowerCase().indexOf(q) === -1) return;
      shown++;
      var active = ch.id === Store.state.activeChatId;
      var el = document.createElement('button');
      el.type = 'button';
      el.setAttribute('role', 'option');
      el.setAttribute('aria-selected', String(active));
      el.className = 'w-full text-left p-3.5 flex items-center gap-3 transition ' + (active ? 'bg-emerald-50 border-r-4 border-emerald-600' : 'hover:bg-slate-100');
      el.dataset.channel = ch.id;
      var avatar = ch.type === 'group'
        ? '<div class="w-11 h-11 rounded-full ' + ch.color + ' text-white flex items-center justify-center"><i class="fa-solid ' + ch.icon + '"></i></div>'
        : '<img src="' + escapeHtml(ch.avatar) + '" alt="" loading="lazy" class="w-11 h-11 rounded-full object-cover" />';
      el.innerHTML = avatar + '<div class="flex-1 overflow-hidden"><h4 class="font-bold text-sm truncate">' + escapeHtml(ch.name) + '</h4><p class="text-xs text-slate-500 truncate">' + escapeHtml(ch.subtitle) + '</p></div>';
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
    if (!msgs.length) box.innerHTML = '<p class="text-center text-xs text-slate-400">Sin mensajes. Escribe el primero.</p>';
    msgs.forEach(function (m) {
      var isMe = m.sender === me;
      var el = document.createElement('div');
      el.className = 'flex flex-col ' + (isMe ? 'items-end' : 'items-start');
      var head = isMe ? '' : '<span class="block font-bold text-emerald-600 text-[11px] mb-1">' + escapeHtml(m.sender) + '</span>';
      el.innerHTML = '<div class="max-w-[80%] rounded-2xl p-3 shadow-sm text-xs ' + (isMe ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 rounded-tl-none') + '">' + head + '<p class="leading-relaxed"></p><span class="block text-[9px] text-right mt-1 ' + (isMe ? 'text-emerald-200' : 'text-slate-400') + '">' + escapeHtml(m.time) + '</span></div>';
      el.querySelector('p').textContent = m.text;
      box.appendChild(el);
    });
    box.scrollTop = box.scrollHeight;
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
    var ch = null;
    Store.channels.forEach(function (c) { if (c.id === id) ch = c; });
    if (ch) {
      $('active-chat-title').textContent = ch.name;
      $('active-chat-subtitle').textContent = ch.subtitle;
      $('active-chat-icon').innerHTML = ch.type === 'group'
        ? '<i class="fa-solid ' + ch.icon + '"></i>'
        : '<img src="' + escapeHtml(ch.avatar) + '" class="w-10 h-10 rounded-full object-cover" alt="" />';
    }
    renderChannels();
    renderMessages();
    showConvOnMobile();
    Backend.refreshMessages(id).then(renderMessages);
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
      Backend.sendMessage(id, text.slice(0, 500)).then(function () {
        renderMessages();
        if (!Store.backend.ok) App.toast('Mensaje guardado en este dispositivo (sin servidor)');
      });
      renderMessages();
    });
    var back = $('chat-back-btn');
    if (back) back.addEventListener('click', showListOnMobile);
    var quick = $('quick-chat-btn');
    if (quick) quick.addEventListener('click', function () {
      App.switchTab('chat');
      selectChannel('gen');
      setTimeout(function () {
        var input = $('chat-input-text');
        if (input && window.innerWidth >= 640) input.focus();
      }, 300);
    });
    $('chat-photo-btn').addEventListener('click', function () {
      App.toast('Adjunta una foto desde el muro con Compartir recuerdo');
    });
  }

  return { openModal: openModal, closeModal: closeModal, renderChannels: renderChannels, renderMessages: renderMessages, selectChannel: selectChannel, bindChat: bindChat };
})(Store, App);
