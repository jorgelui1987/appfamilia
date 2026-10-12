'use strict';
/* MiFamilia — Extras A: modo oscuro + historias 24h. */
var Extras = (function (Store, App) {
  var $ = App.$;
  var escapeHtml = App.escapeHtml;

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  function initTheme() {
    var dark = load('mf-theme', null);
    if (dark === null) dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(!!dark);
    var btn = $('theme-btn');
    if (btn) btn.addEventListener('click', function () {
      var isDark = !document.documentElement.classList.contains('dark');
      applyTheme(isDark);
      save('mf-theme', isDark);
      App.toast(isDark ? 'Modo oscuro activado' : 'Modo claro activado');
    });
  }
  function applyTheme(dark) {
    document.documentElement.classList.toggle('dark', dark);
    var btn = $('theme-btn');
    if (btn) btn.innerHTML = dark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#060b16' : '#0f172a');
  }

  function seedStories() {
    if (!Store.stories) Store.stories = [
      { id: 's1', userId: 2, userName: 'Maria Perez', avatar: Store.users[1].avatar, image: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=600&q=70', text: 'Tarde en el campo', ts: Date.now() - 3600e3 },
      { id: 's2', userId: 4, userName: 'Sofia Castro', avatar: Store.users[3].avatar, image: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=600&q=70', text: 'Cumple en familia', ts: Date.now() - 7200e3 }
    ];
    if (!Store.state.seenStories) Store.state.seenStories = load('mf-seen-stories', {});
  }

  function renderStories() {
    var bar = $('stories-bar');
    if (!bar) return;
    var now = Date.now();
    Store.stories = Store.stories.filter(function (s) { return now - s.ts < 24 * 3600e3; });
    bar.innerHTML = '';
    var me = Store.currentUser();
    var add = document.createElement('button');
    add.type = 'button';
    add.id = 'story-add';
    add.className = 'flex flex-col items-center gap-1 shrink-0 w-16';
    add.innerHTML = '<span class="relative w-14 h-14"><img src="' + escapeHtml(me.avatar) + '" alt="Tu historia" class="w-14 h-14 rounded-full object-cover border-2 border-slate-200" /><span class="absolute bottom-0 right-0 w-5 h-5 bg-emerald-500 text-white rounded-full text-xs flex items-center justify-center border-2 border-white">+</span></span><span class="text-[10px] text-slate-500 font-semibold">Tu historia</span>';
    bar.appendChild(add);
    Store.stories.forEach(function (s) {
      var seen = !!Store.state.seenStories[s.id];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'flex flex-col items-center gap-1 shrink-0 w-16';
      b.dataset.story = s.id;
      b.setAttribute('aria-label', 'Ver historia de ' + s.userName);
      b.innerHTML = '<span class="' + (seen ? 'story-seen' : 'story-ring') + '"><img src="' + escapeHtml(s.avatar) + '" alt="" class="w-14 h-14 rounded-full object-cover border-2 border-white" /></span><span class="text-[10px] text-slate-500 font-semibold truncate w-16 text-center">' + escapeHtml(s.userName.split(' ')[0]) + '</span>';
      bar.appendChild(b);
    });
  }

  function openStory(id) {
    var s = null;
    Store.stories.forEach(function (x) { if (x.id === id) s = x; });
    if (!s) return;
    Store.state.seenStories[id] = true;
    save('mf-seen-stories', Store.state.seenStories);
    $('story-img').src = s.image;
    $('story-user').textContent = s.userName;
    $('story-text').textContent = s.text || '';
    var modal = $('story-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    renderStories();
    clearTimeout(openStory._t);
    openStory._t = setTimeout(closeStory, 5000);
  }
  function closeStory() {
    clearTimeout(openStory._t);
    var modal = $('story-modal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
  }

  function addStory(image, text) {
    var me = Store.currentUser();
    Store.stories.unshift({ id: 's' + Date.now(), userId: me.id, userName: me.name, avatar: me.avatar, image: image, text: text || '', ts: Date.now() });
    renderStories();
  }

  return { load: load, save: save, initTheme: initTheme, seedStories: seedStories, renderStories: renderStories, openStory: openStory, closeStory: closeStory, addStory: addStory };
})(Store, App);
