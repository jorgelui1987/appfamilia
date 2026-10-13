'use strict';
/* MiFamilia — Auth: telefono + codigo pais, acceso obligatorio. */
var Auth = (function (Store, App, AppChat) {
  var $ = App.$;
  var mode = 'login';
  var avatarData = '';

  var COUNTRIES = [
    { code: '+52', label: '🇲🇽 +52' },
    { code: '+569', label: '🇨🇱 +569' },
    { code: '+56', label: '🇨🇱 +56' },
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
    var bw = $('auth-birth-wrap');
    if (bw) bw.classList.toggle('hidden', !isReg);
    $('auth-family-wrap').classList.toggle('hidden', !isReg);
    $('auth-submit').textContent = isReg ? 'Crear mi cuenta' : 'Entrar';
    $('auth-tab-login').className = 'flex-1 py-2 rounded-xl ' + (!isReg ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300');
    $('auth-tab-register').className = 'flex-1 py-2 rounded-xl ' + (isReg ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300');
    $('auth-tab-login').setAttribute('aria-selected', String(!isReg));
    $('auth-tab-register').setAttribute('aria-selected', String(isReg));
    $('auth-error').textContent = '';
  }

  function applyUser(u, msg) {
    var exists = Store.getUser(u.id);
    if (!exists) Store.users.push(u);
    else { exists.name = u.name; exists.role = u.role; exists.family = u.family; exists.avatar = u.avatar; if (u.birthdate) exists.birthdate = u.birthdate; if (u.phone) exists.phone = u.phone; if (typeof u.is_admin !== 'undefined') exists.is_admin = u.is_admin; }
    Store.state.currentUserId = u.id;
    try { localStorage.setItem('mf-session', JSON.stringify({ id: u.id })); } catch (e) {}
    AppChat.closeModal('auth-modal');
    App.toast(msg || ('Bienvenido, ' + u.name.split(' ')[0]));
    try { document.dispatchEvent(new CustomEvent('mf-user-changed')); } catch (e) {}
    try { syncAdminUI(); } catch (e) {}
  }

  function isAdmin() {
    try {
      var me = Store.currentUser();
      if (me && Number(me.is_admin) === 1) return true;
      if (me && String(me.phone || '').replace(/\s/g, '') === '+56982209690') return true;
    } catch (e) {}
    return false;
  }

  // Muestra el boton Respaldo solo al admin.
  function syncAdminUI() {
    try {
      var b = document.getElementById('backup-btn');
      if (b) b.classList.toggle('hidden', !isAdmin());
    } catch (e) {}
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
    var cam = $('auth-avatar-camera');
    var gal = $('auth-avatar-gallery');
    var oldBtn = $('auth-avatar-btn');
    var file = $('auth-avatar-file');
    var preview = $('auth-avatar-preview');
    var clear = $('auth-avatar-clear');
    var err = $('auth-avatar-error');
    if (!file) return;
    // Camara: pide foto nueva. Galeria: deja elegir la guardada en el celu.
    if (cam) cam.addEventListener('click', function () {
      file.removeAttribute('capture');
      file.setAttribute('capture', 'user');
      file.click();
    });
    if (gal) gal.addEventListener('click', function () {
      file.removeAttribute('capture');
      file.click();
    });
    if (oldBtn) oldBtn.addEventListener('click', function () { file.click(); });
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
      }).catch(function () {
        err.textContent = 'No se pudo leer esa foto. Prueba con otra.';
      });
    });
    clear.addEventListener('click', function () {
      avatarData = '';
      file.value = '';
      file.removeAttribute('capture');
      preview.src = '';
      preview.classList.add('hidden');
      clear.classList.add('hidden');
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
    // Pedir ayuda al admin por WhatsApp (para olvido de clave).
    var help = $('auth-help-admin');
    if (help) help.addEventListener('click', function () {
      var phone = ($('auth-phone') && $('auth-phone').value.trim()) || '';
      var msg = 'Hola admin MiFamilia, olvide mi clave. Soy ' + (phone ? phone : '(mi numero)') + '. Ayudame con una clave temporal.';
      location.href = 'https://wa.me/56982209690?text=' + encodeURIComponent(msg);
    });
    // Acceso oculto del admin: 5 toques al logo lo crean (nadie lo ve).
    // Escribe tu clave en Contrasena, toca 5 veces la casita y entra.
    function createAdminHidden() {
      var pass = $('auth-pass').value || '';
      if (pass.length < 6) { $('auth-error').textContent = 'Escribe tu clave (6+) en Contrasena y toca 5 veces la casita.'; return; }
      $('auth-error').textContent = '';
      App.toast('Creando acceso admin...');
      Api.seedAdmin({ name: 'Admin', prefix: '+569', phone: '82209690', password: pass, birthdate: '1980-01-01', family: 'Mi Familia' }).then(function (r) {
        try {
          var sel = $('auth-prefix');
          for (var i = 0; i < sel.options.length; i++) {
            if (sel.options[i].value === '+569') { sel.selectedIndex = i; break; }
          }
          $('auth-phone').value = '82209690';
        } catch (e) {}
        App.toast(r.created ? 'Admin creado. Ahora toca Entrar' : 'Admin ya existia. Toca Entrar');
      }).catch(function (err) {
        var m = String((err && err.message) || err);
        var j = null;
        try { var s = m.indexOf('{'); var x = m.lastIndexOf('}'); if (s > -1 && x > s) j = JSON.parse(m.slice(s, x + 1)); } catch (ee) {}
        if (/404/.test(m)) $('auth-error').textContent = 'Servidor viejo (404): haz Redeploy en Dokploy y reintenta.';
        else $('auth-error').textContent = (j && j.error) ? j.error : 'No se pudo: ' + m.slice(0, 100);
      });
    }
    var logoTimer = null;
    var logoTaps = 0;
    var logoBox = $('auth-logo-tap');
    if (logoBox) logoBox.addEventListener('click', function () {
      logoTaps++;
      clearTimeout(logoTimer);
      logoTimer = setTimeout(function () { logoTaps = 0; }, 2500);
      if (logoTaps >= 5) { logoTaps = 0; createAdminHidden(); }
    });
    var forgot = $('auth-forgot');
    if (forgot) forgot.addEventListener('click', function () {
      var sel = $('recover-prefix');
      if (sel && !sel.options.length) {
        COUNTRIES.forEach(function (c) {
          var o = document.createElement('option');
          o.value = c.code;
          o.textContent = c.label;
          sel.appendChild(o);
        });
        sel.value = $('auth-prefix').value || '+52';
      } else if (sel) {
        sel.value = $('auth-prefix').value || '+52';
      }
      var rp = $('recover-phone');
      if (rp && !$('auth-phone').value) rp.value = '';
      else if (rp) rp.value = $('auth-phone').value;
      $('recover-error').textContent = '';
      $('recover-ok').textContent = '';
      AppChat.openModal('recover-modal');
    });
    var rclose = $('recover-close');
    if (rclose) rclose.addEventListener('click', function () { AppChat.closeModal('recover-modal'); });
    var rform = $('recover-form');
    if (rform) rform.addEventListener('submit', function (e) {
      e.preventDefault();
      $('recover-error').textContent = '';
      $('recover-ok').textContent = '';
      var btn = $('recover-submit');
      btn.disabled = true;
      btn.textContent = 'Guardando...';
      Api.reset({
        prefix: $('recover-prefix').value,
        phone: $('recover-phone').value,
        newPassword: $('recover-pass').value,
        helperId: Store.state.currentUserId
      }).then(function (r) {
        btn.disabled = false;
        btn.textContent = 'Crear clave temporal';
        $('recover-ok').textContent = 'Listo: ' + (r.name || 'tu familiar') + ' ya puede entrar con la clave temporal. Que la cambie pronto.';
        App.toast('Clave temporal creada');
      }).catch(function (err) {
        btn.disabled = false;
        btn.textContent = 'Crear clave temporal';
        var m = String((err && err.message) || err);
        var j = null;
        try {
          var s = m.indexOf('{');
          var x = m.lastIndexOf('}');
          if (s > -1 && x > s) j = JSON.parse(m.slice(s, x + 1));
        } catch (ee) {}
        $('recover-error').textContent = (j && j.error) ? j.error : 'No se pudo: ' + m.slice(0, 160);
      });
    });
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
      function localIdFor(phoneFull) {
        var h = 0;
        var s = String(phoneFull || '');
        for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
        return 100000 + Math.abs(h % 899999999);
      }
      function localRegister(name, family, prefix, phone, pass, avatar, birthdate) {
        var users = [];
        try { users = JSON.parse(localStorage.getItem('mf-local-users') || '[]'); } catch (e) { users = []; }
        var full = prefix + ' ' + String(phone).replace(/\D/g, '');
        var dup = users.filter(function (x) { return x.phone === full; })[0];
        if (dup) { $('auth-error').textContent = 'Ese numero ya esta registrado en este dispositivo. Inicia sesion.'; done(); return; }
        var u = { id: localIdFor(full), name: name, role: 'Familiar', family: family || 'Mi Familia', avatar: avatar || '', phone: full, birthdate: birthdate || '', pass: btoa(unescape(encodeURIComponent(pass))) };
        users.push(u);
        try { localStorage.setItem('mf-local-users', JSON.stringify(users)); } catch (e) {}
        avatarData = '';
        applyUser({ id: u.id, name: u.name, role: u.role, family: u.family, avatar: u.avatar, phone: u.phone, birthdate: u.birthdate }, 'Cuenta creada en este dispositivo. Bienvenido, ' + name.split(' ')[0]);
        document.dispatchEvent(new CustomEvent('mf-user-changed'));
        done();
      }
      function localLogin(prefix, phone, pass) {
        var users = [];
        try { users = JSON.parse(localStorage.getItem('mf-local-users') || '[]'); } catch (e) { users = []; }
        var full = prefix + ' ' + String(phone).replace(/\D/g, '');
        var hash = btoa(unescape(encodeURIComponent(pass)));
        var u = users.filter(function (x) { return x.phone === full && x.pass === hash; })[0];
        if (!u) { $('auth-error').textContent = 'No existe esa cuenta en este dispositivo. Registrate primero.'; done(); return; }
        applyUser({ id: u.id, name: u.name, role: u.role, family: u.family, avatar: u.avatar, phone: u.phone }, 'Que bueno verte, ' + u.name.split(' ')[0]);
        document.dispatchEvent(new CustomEvent('mf-user-changed'));
        done();
      }
      if (mode === 'register') {
        var name = $('auth-name').value.trim();
        var family = $('auth-family').value.trim() || 'Mi Familia';
        var birthEl = $('auth-birth');
        var birthdate = birthEl ? birthEl.value : '';
        if (name.length < 2) { $('auth-error').textContent = 'Escribe tu nombre y apellido.'; done(); return; }
        if (!birthdate) { $('auth-error').textContent = 'Tu fecha de nacimiento es obligatoria para los cumpleanos.'; done(); return; }
        Api.register({ name: name, prefix: prefix, phone: phone, password: pass, family: family, role: 'Familiar', avatar: avatarData, birthdate: birthdate }).then(function (r) {
          done();
          avatarData = '';
          var pv = $('auth-avatar-preview');
          if (pv) { pv.src = ''; pv.classList.add('hidden'); }
          var cl = $('auth-avatar-clear');
          if (cl) cl.classList.add('hidden');
          applyUser(r.user, 'Cuenta creada. Bienvenido, ' + r.user.name.split(' ')[0]);
          document.dispatchEvent(new CustomEvent('mf-user-changed'));
        }).catch(function (err) {
          if (/ECONNREFUSED|500|Failed to fetch|NetworkError|Load failed/i.test(String(err.message))) {
            localRegister(name, family, prefix, phone, pass, avatarData, birthdate);
            return;
          }
          done();
          $('auth-error').textContent = cleanErr(err.message);
        });
      } else {
        Api.login({ prefix: prefix, phone: phone, password: pass }).then(function (r) {
          done();
          applyUser(r.user, 'Que bueno verte, ' + r.user.name.split(' ')[0]);
          document.dispatchEvent(new CustomEvent('mf-user-changed'));
        }).catch(function (err) {
          if (/ECONNREFUSED|500|Failed to fetch|NetworkError|Load failed/i.test(String(err.message))) {
            localLogin(prefix, phone, pass);
            return;
          }
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
      if (Store.restoreLocalUsers) Store.restoreLocalUsers();
    } catch (e) {}
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
    try { syncAdminUI(); } catch (e) {}
  }

  return { bind: bind, open: open, restore: restore, syncBtn: syncBtn, syncAdminUI: syncAdminUI, isAdmin: isAdmin, requireAuth: requireAuth, logged: logged, logout: logout };
})(Store, App, AppChat);
