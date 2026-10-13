'use strict';
/* MiFamilia — Init: une Store + App + Chat + Forms. */
var AppMain = (function (Store, App, AppChat, AppForms) {
  function bindGlobal() {
    var tabs = document.querySelectorAll('[data-tab]');
    tabs.forEach(function (b) {
      b.addEventListener('click', function () { App.switchTab(b.dataset.tab); });
    });
    var filters = document.querySelectorAll('[data-filter]');
    filters.forEach(function (b) {
      b.addEventListener('click', function () {
        Store.state.feedFilter = b.dataset.filter;
        var all = document.querySelectorAll('.filter-btn');
        all.forEach(function (x) {
          var on = x === b;
          x.classList.toggle('bg-emerald-50', on);
          x.classList.toggle('text-emerald-700', on);
          x.classList.toggle('text-slate-600', !on);
        });
        App.renderPosts();
      });
    });
    var openers = document.querySelectorAll('[data-open-upload]');
    openers.forEach(function (b) {
      b.addEventListener('click', function () { AppChat.openModal('upload-modal'); });
    });
    var closers = document.querySelectorAll('[data-close-upload]');
    closers.forEach(function (b) {
      b.addEventListener('click', function () { AppChat.closeModal('upload-modal'); });
    });
    var closeUser = document.querySelectorAll('[data-close-user]');
    closeUser.forEach(function (b) {
      b.addEventListener('click', function () { AppChat.closeModal('user-modal'); });
    });
    document.getElementById('user-switch-btn').addEventListener('click', function () {
      AppForms.renderUserSelector();
      AppChat.openModal('user-modal');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        AppChat.closeModal('upload-modal');
        AppChat.closeModal('user-modal');
      }
    });
    var posts = document.getElementById('posts-container');
    posts.addEventListener('click', function (e) {
      var likeBtn = e.target.closest('[data-action="like"]');
      var photo = e.target.closest('[data-action="view-photo"]');
      var react = e.target.closest('[data-react]');
      if (react) {
        var rc = react.closest('[data-post-id]');
        ExtrasB.toggleReact(rc.dataset.postId, react.dataset.react);
        App.renderPosts();
        return;
      }
      if (likeBtn) {
        var card = likeBtn.closest('[data-post-id]');
        Backend.toggleLike(card.dataset.postId).then(function () { App.renderPosts(); });
        return;
      }
      if (photo) {
        var card = photo.closest('[data-post-id]');
        var title = 'Foto';
        var sub = '';
        if (card) {
          var pid = card.dataset.postId;
          var found = null;
          Store.posts.forEach(function (p) { if (String(p.id) === String(pid)) found = p; });
          if (found) {
            title = found.caption ? String(found.caption).slice(0, 60) : 'Foto';
            sub = (found.userName || '') + (found.timestamp ? ' · ' + found.timestamp : '');
          }
        }
        if (typeof Viewer !== 'undefined') Viewer.open(photo.src, title, sub);
        else {
          document.getElementById('lightbox-img').src = photo.src;
          AppChat.openModal('lightbox');
        }
      }
    });
    var gotoChat = document.querySelector('[data-goto-chat]');
    if (gotoChat) gotoChat.addEventListener('click', function () { App.switchTab('chat'); });
    var invite = document.getElementById('invite-btn');
    if (invite) invite.addEventListener('click', function () {
      var link = location.origin + location.pathname + '#registro';
      var txt = document.getElementById('invite-link-text');
      if (txt) txt.textContent = link;
      var err = document.getElementById('invite-error');
      if (err) err.textContent = '';
      AppChat.openModal('invite-modal');
    });
    var invClose = document.getElementById('invite-close');
    if (invClose) invClose.addEventListener('click', function () { AppChat.closeModal('invite-modal'); });
    var invCopy = document.getElementById('invite-copy');
    if (invCopy) invCopy.addEventListener('click', function () {
      var link = (document.getElementById('invite-link-text') || {}).textContent || location.href;
      function done() { App.toast('Enlace copiado. Pasalo por WhatsApp'); }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done, function () { fallbackCopy(link); done(); });
        else { fallbackCopy(link); done(); }
      } catch (e) { fallbackCopy(link); done(); }
      function fallbackCopy(t) {
        try {
          var ta = document.createElement('textarea');
          ta.value = t; document.body.appendChild(ta); ta.select();
          document.execCommand('copy'); ta.remove();
        } catch (ee) {}
      }
    });
    var invWa = document.getElementById('invite-wa');
    if (invWa) invWa.addEventListener('click', function () {
      var link = (document.getElementById('invite-link-text') || {}).textContent || location.href;
      var msg = 'Unete a MiFamilia (privado): ' + link;
      location.href = 'https://wa.me/?text=' + encodeURIComponent(msg);
    });
    var evBtn = document.getElementById('event-btn');
    if (evBtn) evBtn.addEventListener('click', function () { App.toast('Proximamente: crear evento'); });
    var confirm = document.getElementById('confirm-btn');
    if (confirm) confirm.addEventListener('click', function () { App.toast('Asistencia confirmada'); });
    var party = document.getElementById('party-btn');
    if (party) party.addEventListener('click', function () { ExtrasC.confetti(120); ExtrasC.award('fiestero', 'Has celebrado con la familia'); });
    var storiesBar = document.getElementById('stories-bar');
    if (storiesBar) storiesBar.addEventListener('click', function (e) {
      var s = e.target.closest('[data-story]');
      if (s) { Extras.openStory(s.dataset.story); return; }
      if (e.target.closest('#story-add')) { Extras.addStory('https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=600&q=70', 'Mi nueva historia'); App.toast('Historia publicada por 24h'); }
    });
    var storyClose = document.getElementById('story-close');
    if (storyClose) storyClose.addEventListener('click', Extras.closeStory);
    var storyModal = document.getElementById('story-modal');
    if (storyModal) storyModal.addEventListener('click', function (e) { if (e.target.id === 'story-modal') Extras.closeStory(); });
    var pollsBox = document.getElementById('polls-box');
    if (pollsBox) pollsBox.addEventListener('click', function (e) {
      var v = e.target.closest('[data-vote]');
      if (!v) return;
      var card = v.closest('[data-poll]');
      ExtrasB.vote(card.dataset.poll, Number(v.dataset.vote));
      ExtrasC.award('votante', 'Has votado en una encuesta familiar');
    });
  }
  function init() {
    if (Store.restoreLocalUsers) Store.restoreLocalUsers();
    bindGlobal();
    AppChat.bindChat();
    AppForms.bindForms();
    Auth.bind();
    Auth.restore();
    if (typeof Sound !== 'undefined') Sound.bind();
    if (typeof Viewer !== 'undefined') Viewer.bind();
    Extras.initTheme();
    Extras.seedStories();
    ExtrasB.restoreReacts();
    ExtrasB.seedPolls();
    ExtrasC.seedBadges();
    ExtrasC.bindSearch();
    AppForms.updateUserUI();
    App.renderPosts();
    Extras.renderStories();
    ExtrasB.renderPolls();
    ExtrasC.renderBadges();
    AppChat.renderChannels();
    AppChat.renderMessages();
    AppForms.renderFamilies();
    AppForms.renderBirthdays();
    Auth.syncBtn();
    // Acceso obligatorio: primero telefono + contrasena, despues la app.
    Auth.requireAuth();
    Backend.load().then(function () {
      Auth.restore();
      AppForms.updateUserUI();
      App.renderPosts();
      Extras.renderStories();
      ExtrasB.renderPolls();
      ExtrasC.renderBadges();
      AppChat.renderChannels();
      AppChat.renderMessages();
      AppForms.renderFamilies();
      AppForms.renderBirthdays();
      Auth.syncBtn();
    });
    document.addEventListener('mf-user-changed', function () {
      AppForms.updateUserUI();
      App.renderPosts();
      AppForms.renderFamilies();
      AppForms.renderBirthdays();
      Auth.syncBtn();
    });
    // Boton Felicitar en cumpleanos -> abre el privado con esa persona.
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-bday-dm]');
      if (b && typeof AppChat !== 'undefined' && AppChat.openDM) AppChat.openDM(b.getAttribute('data-bday-dm'));
    });
  }
  return { init: init };
})(Store, App, AppChat, AppForms);

document.addEventListener('DOMContentLoaded', AppMain.init);
