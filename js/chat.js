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
    var q = (Store.state.chatSearch || '').toLowerCase();
    var shown = 0;
    Store.channels.forEach(function (ch) {
      if (ch.name.toLowerCase().indexOf(q) === -1) return;
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
    if (!shown) list.innerHTML = '<p class="p-4 text-xs text-slate-400 text-center">Sin resultados para tu busqueda.</p>';
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
      Backend.sendMessage(id, text.slice(0, 500)).then(renderMessages);
      renderMessages();
    });
    $('chat-photo-btn').addEventListener('click', function () {
      App.toast('Adjunta una foto desde el muro con Compartir recuerdo');
    });
  }

  return { openModal: openModal, closeModal: closeModal, renderChannels: renderChannels, renderMessages: renderMessages, selectChannel: selectChannel, bindChat: bindChat };
})(Store, App);
