'use strict';
/* MiFamilia — PWA install: registra SW y muestra boton Instalar app. */
var Pwa = (function (App) {
  function register() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (e) {
        console.warn('SW no registrado:', e.message);
      });
    });
  }

  function bindInstall() {
    var btn = document.getElementById('install-btn');
    if (!btn) return;
    var deferred = null;

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferred = e;
      btn.classList.remove('hidden');
    });

    btn.addEventListener('click', function () {
      if (!deferred) {
        App.toast('Usa Compartir > Anadir a pantalla de inicio');
        return;
      }
      deferred.prompt();
      deferred.userChoice.then(function () {
        deferred = null;
        btn.classList.add('hidden');
      });
    });

    window.addEventListener('appinstalled', function () {
      btn.classList.add('hidden');
      App.toast('MiFamilia instalada como app');
    });
  }

  function init() { register(); bindInstall(); }
  return { init: init };
})(App);

document.addEventListener('DOMContentLoaded', Pwa.init);
