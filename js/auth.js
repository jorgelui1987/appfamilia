'use strict';
/* MiFamilia — Auth: telefono + codigo pais, acceso obligatorio. */
var Auth = (function (Store, App, AppChat) {
  var $ = App.$;
  var mode = 'login';
  var avatarData = '';

  var COUNTRIES = [
    { code: '+52', label: '🇲🇽 +52' },
    { code: '+57', label: '🇨🇴 +57' },
    { code: '+34', label: '🇪🇸 +34' },
    { code: '+1', label: '🇺🇸 +1' },
    { code: '+54', label: '🇦🇷 +54' },
    { code: '+56', label: '🇨🇱 +56' },
    { code: '+51', label: '🇵🇪 +51' },
    { code: '+58', label: '🇻🇪 +58' },
    { code: '+502', label: '🇬🇹 +502' },
    { code: '+503', label: '🇸🇻 +503' },
    { code: '+504', label: '🇭🇳 +504' },
    { code: '+505', label: '🇳🇮 +505' },
    { code: '+506', label: '🇨🇷 +506' },
    { code: '+507', label: '🇵🇦 +507' },
    { code: '+593', label: '🇪🇨 +593' },
    { code: '+591', label: '🇧🇴 +591' },
    { code: '+595', label: '🇵🇾 +595' },
    { code: '+598', label: '🇺🇾 +598' },
    { code: '+55', label: '🇧🇷 +55' }
  ];

  function logged() {
    try { return !!JSON.parse(localStorage.getItem('mf-session') || 'null'); } catch (e) { return false; }
  }
  function logout(silent) {
    try { localStorage.removeItem('mf-session'); } catch (e) {}
    open();
    if (!silent) App.toast('Sesion cerrada');
  }

  function setMode(m) {
    mode = m;
    var isReg = m === 'register';
    $('auth-avatar-wrap').classList.toggle('hidden', !isReg);
    $('auth-name-wrap').classList.toggle('hidden', !isReg);
    $('auth-family-wrap').classList.toggle('hidden', !isReg);
    $('auth-submit').textContent = isReg ? 'Crear mi cuenta' : 'Entrar';
    $('auth-tab-login').className = 'flex-1 py-2 rounded-xl ' + (!isReg ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600');
    $('auth-tab-register').className = 'flex-1 py-2 rounded-xl ' + (isReg ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600');
    $('auth-tab-login').setAttribute('aria-selected', String(!isReg));
    $('auth-tab-register').setAttribute('aria-selected', String(isReg));
    $('auth-error').textContent = '';
  }

  function applyUser(u, msg) {
    var exists = Store.getUser(u.id);
    if (!exists) Store.users.push(u);
    else { exists.name = u.name; exists.role = u.role; exists.family = u.family; exists.avatar = u.avatar; }
    Store.state.currentUserId = u.id;
    try { localStorage.setItem('mf-session', JSON.stringify({ id: u.id })); } catch (e) {}
    AppChat.closeModal('auth-modal');
    App.toast(msg || ('Bienvenido, ' + u.name.split(' ')[0]));
  }

  function compressAvatar(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var w = img.naturalWidth || 1;
          var h = img.naturalHeight || 1;
          var side = Math.min(w, h);
          var sx = (w - side) / 2;
          var sy = (h - side) / 2;
          var canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 256;
          canvas.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, 256, 256);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch (e) { URL.revokeObjectURL(url); reject(e); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('img')); };
      img.src = url;
    });
  }

  function bindAvatar() {
    var btn = $('auth-avatar-btn');
    var file = $('auth-avatar-file');
    var preview = $('auth-avatar-preview');
    var clear = $('auth-avatar-clear');
    var err = $('auth-avatar-error');
    if (!btn || !file) return;
    btn.addEventListener('click', function () { file.click(); });
    file.addEventListener('change', function () {
      var f = file.files[0];
      if (!f) return;
      err.textContent = '';
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) {
        err.textContent = 'Formato no permitido. Usa JPG, PNG o WEBP.';
        return;
      }
      if (f.size > 8 * 1024 * 1024) {
        err.textContent = 'La foto supera 8MB. Elige otra.';
        return;
      }
      // Solo la foto que el usuario eligio se procesa; nada se sube hasta Crear cuenta.
      compressAvatar(f).then(function (dataUrl) {
        avatarData = dataUrl;
        preview.src = dataUrl;
        preview.classList.remove('hidden');
        clear.classList.remove('hidden');
        btn.innerHTML = '<i class="fa-solid fa-camera mr-2 text-emerald-600"></i>Cambiar foto';
      }).catch(function () {
        err.textContent = 'No se pudo leer esa foto. Prueba con otra.';
      });
    });
    clear.addEventListener('click', function () {
      avatarData = '';
      file.value = '';
      preview.src = '';
      preview.classList.add('hidden');
      clear.classList.add('hidden');
      btn.innerHTML = '<i class="fa-solid fa-camera mr-2 text-emerald-600"></i>Tomar foto o elegir de galeria';
    });
  }

  function fillPrefixes() {
    var sel = $('auth-prefix');
    if (!sel || sel.options.length) return;
    COUNTRIES.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c.code;
      o.textContent = c.label;
      sel.appendChild(o);
    });
    sel.value = '+52';
  }

  function open() {
    fillPrefixes();
    setMode(mode);
    AppChat.openModal('auth-modal');
    setTimeout(function () { $('auth-phone').focus(); }, 100);
  }

  function requireAuth() {
    if (!logged()) open();
  }

  function bind() {
    bindAvatar();
    fillPrefixes();
    var btn = $('auth-btn');
    if (btn) btn.addEventListener('click', function () {
      if (logged()) { logout(); document.dispatchEvent(new CustomEvent('mf-user-changed')); return; }
      open();
    });
    $('auth-tab-login').addEventListener('click', function () { setMode('login'); });
    $('auth-tab-register').addEventListener('click', function () { setMode('register'); });
    // El modal de acceso es obligatorio: no se cierra con ESC ni clic fuera.
    $('auth-form').addEventListener('submit', function (e) {
      e.preventDefault();
      $('auth-error').textContent = '';
      var prefix = $('auth-prefix').value;
      var phone = $('auth-phone').value;
      var pass = $('auth-pass').value;
      var submit = $('auth-submit');
      submit.disabled = true;
      submit.textContent = 'Verificando...';
      function done() { submit.disabled = false; submit.textContent = mode === 'register' ? 'Crear mi cuenta' : 'Entrar'; }
      if (mode === 'register') {
        var name = $('auth-name').value.trim();
        var family = $('auth-family').value.trim() || 'Mi Familia';
        Api.register({ name: name, prefix: prefix, phone: phone, password: pass, family: family, role: 'Familiar', avatar: avatarData }).then(function (r) {
          done();
          avatarData = '';
          var pv = $('auth-avatar-preview');
          if (pv) { pv.src = ''; pv.classList.add('hidden'); }
          var cl = $('auth-avatar-clear');
          if (cl) cl.classList.add('hidden');
          applyUser(r.user, 'Cuenta creada. Bienvenido, ' + r.user.name.split(' ')[0]);
          document.dispatchEvent(new CustomEvent('mf-user-changed'));
        }).catch(function (err) {
          done();
          $('auth-error').textContent = cleanErr(err.message);
        });
      } else {
        Api.login({ prefix: prefix, phone: phone, password: pass }).then(function (r) {
          done();
          applyUser(r.user, 'Que bueno verte, ' + r.user.name.split(' ')[0]);
          document.dispatchEvent(new CustomEvent('mf-user-changed'));
        }).catch(function (err) {
          done();
          $('auth-error').textContent = cleanErr(err.message);
        });
      }
    });
  }

  function cleanErr(msg) {
    var m = String(msg == null ? '' : msg);
    var j = null;
    try {
      var start = m.indexOf('{');
      var end = m.lastIndexOf('}');
      if (start > -1 && end > start) j = JSON.parse(m.slice(start, end + 1));
    } catch (e) { j = null; }
    if (j && j.error) return j.error;
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Sin conexion con el servidor. Revisa tu internet o haz Redeploy en Dokploy.';
    if (/404/.test(m)) return 'Servidor desactualizado (404). Haz Redeploy en Dokploy para subir el registro.';
    return 'No se pudo completar: ' + m.slice(0, 160);
  }

  function restore() {
    try {
      var s = JSON.parse(localStorage.getItem('mf-session') || 'null');
      if (s && s.id) {
        var u = Store.getUser(s.id);
        if (u) Store.state.currentUserId = u.id;
      }
    } catch (e) {}
  }

  function syncBtn() {
    var btn = $('auth-btn');
    if (!btn) return;
    var logged = false;
    try { logged = !!JSON.parse(localStorage.getItem('mf-session') || 'null'); } catch (e) {}
    btn.textContent = logged ? 'Salir' : 'Entrar / Registrarme';
  }

  return { bind: bind, open: open, restore: restore, syncBtn: syncBtn, requireAuth: requireAuth, logged: logged, logout: logout };
})(Store, App, AppChat);
