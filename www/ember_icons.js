// Ember V1.10.11 - ember_icons.js: one small icon set for every menu (Hub panel + Settings).
// Line icons on a 24 x 24 grid, drawn with currentColor so a row can tint them. Loaded before ember_hub.js.
'use strict';
(() => {
  const P = {
    sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    key: '<circle cx="8" cy="15" r="3.5"/><path d="M10.6 12.4L19 4M16 7l3 3M13.5 9.5l2 2"/>',
    branch: '<circle cx="6" cy="5.5" r="2"/><circle cx="6" cy="18.5" r="2"/><circle cx="18" cy="9" r="2"/><path d="M6 7.5v9M18 11c0 3-3 4-10 5.5"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16v4M17 18h4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    terminal: '<rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M7.5 10l3 2.5-3 2.5M13 15h4"/>',
    music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    shield: '<path d="M12 3l7 3v5.5c0 4.2-3 7.7-7 9.5-4-1.8-7-5.3-7-9.5V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
    user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.5-5.5 7-5.5s6.2 1.9 7 5.5"/>',
    wave: '<path d="M4 11v2M7.5 8v8M11 5v14M14.5 9v6M18 7v10M21 11v2"/>',
    doc: '<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5H7a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5z"/><path d="M14 3.5V8h4.5M9.5 12h5M9.5 15.5h5"/>',
    chip: '<rect x="6" y="6" width="12" height="12" rx="2.5"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
    phone: '<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/>',
    palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-1 1.5-2.2-.6-1.4.2-2.8 1.8-2.8H17a3.5 3.5 0 0 0 3.5-3.5C20.5 7 16.8 3.5 12 3.5z"/><circle cx="8" cy="11" r=".8"/><circle cx="11" cy="7.5" r=".8"/><circle cx="15.5" cy="8.5" r=".8"/>',
    chart: '<path d="M5 20V11M10 20V5M15 20v-6M20 20V9"/>',
    db: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
    bolt: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 3.5 3 3-2.5 4.5 4"/>',
    route: '<circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="18" r="2.2"/><path d="M8 6h5.5a3 3 0 0 1 0 6h-3a3 3 0 0 0 0 6H16"/>',
    clip: '<rect x="5.5" y="5" width="13" height="16" rx="2.5"/><path d="M9 5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M9 11h6M9 15h4"/>',
    cloud: '<path d="M7.5 18.5h9a3.8 3.8 0 0 0 .5-7.56A5.5 5.5 0 0 0 6.6 9.9a4.3 4.3 0 0 0 .9 8.6z"/>',
    note: '<path d="M6 4.5h12a.5.5 0 0 1 .5.5v14a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5V5a.5.5 0 0 1 .5-.5z"/><path d="M9 9h6M9 12.5h6M9 16h3"/>',
    play: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5l5 3.5-5 3.5z"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/>',
    search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 21h4"/>',
    plug: '<path d="M9 3v5M15 3v5M7 8h10v3.5a5 5 0 0 1-10 0z"/><path d="M12 16.5V21"/>',
    speaker: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>',
    panel: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M3.5 9h17M7 13.5h4"/>',
    chevR: '<path d="M9 6l6 6-6 6"/>',
    chevL: '<path d="M15 6l-6 6 6 6"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>'
  };
  // tint of the icon tile: o = Ember orange, b = blue, g = green, p = purple
  const TONE = {
    key: 'g', shield: 'g', db: 'g', branch: 'o', bolt: 'o', terminal: 'o', play: 'o', panel: 'o', spark: 'o',
    music: 'p', wave: 'p', speaker: 'p', mic: 'p', palette: 'p'
  };
  const SEC = { general: 'sliders', keys: 'key', github: 'branch', features: 'spark', advanced: 'gear', scraping: 'globe', hacking: 'terminal', music: 'music', permissions: 'shield' };
  const svg = (name, size, cls) => {
    const s = size || 18;
    return '<svg class="' + (cls || 'em-i') + '" viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (P[name] || P.gear) + '</svg>';
  };
  // the rounded tile that sits at the left of a menu row
  const tile = name => '<span class="em-tile" data-tone="' + (TONE[name] || 'b') + '">' + svg(name, 18) + '</span>';
  window.EmberIcons = { svg, tile, SEC, TONE, has: n => !!P[n] };
})();
