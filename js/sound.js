'use strict';
/* MiFamilia — Sonido de mensajes con interruptor de silencio. */
var Sound = (function (App) {
  var $ = App.$;
  var ctx = null;

  function enabled() {
    try {
      var v = localStorage.getItem('mf-sound');
      return v === null ? true : v === '1';
    } catch (e) { return true; }
  }
  function setEnabled(on) {
    try { localStorage.setItem('mf-sound', on ? '1' : '0'); } catch (e) {}
    syncBtn();
  }
  function ensureCtx() {
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (e) { return null; }
  }
  function play() {
    if (!enabled()) return;
    var ac = ensureCtx();
    if (!ac) return;
    try {
      var t = ac.currentTime;
      [660, 880].forEach(function (f, i) {
        var o = ac.createOscillator();
        var g = ac.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + i * 0.12);
        g.gain.exponentialRampToValueAtTime(0.25, t + i * 0.12 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.18);
        o.connect(g);
        g.connect(ac.destination);
        o.start(t + i * 0.12);
        o.stop(t + i * 0.12 + 0.2);
      });
    } catch (e) {}
  }
  function syncBtn() {
    var btn = $('sound-btn');
    if (!btn) return;
    var on = enabled();
    btn.innerHTML = on ? '<i class="fa-solid fa-bell"></i>' : '<i class="fa-solid fa-bell-slash"></i>';
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Silenciar avisos de chat' : 'Activar avisos de chat');
    btn.title = on ? 'Sonido activado (toca para silenciar)' : 'Sonido silenciado (toca para activar)';
  }
  function bind() {
    var btn = $('sound-btn');
    if (btn) btn.addEventListener('click', function () {
      setEnabled(!enabled());
      if (enabled()) {
        play();
        App.toast('Sonido activado');
      } else {
        App.toast('Avisos en silencio');
      }
    });
    // Desbloquea audio en movil: iOS/Android exigen gesto antes de sonar.
    var unlock = function () {
      try {
        var ac = ensureCtx();
        if (ac) {
          var o = ac.createOscillator();
          var g = ac.createGain();
          g.gain.value = 0.0001;
          o.connect(g);
          g.connect(ac.destination);
          o.start();
          o.stop(ac.currentTime + 0.05);
        }
      } catch (e) {}
    };
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('touchend', unlock, { once: true });
    syncBtn();
  }
  return { bind: bind, play: play, enabled: enabled, syncBtn: syncBtn };
})(App);
