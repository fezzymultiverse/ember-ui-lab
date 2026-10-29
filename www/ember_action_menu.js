'use strict';
(() => {
  const button = document.getElementById('bActionMenu');
  const menu = document.getElementById('headerActionsMenu');
  if (!button || !menu) return;
  const setOpen = open => {
    menu.classList.toggle('hidden', !open);
    button.classList.toggle('on', open);
    button.setAttribute('aria-expanded', String(open));
  };
  button.addEventListener('click', event => { event.stopPropagation(); setOpen(menu.classList.contains('hidden')); });
  menu.addEventListener('click', event => {
    const item = event.target.closest('.action-item');
    if (!item) return;
    setOpen(false);
    if (item.id === 'bActionMenu') return;
  });
  document.addEventListener('click', event => { if (!menu.classList.contains('hidden') && !event.target.closest('#headerActionsMenu') && !event.target.closest('#bActionMenu')) setOpen(false); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !menu.classList.contains('hidden')) { setOpen(false); button.focus(); } });
})();
