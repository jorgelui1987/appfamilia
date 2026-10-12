'use strict';
/* MiFamilia — Extras B1: reacciones + encuestas. */
var ExtrasB = (function (Store, App, Extras) {
  var $ = App.$;
  var escapeHtml = App.escapeHtml;
  var REACTS = ['❤️', '😂', '😮', '😢', '👏'];

  function toggleReact(postId, emoji) {
    var found = null;
    Store.posts.forEach(function (p) { if (String(p.id) === String(postId)) found = p; });
    if (!found) return;
    if (!found.reacts) found.reacts = {};
    if (found.myReact === emoji) {
      found.reacts[emoji] = Math.max(0, (found.reacts[emoji] || 1) - 1);
      found.myReact = null;
    } else {
      if (found.myReact) found.reacts[found.myReact] = Math.max(0, (found.reacts[found.myReact] || 1) - 1);
      found.reacts[emoji] = (found.reacts[emoji] || 0) + 1;
      found.myReact = emoji;
    }
    Extras.save('mf-reacts', Store.posts.map(function (p) { return { id: p.id, reacts: p.reacts || {}, myReact: p.myReact || null }; }));
  }

  function restoreReacts() {
    Extras.load('mf-reacts', []).forEach(function (sv) {
      Store.posts.forEach(function (p) {
        if (String(p.id) === String(sv.id)) { p.reacts = sv.reacts; p.myReact = sv.myReact; }
      });
    });
  }

  function renderReacts(post, container) {
    var box = document.createElement('div');
    box.className = 'flex items-center gap-1 flex-wrap';
    var total = 0;
    REACTS.forEach(function (e) {
      var n = (post.reacts && post.reacts[e]) || 0;
      total += n;
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.react = e;
      b.className = 'text-sm px-2 py-1 rounded-full border transition ' + (post.myReact === e ? 'bg-emerald-50 border-emerald-500 react-pop' : 'border-slate-200 hover:bg-slate-50');
      b.setAttribute('aria-label', 'Reaccionar ' + e);
      b.textContent = e + (n ? ' ' + n : '');
      box.appendChild(b);
    });
    if (total > 0) {
      var t = document.createElement('span');
      t.className = 'text-[11px] text-slate-400 ml-1';
      t.textContent = total + ' reacciones';
      box.appendChild(t);
    }
    container.appendChild(box);
  }

  function seedPolls() {
    if (!Store.polls) Store.polls = [
      { id: 'p1', q: 'Donde hacemos el almuerzo del domingo?', opts: [{ t: 'Casa de los abuelos', v: [1, 2] }, { t: 'Casa de Carlos', v: [3] }, { t: 'Restaurante', v: [] }] }
    ];
  }

  function renderPolls() {
    var box = $('polls-box');
    if (!box) return;
    box.innerHTML = '';
    var me = Store.state.currentUserId;
    Store.polls.forEach(function (poll) {
      var total = poll.opts.reduce(function (a, o) { return a + o.v.length; }, 0);
      var card = document.createElement('div');
      card.className = 'bg-white p-5 rounded-2xl shadow-sm border border-slate-200 fade-in';
      card.dataset.poll = poll.id;
      var html = '<h4 class="font-bold text-sm mb-3"><i class="fa-solid fa-square-poll-vertical text-emerald-600 mr-2"></i>' + escapeHtml(poll.q) + '</h4>';
      poll.opts.forEach(function (o, i) {
        var pct = total ? Math.round((o.v.length / total) * 100) : 0;
        var mine = o.v.indexOf(me) > -1;
        html += '<button type="button" data-vote="' + i + '" class="w-full text-left mb-2 p-2.5 rounded-xl border text-xs transition ' + (mine ? 'border-emerald-500 bg-emerald-50 font-bold' : 'border-slate-200 hover:border-emerald-300') + '"><span class="flex justify-between mb-1"><span>' + escapeHtml(o.t) + '</span><span class="font-bold">' + pct + '%</span></span><span class="block h-2 bg-slate-100 rounded-full overflow-hidden"><span class="poll-bar block h-full bg-emerald-500 rounded-full" style="width:' + pct + '%"></span></span></button>';
      });
      html += '<p class="text-[11px] text-slate-400">' + total + ' votos de la familia</p>';
      card.innerHTML = html;
      box.appendChild(card);
    });
  }

  function vote(pollId, idx) {
    var me = Store.state.currentUserId;
    Store.polls.forEach(function (poll) {
      if (poll.id !== pollId) return;
      poll.opts.forEach(function (o) {
        var i = o.v.indexOf(me);
        if (i > -1) o.v.splice(i, 1);
      });
      poll.opts[idx].v.push(me);
    });
    renderPolls();
  }

  return { toggleReact: toggleReact, restoreReacts: restoreReacts, renderReacts: renderReacts, seedPolls: seedPolls, renderPolls: renderPolls, vote: vote };
})(Store, App, Extras);
