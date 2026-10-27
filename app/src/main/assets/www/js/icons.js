/* MyGoals — conjunto de ícones SVG (traço, 24×24). Ícones funcionais nunca usam emoji. */
(function (g) {
  'use strict';
  const MG = (g.MG = g.MG || {});
  const P = {
    today: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
    journey: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M9 20h6M10 17h4"/>',
    diary: '<path d="M6 4h12a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M9 9h6M9 13h6"/>',
    agenda: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
    settings: '<path d="M4 8h10M18 8h2M4 16h2M10 16h10"/><circle cx="16" cy="8" r="2"/><circle cx="8" cy="16" r="2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
    'chevron-left': '<path d="M15 5l-7 7 7 7"/>', 'chevron-right': '<path d="M9 5l7 7-7 7"/>', 'chevron-down': '<path d="M5 9l7 7 7-7"/>',
    flame: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.2 2-4.5.3 1.2 1 2 2 2.3-.5-3 .5-5.5 1-7.8z"/>',
    bolt: '<path d="M13 3L5 13h6l-1 8 8-10h-6l1-8z"/>', star: '<path d="M12 4l2.4 5 5.4.7-4 3.8 1 5.4-4.8-2.7-4.8 2.7 1-5.4-4-3.8 5.4-.7L12 4z"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>', flag: '<path d="M6 21V4M6 5h11l-2 4 2 4H6"/>',
    repeat: '<path d="M17 4l3 3-3 3M20 7H8a4 4 0 0 0-4 4M7 20l-3-3 3-3M4 17h12a4 4 0 0 0 4-4"/>',
    trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6"/>', edit: '<path d="M4 20l1-4L16 5l3 3L8 19l-4 1zM14 7l3 3"/>',
    pin: '<path d="M9 4h6l-1 5 3 3H7l3-3-1-5zM12 12v8"/>', search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
    download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>', upload: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
    sprout: '<path d="M12 20v-8M12 12c0-4 3-6 7-6 0 4-3 6-7 6zM12 14c0-3-2-5-6-5 0 3 2 5 6 5z"/>', leaf: '<path d="M5 19c0-8 5-14 14-14 0 9-6 14-14 14zM5 19l7-7"/>',
    tree: '<path d="M12 21v-5M12 3l5 7h-3l4 6H6l4-6H7l5-7z"/>', 'check-circle': '<circle cx="12" cy="12" r="8"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
    hammer: '<path d="M13 6l5 5M4 20l8-8M14 4l6 6-3 3-6-6 3-3z"/>', pencil: '<path d="M4 20l1-4L16 5l3 3L8 19l-4 1zM14 7l3 3"/>',
    book: '<path d="M5 5a2 2 0 0 1 2-2h12v15H7a2 2 0 0 0-2 2V5zM5 20a2 2 0 0 0 2 1h12"/>',
    brain: '<path d="M9 5a3 3 0 0 0-3 3 3 3 0 0 0-1 5 3 3 0 0 0 4 4 3 3 0 0 0 3 2V4a3 3 0 0 0-3 1zM15 5a3 3 0 0 1 3 3 3 3 0 0 1 1 5 3 3 0 0 1-4 4 3 3 0 0 1-3 2"/>',
    shield: '<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3z"/>', crown: '<path d="M4 8l4 4 4-7 4 7 4-4-2 11H6L4 8z"/>',
    sparkles: '<path d="M12 4l1.8 4.7L18.5 10l-4.7 1.8L12 16.5l-1.8-4.7L5.5 10l4.7-1.3L12 4zM18 16l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z"/>',
    heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
    gem: '<path d="M7 4h10l4 5-9 11L3 9l4-5zM3 9h18M9 4l3 5 3-5M12 20L9 9M12 20l3-11"/>', medal: '<circle cx="12" cy="15" r="5"/><path d="M8.5 3l3.5 6 3.5-6"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M9 20h6M10 17h4"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8"/>', compass: '<circle cx="12" cy="12" r="8"/><path d="M15.5 8.5l-2 5-5 2 2-5 5-2z"/>',
    map: '<path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2V6zM9 4v14M15 6v14"/>', trend: '<path d="M4 17l5-5 4 3 7-8M15 7h5v5"/>',
    puzzle: '<path d="M5 8h4V6a2 2 0 1 1 4 0v2h4v4h-2a2 2 0 1 0 0 4h2v4H5V8z"/>',
    scale: '<path d="M12 4v16M6 20h12M5 7h14M5 7l-3 7a3 3 0 0 0 6 0L5 7zM19 7l-3 7a3 3 0 0 0 6 0l-3-7z"/>',
    'calendar-check': '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4M9 15l2 2 4-4"/>',
    rocket: '<path d="M12 3c4 2 6 6 5 11l-3 3h-4l-3-3c-1-5 1-9 5-11zM9 17l-3 3 4-1M15 17l3 3-4-1"/><circle cx="12" cy="10" r="1.5"/>',
    clipboard: '<rect x="6" y="5" width="12" height="16" rx="2"/><path d="M9 5V4h6v1M9 11h6M9 15h4"/>', alert: '<path d="M12 4l9 16H3L12 4zM12 10v4M12 17v.5"/>',
    info: '<circle cx="12" cy="12" r="8"/><path d="M12 11v5M12 8v.5"/>', history: '<path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4M12 8v4l3 2"/>',
    user: '<circle cx="12" cy="9" r="3.5"/><path d="M5 20c1-4 4-5.5 7-5.5s6 1.5 7 5.5"/>', camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4V8z"/><circle cx="12" cy="13" r="3.5"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.5M4 12h.5M4 18h.5"/>', grid: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
    tag: '<path d="M4 4h8l8 8-8 8-8-8V4zM8 8h.5"/>', undo: '<path d="M9 8L4 13l5 5M4 13h11a5 5 0 0 0 0-10h-3"/>', lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    moonsun: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z"/>'
  };
  const icon = (name, cls) => '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (P[name] || P.star) + '</svg>';
  MG.icons = { icon, has: (n) => n in P };
  if (typeof module !== 'undefined') module.exports = MG.icons;
})(typeof globalThis !== 'undefined' ? globalThis : window);
