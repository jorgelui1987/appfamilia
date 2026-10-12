'use strict';
/* MiFamilia — Visor de fotos: zoom con botones, pellizca y doble toque. */
var Viewer = (function (App, AppChat) {
  var $ = App.$;
  var zoom = 1;
  var MIN = 1;
  var MAX = 4;

  function img() { return $('lightbox-img'); }
  function label() { return $('lb-zoom-label'); }

  function apply() {
    var el = img();
    if (!el) return;
    if (zoom <= 1) {
      el.style.width = '';
      el.style.transform = '';
    } else {
      el.style.width = (zoom * 100) + '%';
      el.style.maxWidth = 'none';
      el.style.transform = 'scale(1)';
    }
    var lb = label();
    if (lb) lb.textContent = Math.round(zoom * 100) + '%';
  }
  function setZoom(z) {
    zoom = Math.min(MAX, Math.max(MIN, z));
    apply();
  }

  function open(src, title, sub) {
    var modal = $('lightbox');
    if (!modal) return;
    var el = img();
    el.src = src;
    el.style.maxWidth = '100%';
    var t = $('lightbox-title');
    if (t) t.textContent = title || 'Foto';
    var s = $('lightbox-sub');
    if (s) s.textContent = sub || '';
    setZoom(1);
    try { document.body.style.overflow = 'hidden'; } catch (e) {}
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
  function close() {
    var modal = $('lightbox');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    try { document.body.style.overflow = ''; } catch (e) {}
    setZoom(1);
  }

  function bind() {
    var closeBtn = $('lightbox-close');
    if (closeBtn) closeBtn.addEventListener('click', close);
    var modal = $('lightbox');
    if (modal) modal.addEventListener('click', function (e) {
      if (e.target.id === 'lightbox' || e.target.id === 'lightbox-stage') close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
      if (!modal || modal.classList.contains('hidden')) return;
      if (e.key === '+' || e.key === '=') setZoom(zoom + 0.5);
      if (e.key === '-') setZoom(zoom - 0.5);
      if (e.key === '0') setZoom(1);
    });
    var zin = $('lb-zoom-in');
    if (zin) zin.addEventListener('click', function () { setZoom(zoom + 0.5); });
    var zout = $('lb-zoom-out');
    if (zout) zout.addEventListener('click', function () { setZoom(zoom - 0.5); });
    var zr = $('lb-zoom-reset');
    if (zr) zr.addEventListener('click', function () { setZoom(1); });

    // Pellizca + doble toque en movil.
    var stage = $('lightbox-stage');
    if (stage) {
      var startDist = 0;
      var startZoom = 1;
      stage.addEventListener('touchstart', function (e) {
        if (e.touches.length === 2) {
          startDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          startZoom = zoom;
        }
      }, { passive: true });
      stage.addEventListener('touchmove', function (e) {
        if (e.touches.length === 2 && startDist > 0) {
          var d = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          setZoom(startZoom * (d / startDist));
        }
      }, { passive: true });
      var lastTap = 0;
      stage.addEventListener('touchend', function (e) {
        if (e.touches.length > 0) return;
        var now = Date.now();
        // Doble toque solo sobre la imagen, no sobre botones.
        if (e.target.closest && e.target.closest('button')) return;
        if (now - lastTap < 300) setZoom(zoom > 1 ? 1 : 2.2);
        lastTap = now;
      });
    }
    var el = img();
    if (el) {
      // Doble clic en PC tambien alterna zoom.
      el.addEventListener('dblclick', function () { setZoom(zoom > 1 ? 1 : 2.2); });
      // Rueda con Ctrl hace zoom en PC.
      el.addEventListener('wheel', function (e) {
        if (!e.ctrlKey) return;
        e.preventDefault();
        setZoom(zoom + (e.deltaY < 0 ? 0.25 : -0.25));
      }, { passive: false });
    }
  }

  return { bind: bind, open: open, close: close, setZoom: setZoom };
})(App, AppChat);
