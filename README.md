# MiFamilia — Versión Profesional

Refactor de tu archivo único `MiFamilia` a estructura profesional, manteniendo Tailwind + FontAwesome.

## Estructura
```
mifamilia/
├── index.html      → Estructura semántica, sin JS inline
├── css/styles.css  → Solo extras (scrollbars, focus, animaciones)
├── js/store.js     → Datos + estado global
├── js/app.js       → Lógica UI (tabs, feed, chat, modales, toast)
└── README.md
```

## Qué se mejoró (nivel profesional)
1. **Separación de responsabilidades**: HTML / CSS / JS en archivos.
2. **Sin `onclick` inline**: todo con `addEventListener` + `data-action` / delegación.
3. **Seguridad XSS**: `escapeHtml()` antes de inyectar comentarios/captions/nombres.
4. **Accesibilidad**: skip-link, landmarks, `aria-label`, `role=dialog aria-modal`, ESC cierra, `aria-live` en chat y toast.
5. **UX profesional**: lightbox propio (ya no `window.open`), toast (ya no `alert/prompt`), preview valida tipo/peso, estados vacíos, buscador de chats funcional.
6. **JS moderno**: `'use strict'`, IIFE + namespaces `Store` / `App`, funciones pequeñas, constantes.
7. **SEO/perf**: `meta description`, `theme-color`, `preconnect`, `defer`, favicon SVG.

## Cómo usar
Abre `mifamilia/index.html` con Live Server. Todo sigue en memoria (sin backend), igual que tu versión.
