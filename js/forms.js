'use strict';
/* MiFamilia — Usuarios, directorio y subida de fotos. */
var AppForms = (function (Store, App, AppChat) {
  var $ = App.$;
  var escapeHtml = App.escapeHtml;

  function renderUserSelector() {
    var list = $('users-selector-list');
    if (!list) return;
    list.innerHTML = '';
    Store.users.forEach(function (u) {
      var cur = u.id === Store.state.currentUserId;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'w-full p-2.5 rounded-xl flex items-center justify-between border ' + (cur ? 'bg-emerald-50 border-emerald-500' : 'border-slate-200 hover:bg-slate-50');
      b.dataset.user = u.id;
      b.innerHTML = '<div class="flex items-center gap-3"><img src="' + escapeHtml(u.avatar) + '" alt="" class="w-8 h-8 rounded-full object-cover" /><div class="text-left"><p class="font-bold text-xs">' + escapeHtml(u.name) + '</p><p class="text-[10px] text-slate-400">' + escapeHtml(u.family) + '</p></div></div>' + (cur ? '<i class="fa-solid fa-check text-emerald-600 text-xs"></i>' : '');
      list.appendChild(b);
    });
  }

  function updateUserUI() {
    var u = Store.currentUser();
    $('current-user-name').textContent = u.role + ' (' + u.name.split(' ')[0] + ')';
    $('current-user-family').textContent = u.family;
    $('current-user-avatar').src = u.avatar;
    $('sidebar-user-avatar').src = u.avatar;
    $('post-box-avatar').src = u.avatar;
    $('sidebar-user-name').textContent = u.name;
    $('sidebar-user-family').textContent = u.family;
  }

  function renderFamilies() {
    var grid = $('families-grid');
    if (!grid) return;
    var groups = {};
    Store.users.forEach(function (u) {
      if (!groups[u.family]) groups[u.family] = [];
      groups[u.family].push(u);
    });
    grid.innerHTML = '';
    Object.keys(groups).forEach(function (fam) {
      var card = document.createElement('div');
      card.className = 'bg-white rounded-2xl p-5 border border-slate-200 shadow-sm';
      var rows = groups[fam].map(function (u) {
        return '<div class="flex items-center gap-3 py-1.5"><img src="' + escapeHtml(u.avatar) + '" alt="" loading="lazy" class="w-10 h-10 rounded-full object-cover" /><div><p class="font-semibold text-sm">' + escapeHtml(u.name) + '</p><p class="text-xs text-slate-400">' + escapeHtml(u.role) + '</p></div></div>';
      }).join('');
      card.innerHTML = '<div class="mb-3 pb-3 border-b border-slate-100"><h3 class="font-bold text-base">' + escapeHtml(fam) + '</h3><span class="text-xs text-slate-500">' + groups[fam].length + ' Integrantes</span></div>' + rows;
      grid.appendChild(card);
    });
  }

  function bindForms() {
    $('users-selector-list').addEventListener('click', function (e) {
      var b = e.target.closest('[data-user]');
      if (!b) return;
      Store.state.currentUserId = Number(b.dataset.user);
      updateUserUI();
      App.renderPosts();
      renderUserSelector();
      AppChat.closeModal('user-modal');
      App.toast('Ahora eres ' + Store.currentUser().name);
    });
    $('posts-container').addEventListener('submit', function (e) {
      var f = e.target.closest('[data-comment-form]');
      if (!f) return;
      e.preventDefault();
      var input = f.querySelector('input');
      var text = input.value.trim();
      if (!text) return;
      var card = f.closest('[data-post-id]');
      Backend.addComment(Number(card.dataset.postId), text.slice(0, 300)).then(function () { App.renderPosts(); });
    });
    var drop = $('drop-zone');
    var fileInput = $('modal-photo-file');
    drop.addEventListener('click', function () { fileInput.click(); });
    drop.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
    });
    fileInput.addEventListener('change', function () {
      var file = fileInput.files[0];
      if (!file) return;
      $('upload-error').textContent = '';
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
        $('upload-error').textContent = 'Formato no permitido. Usa JPG, PNG o WEBP.';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        $('upload-error').textContent = 'La imagen supera 5MB.';
        return;
      }
      var reader = new FileReader();
      reader.onload = function (ev) {
        $('image-preview').src = ev.target.result;
        $('image-preview-container').classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    });
    $('upload-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var caption = $('modal-caption').value.trim();
      if (caption.length < 3) {
        $('upload-error').textContent = 'Escribe una descripcion de al menos 3 caracteres.';
        return;
      }
      var me = Store.currentUser();
      var btn = e.target.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = 'Publicando...'; }
      Backend.createPost({
        userId: me.id,
        caption: caption.slice(0, 500),
        tag: $('modal-tag').value,
        imageUrl: $('image-preview').src || ''
      }).then(function () {
        AppChat.closeModal('upload-modal');
        e.target.reset();
        $('image-preview-container').classList.add('hidden');
        App.switchTab('feed');
        App.renderPosts();
        App.toast('Recuerdo publicado y guardado en la base de datos');
      }).catch(function (err) {
        $('upload-error').textContent = 'No se pudo guardar: ' + err.message;
      }).then(function () {
        if (btn) { btn.disabled = false; btn.textContent = 'Publicar para la Familia'; }
      });
    });
  }

  return { renderUserSelector: renderUserSelector, updateUserUI: updateUserUI, renderFamilies: renderFamilies, bindForms: bindForms };
})(Store, App, AppChat);
