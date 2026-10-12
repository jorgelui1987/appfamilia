'use strict';
/* MiFamilia App — parte 1: utilidades, tabs, feed */
var App = (function (Store) {
  function $(id) { return document.getElementById(id); }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(msg) {
    var box = $('toast-box'); if (!box) return;
    var el = document.createElement('div');
    el.className = 'toast-in bg-slate-900 text-white text-sm font-semibold px-4 py-3 rounded-xl shadow-lg flex items-center gap-2';
    el.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-400"></i><span></span>';
    el.querySelector('span').textContent = msg;
    box.appendChild(el);
    setTimeout(function () { el.remove(); }, 2600);
  }
  function switchTab(tab) {
    Store.state.activeTab = tab;
    document.querySelectorAll('.tab-content').forEach(function (el) { el.classList.add('hidden'); });
    var view = $('tab-' + tab + '-view'); if (view) view.classList.remove('hidden');
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
      var active = btn.dataset.tab === tab;
      btn.classList.toggle('bg-emerald-600', active);
      btn.classList.toggle('text-white', active);
      btn.classList.toggle('shadow-sm', active);
      btn.classList.toggle('text-slate-300', !active);
      if (active) btn.setAttribute('aria-current', 'page'); else btn.removeAttribute('aria-current');
    });
    document.querySelectorAll('.mob-tab').forEach(function (btn) {
      var active = btn.dataset.tab === tab;
      btn.classList.toggle('text-emerald-400', active);
      btn.classList.toggle('text-slate-400', !active);
    });
  }
  function filteredPosts() {
    var f = Store.state.feedFilter;
    var me = Store.currentUser();
    if (f === 'mi-familia') return Store.posts.filter(function (p) { return p.userFamily === me.family; });
    if (f === 'eventos') return Store.posts.filter(function (p) { return p.tag === 'Cumpleanos' || p.tag === 'Vacaciones'; });
    return Store.posts;
  }
  function renderPosts() {
    var container = $('posts-container'); if (!container) return;
    container.innerHTML = '';
    var list = filteredPosts();
    var me = Store.currentUser();
    if (!list.length) {
      container.innerHTML = '<div class="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center text-sm text-slate-500">No hay recuerdos con este filtro. Comparte el primero.</div>';
    }
    list.forEach(function (post) {
      var liked = post.likes.indexOf(me.id) > -1;
      var el = document.createElement('article');
      el.className = 'bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden';
      el.dataset.postId = post.id;
      el.innerHTML =
        '<div class="p-4 flex items-center justify-between border-b border-slate-50">' +
        '<div class="flex items-center gap-3"><img src="' + escapeHtml(post.userAvatar) + '" alt="" class="w-10 h-10 rounded-full object-cover border border-slate-200" loading="lazy" /><div><h4 class="font-bold text-slate-800 text-sm leading-tight">' + escapeHtml(post.userName) + '</h4><div class="flex items-center gap-2 mt-0.5"><span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold">' + escapeHtml(post.userFamily) + '</span><span class="text-[10px] text-slate-400">' + escapeHtml(post.timestamp) + '</span></div></div></div>' +
        '<span class="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-semibold border border-emerald-100">' + escapeHtml(post.tag) + '</span></div>' +
        '<div class="bg-slate-900 flex items-center justify-center max-h-[450px] overflow-hidden"><img src="' + escapeHtml(post.imageUrl) + '" alt="Foto: ' + escapeHtml(post.caption).slice(0, 80) + '" class="w-full object-cover feed-img cursor-pointer" loading="lazy" data-action="view-photo" /></div>' +
        '<div class="p-4 space-y-3"><p class="text-slate-700 text-sm leading-relaxed">' + escapeHtml(post.caption) + '</p>' +
        '<div data-reacts></div>' +
        '<div class="flex items-center justify-between pt-2 border-t border-slate-100 text-xs"><button type="button" data-action="like" class="flex items-center gap-1.5 font-semibold transition ' + (liked ? 'text-rose-600' : 'text-slate-500 hover:text-rose-600') + '"><i class="' + (liked ? 'fa-solid' : 'fa-regular') + ' fa-heart text-base"></i><span>' + post.likes.length + ' Les gusta</span></button>' +
        '<span class="text-slate-400"><i class="fa-regular fa-comment mr-1"></i> ' + post.comments.length + ' comentarios</span></div>' +
        '<div class="space-y-2 pt-2 bg-slate-50 p-3 rounded-xl">' +
        post.comments.map(function (c) { return '<div class="text-xs"><span class="font-bold text-slate-800">' + escapeHtml(c.userName) + ':</span> <span class="text-slate-600">' + escapeHtml(c.text) + '</span></div>'; }).join('') +
        '<form data-comment-form class="mt-2 flex gap-2"><label class="sr-only" for="c-' + post.id + '">Comentar</label><input id="c-' + post.id + '" type="text" placeholder="Escribe un comentario familiar..." maxlength="300" class="flex-1 bg-white px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500" required /><button type="submit" class="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 transition">Enviar</button></form>' +
        '</div></div>';
      if (typeof ExtrasB !== 'undefined') ExtrasB.renderReacts(post, el.querySelector('[data-reacts]'));
      container.appendChild(el);
    });
    $('stat-posts-count').textContent = String(Store.posts.filter(function (p) { return p.userId === me.id; }).length);
    $('stat-members-count').textContent = String(Store.users.length);
  }
  return { $: $, escapeHtml: escapeHtml, toast: toast, switchTab: switchTab, renderPosts: renderPosts, filteredPosts: filteredPosts };
})(Store);
