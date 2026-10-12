'use strict';
/* MiFamilia — Store: datos + estado. Sin lógica DOM aquí. */
var Store = (function () {
  var users = [
    { id: 1, name: 'Carlos Castro', role: 'Papa', family: 'Familia Castro', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80' },
    { id: 2, name: 'Maria Perez', role: 'Tia', family: 'Familia Perez', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80' },
    { id: 3, name: 'Lucas Perez', role: 'Primo', family: 'Familia Perez', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&q=80' },
    { id: 4, name: 'Sofia Castro', role: 'Hija', family: 'Familia Castro', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80' }
  ];

  var state = {
    currentUserId: 1,
    activeTab: 'feed',
    feedFilter: 'all',
    activeChatId: 'gen',
    chatSearch: ''
  };

  var posts = [
    {
      id: 101, userId: 2, userName: 'Maria Perez', userFamily: 'Familia Perez',
      userAvatar: users[1].avatar,
      imageUrl: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=800&q=80',
      caption: 'Que hermosa tarde pasamos en el campo el domingo. Los abuelos estaban felices de ver a los nietos reunidos.',
      tag: 'Vacaciones', timestamp: 'Hace 2 horas',
      likes: [1, 3, 4],
      comments: [
        { id: 1, userName: 'Carlos Castro', text: 'Estuvo excelente el asado. Hay que repetirlo pronto.' },
        { id: 2, userName: 'Sofia Castro', text: 'Tia, pasame las fotos originales porfa' }
      ]
    },
    {
      id: 102, userId: 1, userName: 'Carlos Castro', userFamily: 'Familia Castro',
      userAvatar: users[0].avatar,
      imageUrl: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=800&q=80',
      caption: 'Foto del recuerdo del cumpleanos de Sofia el ano pasado. Como pasa el tiempo de rapido.',
      tag: 'Cumpleanos', timestamp: 'Ayer a las 8:30 PM',
      likes: [2],
      comments: [{ id: 3, userName: 'Lucas Perez', text: 'Se paso genial ese dia.' }]
    }
  ];

  var channels = [
    { id: 'gen', name: 'Chat General Familiar', subtitle: 'Todos los integrantes', type: 'group', icon: 'fa-users', color: 'bg-emerald-600' },
    { id: 'recetas', name: 'Recetas de la Abuela', subtitle: 'Secretos de cocina', type: 'group', icon: 'fa-utensils', color: 'bg-amber-600' },
    { id: 'maria', name: 'Tia Maria', subtitle: 'En linea', type: 'direct', avatar: users[1].avatar }
  ];

  var messages = {
    gen: [
      { sender: 'Maria Perez', text: 'Hola a todos. A que hora nos encontramos el domingo en casa de la abuela?', time: '10:15 AM' },
      { sender: 'Carlos Castro', text: 'Llegamos a las 1:30 PM para ayudar con el almuerzo.', time: '10:18 AM' },
      { sender: 'Lucas Perez', text: 'Yo llevo el postre y la musica.', time: '10:22 AM' }
    ],
    recetas: [
      { sender: 'Maria Perez', text: 'Alguien tiene la receta exacta de las empanadas de la abuela?', time: 'Lunes' }
    ],
    maria: [
      { sender: 'Maria Perez', text: 'Hola Carlos, como estan los chicos?', time: '09:00 AM' }
    ]
  };

  function getUser(id) { return users.find(function (u) { return String(u.id) === String(id); }); }
  function currentUser() { return getUser(state.currentUserId); }

  function restoreLocalUsers() {
    try {
      var locals = JSON.parse(localStorage.getItem('mf-local-users') || '[]');
      if (Array.isArray(locals)) {
        locals.forEach(function (lu) {
          if (!lu || !lu.id) return;
          if (!getUser(lu.id)) {
            users.push({ id: lu.id, name: lu.name, role: lu.role || 'Familiar', family: lu.family || 'Mi Familia', avatar: lu.avatar || '' });
          }
        });
      }
    } catch (e) {}
  }

  return { users: users, posts: posts, channels: channels, messages: messages, state: state, backend: { ok: false }, online: {}, getUser: getUser, currentUser: currentUser, restoreLocalUsers: restoreLocalUsers };
})();
