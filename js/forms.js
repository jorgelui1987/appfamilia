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

  function fmtBirth(birthdate) {
    if (!birthdate) return '';
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthdate));
    if (!m) return String(birthdate);
    var meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return Number(m[3]) + ' ' + (meses[Number(m[2]) - 1] || '') + ' ' + m[1];
  }

  function birthdayInfo(birthdate) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthdate || ''));
    if (!m) return null;
    var now = new Date();
    var y = now.getFullYear();
    var md = Number(m[2]) * 100 + Number(m[3]);
    var today = (now.getMonth() + 1) * 100 + now.getDate();
    var age = y - Number(m[1]);
    var next = new Date(y, Number(m[2]) - 1, Number(m[3]));
    var diff = Math.ceil((next - new Date(y, now.getMonth(), now.getDate())) / 86400000);
    if (diff < 0) { age += 1; diff = Math.ceil((new Date(y + 1, Number(m[2]) - 1, Number(m[3])) - new Date(y, now.getMonth(), now.getDate())) / 86400000); }
    return { age: diff === 0 ? age : age, days: diff, today: diff === 0 };
  }

  function renderBirthdays() {
    var list = $('events-list');
    if (!list) return;
    // Limpia cumpleanos auto (conserva tarjetas fijas si las hubiera).
    Array.prototype.slice.call(list.querySelectorAll('[data-auto-bday]')).forEach(function (el) { el.remove(); });
    var items = [];
    Store.users.forEach(function (u) {
      if (!u.birthdate) return;
      var info = birthdayInfo(u.birthdate);
      if (!info) return;
      if (info.days >= 0 && info.days <= 60) items.push({ u: u, info: info });
    });
    items.sort(function (a, b) { return a.info.days - b.info.days; });
    items.forEach(function (it) {
      var label = it.info.today ? 'Hoy' : (it.info.days === 1 ? 'Manana' : 'En ' + it.info.days + ' dias');
      var el = document.createElement('div');
      el.setAttribute('data-auto-bday', '1');
      el.className = 'bg-gradient-to-r from-pink-500 to-rose-500 text-white p-5 rounded-2xl flex items-center justify-between gap-3';
      el.innerHTML = '<div><span class="text-xs font-semibold uppercase bg-white/20 px-2 py-0.5 rounded-full">' + label + '</span><h3 class="font-bold text-lg mt-1">Cumpleanos de ' + escapeHtml(it.u.name) + '</h3><p class="text-xs text-pink-100">Cumple ' + it.info.age + ' anos · ' + fmtBirth(it.u.birthdate) + '</p></div><button type="button" data-bday-dm="' + it.u.id + '" class="bg-white text-pink-600 px-3.5 py-2 rounded-xl font-bold text-xs">Felicitar</button>';
      list.appendChild(el);
    });
    if (!items.length) {
      var empty = document.createElement('div');
      empty.setAttribute('data-auto-bday', '1');
      empty.className = 'text-xs text-slate-400 bg-white border border-dashed border-slate-200 rounded-2xl p-5 text-center md:col-span-2';
      empty.textContent = 'Registra la fecha de nacimiento al crear la cuenta y aqui veras los cumpleanos.';
      list.appendChild(empty);
    }
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
        var isMe = u.id === Store.state.currentUserId;
        var btxt = u.birthdate ? ' · 🎂 ' + fmtBirth(u.birthdate) : '';
        var adminMark = u.is_admin ? ' <span class="text-[10px] font-bold text-amber-600" title="Admin de la app">👑</span>' : '';
        return '<div class="flex items-center gap-3 py-1.5"><img src="' + escapeHtml(u.avatar) + '" alt="" loading="lazy" class="w-10 h-10 rounded-full object-cover" /><div class="flex-1"><p class="font-semibold text-sm">' + escapeHtml(u.name) + adminMark + (isMe ? ' <span class="text-[10px] text-emerald-600 font-bold">(tu)</span>' : '') + '</p><p class="text-xs text-slate-400">' + escapeHtml(u.role) + btxt + '</p></div>' + (isMe ? '' : '<button type="button" data-dm="' + u.id + '" class="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition" title="Chat privado con ' + escapeHtml(u.name) + '"><i class="fa-brands fa-whatsapp mr-1"></i>Mensaje</button>') + '</div>';
      }).join('');
      card.innerHTML = '<div class="mb-3 pb-3 border-b border-slate-100"><h3 class="font-bold text-base">' + escapeHtml(fam) + '</h3><span class="text-xs text-slate-500">' + groups[fam].length + ' Integrantes</span></div>' + rows;
      grid.appendChild(card);
    });
  }

  function bindProfilePhoto() {
    var btn = $('profile-photo-btn');
    var file = $('profile-photo-file');
    if (!btn || !file) return;
    btn.addEventListener('click', function () {
      var me = Store.currentUser();
      if (!me || !me.id) { App.toast('Entra con tu cuenta para cambiar tu foto'); return; }
      file.click();
    });
    file.addEventListener('change', function () {
      var f = file.files[0];
      file.value = '';
      if (!f) return;
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) {
        App.toast('Formato no permitido. Usa JPG, PNG o WEBP.');
        return;
      }
      if (f.size > 8 * 1024 * 1024) {
        App.toast('La foto supera 8MB. Elige otra.');
        return;
      }
      var url = URL.createObjectURL(f);
      var img = new Image();
      img.onload = function () {
        try {
          var w = img.naturalWidth || 1;
          var h = img.naturalHeight || 1;
          var side = Math.min(w, h);
          var canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 256;
          canvas.getContext('2d').drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, 256, 256);
          URL.revokeObjectURL(url);
          var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          // Solo esta foto elegida se envia al servidor.
          var me = Store.currentUser();
          Api.updateAvatar(me.id, dataUrl).then(function (r) {
            me.avatar = r.user.avatar;
            updateUserUI();
            App.renderPosts();
            renderFamilies();
            App.toast('Foto de perfil actualizada');
          }).catch(function (err) {
            App.toast('No se pudo guardar: ' + String((err && err.message) || err).slice(0, 120));
          });
        } catch (e) {
          URL.revokeObjectURL(url);
          App.toast('No se pudo leer esa foto.');
        }
      };
      img.onerror = function () { URL.revokeObjectURL(url); App.toast('No se pudo leer esa foto.'); };
      img.src = url;
    });
  }

  function bindForms() {
    bindProfilePhoto();
    $('users-selector-list').addEventListener('click', function (e) {
      var b = e.target.closest('[data-user]');
      if (!b) return;
      Store.state.currentUserId = Number(b.dataset.user);
      updateUserUI();
      App.renderPosts();
      renderUserSelector();
      AppChat.restoreDMs();
      AppChat.renderChannels();
      AppChat.closeModal('user-modal');
      App.toast('Ahora eres ' + Store.currentUser().name);
    });
    var grid = $('families-grid');
    if (grid) grid.addEventListener('click', function (e) {
      var dm = e.target.closest('[data-dm]');
      if (dm) {
        if (typeof AppChat.openDM === 'function') AppChat.openDM(dm.dataset.dm);
        return;
      }
    });
    $('posts-container').addEventListener('submit', function (e) {
      var f = e.target.closest('[data-comment-form]');
      if (!f) return;
      e.preventDefault();
      var input = f.querySelector('input');
      var text = input.value.trim();
      if (!text) return;
      var card = f.closest('[data-post-id]');
      var pid = card ? card.dataset.postId : '';
      input.value = '';
      Backend.addComment(pid, text.slice(0, 300)).then(function () { App.renderPosts(); }).catch(function (err) {
        App.toast('No se pudo comentar: ' + String((err && err.message) || err).slice(0, 100));
        App.renderPosts();
      });
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
      if (file.size > 50 * 1024 * 1024) {
        $('upload-error').textContent = 'La imagen supera 50MB.';
        return;
      }
      compressImage(file, 960, 0.72).then(function (dataUrl) {
        $('image-preview').src = dataUrl;
        $('image-preview-container').classList.remove('hidden');
      }).catch(function () {
        var reader = new FileReader();
        reader.onload = function (ev) {
          $('image-preview').src = ev.target.result;
          $('image-preview-container').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
      });
    });
    function compressImage(file, maxSide, quality) {
      return new Promise(function (resolve, reject) {
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () {
          try {
            var w = img.naturalWidth || 1;
            var h = img.naturalHeight || 1;
            var scale = Math.min(1, maxSide / Math.max(w, h));
            var cw = Math.round(w * scale);
            var ch = Math.round(h * scale);
            var canvas = document.createElement('canvas');
            canvas.width = cw;
            canvas.height = ch;
            canvas.getContext('2d').drawImage(img, 0, 0, cw, ch);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', quality));
          } catch (e) { URL.revokeObjectURL(url); reject(e); }
        };
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('img')); };
        img.src = url;
      });
    }
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
      }).then(function (r) {
        AppChat.closeModal('upload-modal');
        e.target.reset();
        $('image-preview-container').classList.add('hidden');
        App.switchTab('feed');
        App.renderPosts();
        App.toast(r && r.local ? 'Recuerdo publicado en este dispositivo (sin servidor)' : 'Recuerdo publicado y guardado en la base de datos');
      }).catch(function (err) {
        var m = String((err && err.message) || err);
        var j = null;
        try {
          var s = m.indexOf('{');
          var x = m.lastIndexOf('}');
          if (s > -1 && x > s) j = JSON.parse(m.slice(s, x + 1));
        } catch (ee) {}
        $('upload-error').textContent = (j && j.error) ? j.error : 'No se pudo guardar: ' + m.slice(0, 160);
      }).then(function () {
        if (btn) { btn.disabled = false; btn.textContent = 'Publicar para la Familia'; }
      });
    });
  }

  return { renderUserSelector: renderUserSelector, updateUserUI: updateUserUI, renderFamilies: renderFamilies, renderBirthdays: renderBirthdays, bindForms: bindForms };
})(Store, App, AppChat);
