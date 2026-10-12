'use strict';
/* MiFamilia — Auth: registro + login con sesion persistente. */
var Auth = (function (Store, App, AppChat) {
  var $ = App.$;
  var mode = 'login';

  function setMode(m) {
    mode = m;
    var isReg = m === 'register';
    $('auth-name-wrap').classList.toggle('hidden', !isReg);
    $('auth-family-wrap').classList.toggle('hidden', !isReg);
    $('auth-submit').textContent = isReg ? 'Crear mi cuenta' : 'Entrar';
    $('auth-tab-login').className = 'flex-1 py-2 rounded-xl ' + (!isReg ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600');
    $('auth-tab-register').className = 'flex-1 py-2 rounded-xl ' + (isReg ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600');
    $('auth-tab-login').setAttribute('aria-selected', String(!isReg));
    $('auth-tab-register').setAttribute('aria-selected', String(isReg));
    $('auth-error').textContent = '';
  }

  function open() {
    setMode('login');
    AppChat.openModal('auth-modal');
    setTimeout(function () { $('auth-email').focus(); }, 100);
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

  function bind() {
    var btn = $('auth-btn');
    if (btn) btn.addEventListener('click', function () {
      try {
        var s = JSON.parse(localStorage.getItem('mf-session') || 'null');
        if (s && s.id) {
          localStorage.removeItem('mf-session');
          Store.state.currentUserId = Store.users[0].id;
          App.toast('Sesion cerrada (modo invitado)');
          document.dispatchEvent(new CustomEvent('mf-user-changed'));
          return;
        }
      } catch (e) {}
      open();
    });
    $('auth-tab-login').addEventListener('click', function () { setMode('login'); });
    $('auth-tab-register').addEventListener('click', function () { setMode('register'); });
    $('auth-form').addEventListener('submit', function (e) {
      e.preventDefault();
      $('auth-error').textContent = '';
      var email = $('auth-email').value.trim();
      var pass = $('auth-pass').value;
      var submit = $('auth-submit');
      submit.disabled = true;
      function done() { submit.disabled = false; }
      if (mode === 'register') {
        var name = $('auth-name').value.trim();
        var family = $('auth-family').value.trim() || 'Mi Familia';
        Api.register({ name: name, email: email, password: pass, family: family, role: 'Familiar' }).then(function (r) {
          done();
          applyUser(r.user, 'Cuenta creada. Bienvenido, ' + r.user.name.split(' ')[0]);
          document.dispatchEvent(new CustomEvent('mf-user-changed'));
        }).catch(function (err) {
          done();
          $('auth-error').textContent = cleanErr(err.message);
        });
      } else {
        Api.login({ email: email, password: pass }).then(function (r) {
          done();
          applyUser(r.user, 'Que bueno verte, ' + r.user.name.split(' ')[0]);
          document.dispatchEvent(new CustomEvent('mf-user-changed'));
        }).catch(function (err) {
          done();
          $('auth-error').textContent = cleanErr(err.message);
        });
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') AppChat.closeModal('auth-modal');
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

  return { bind: bind, open: open, restore: restore, syncBtn: syncBtn };
})(Store, App, AppChat);
