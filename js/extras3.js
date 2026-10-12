'use strict';
/* MiFamilia — Extras B2: buscador global, insignias y confetti. */
var ExtrasC = (function (Store, App, Extras) {
  var $ = App.$;
  var escapeHtml = App.escapeHtml;

  function confetti(n) {
    n = n || 60;
    var colors = ['#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6'];
    for (var i = 0; i < n; i++) {
      var d = document.createElement('div');
      d.className = 'confetti-piece';
      d.style.left = Math.random() * 100 + 'vw';
      d.style.background = colors[i % colors.length];
      d.style.width = 6 + Math.random() * 8 + 'px';
      d.style.height = '6px';
      d.style.animationDuration = 2 + Math.random() * 2 + 's';
      document.body.appendChild(d);
      (function (el) { setTimeout(function () { el.remove(); }, 4500); })(d);
    }
  }

  function seedBadges() {
    if (!Store.badges) Store.badges = Extras.load('mf-badges', {});
  }

  function award(id, msg) {
    if (Store.badges[id]) return;
    Store.badges[id] = { ts: Date.now() };
    Extras.save('mf-badges', Store.badges);
    confetti(50);
    App.toast('Insignia desbloqueada: ' + msg);
    renderBadges();
  }

  function renderBadges() {
    var box = $('badges-box');
    if (!box) return;
    var all = [
      { id: 'fotografo', icon: '📸', name: 'Fotografo' },
      { id: 'votante', icon: '🗳️', name: 'Votante' },
      { id: 'narrador', icon: '📖', name: 'Narrador' },
      { id: 'fiestero', icon: '🎉', name: 'Fiestero' }
    ];
    box.innerHTML = '';
    all.forEach(function (b) {
      var got = !!Store.badges[b.id];
      var d = document.createElement('div');
      d.className = 'flex flex-col items-center gap-1 p-2 rounded-xl ' + (got ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 opacity-50');
      d.title = b.name + (got ? ' (desbloqueada)' : ' (bloqueada)');
      d.innerHTML = '<span class="text-2xl">' + b.icon + '</span><span class="text-[10px] font-bold">' + b.name + '</span>';
      box.appendChild(d);
    });
  }

  function bindSearch() {
    var input = $('global-search');
    if (!input) return;
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      var box = $('search-results');
      if (!q) { box.classList.add('hidden'); box.innerHTML = ''; return; }
      var html = '';
      Store.posts.forEach(function (p) {
        if ((p.caption || '').toLowerCase().indexOf(q) > -1) {
          html += '<button type="button" data-goto-post="' + p.id + '" class="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg text-xs flex gap-2 items-center"><i class="fa-solid fa-image text-emerald-500"></i><span class="truncate">' + escapeHtml((p.caption || '').slice(0, 60)) + '</span></button>';
        }
      });
      Store.users.forEach(function (u) {
        if (u.name.toLowerCase().indexOf(q) > -1) {
          html += '<button type="button" data-goto-members class="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg text-xs flex gap-2 items-center"><img src="' + escapeHtml(u.avatar) + '" class="w-6 h-6 rounded-full object-cover" alt="" /><span>' + escapeHtml(u.name) + ' · ' + escapeHtml(u.family) + '</span></button>';
        }
      });
      box.innerHTML = html || '<p class="text-xs text-slate-400 p-3">Sin resultados.</p>';
      box.classList.remove('hidden');
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('#search-wrap')) $('search-results').classList.add('hidden');
      if (e.target.closest('[data-goto-post]')) { App.switchTab('feed'); $('search-results').classList.add('hidden'); }
      if (e.target.closest('[data-goto-members]')) { App.switchTab('members'); $('search-results').classList.add('hidden'); }
    });
  }

  return { confetti: confetti, seedBadges: seedBadges, award: award, renderBadges: renderBadges, bindSearch: bindSearch };
})(Store, App, Extras);
