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
    document.getElementById('lightbox-close').addEventListener('click', function () {
      AppChat.closeModal('lightbox');
    });
    document.getElementById('lightbox').addEventListener('click', function (e) {
      if (e.target.id === 'lightbox') AppChat.closeModal('lightbox');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        AppChat.closeModal('upload-modal');
        AppChat.closeModal('user-modal');
        AppChat.closeModal('lightbox');
      }
    });
    var posts = document.getElementById('posts-container');
    posts.addEventListener('click', function (e) {
      var likeBtn = e.target.closest('[data-action="like"]');
      var photo = e.target.closest('[data-action="view-photo"]');
      if (likeBtn) {
        var card = likeBtn.closest('[data-post-id]');
        Backend.toggleLike(Number(card.dataset.postId)).then(function () { App.renderPosts(); });
        return;
      }
      if (photo) {
        document.getElementById('lightbox-img').src = photo.src;
        AppChat.openModal('lightbox');
      }
    });
    var gotoChat = document.querySelector('[data-goto-chat]');
    if (gotoChat) gotoChat.addEventListener('click', function () { App.switchTab('chat'); });
    var invite = document.getElementById('invite-btn');
    if (invite) invite.addEventListener('click', function () { App.toast('Enlace de invitacion copiado para WhatsApp'); });
    var evBtn = document.getElementById('event-btn');
    if (evBtn) evBtn.addEventListener('click', function () { App.toast('Proximamente: crear evento'); });
    var confirm = document.getElementById('confirm-btn');
    if (confirm) confirm.addEventListener('click', function () { App.toast('Asistencia confirmada'); });
  }
  function init() {
    bindGlobal();
    AppChat.bindChat();
    AppForms.bindForms();
    AppForms.updateUserUI();
    App.renderPosts();
    AppChat.renderChannels();
    AppChat.renderMessages();
    AppForms.renderFamilies();
    Backend.load().then(function () {
      AppForms.updateUserUI();
      App.renderPosts();
      AppChat.renderChannels();
      AppChat.renderMessages();
      AppForms.renderFamilies();
    });
  }
  return { init: init };
})(Store, App, AppChat, AppForms);

document.addEventListener('DOMContentLoaded', AppMain.init);
