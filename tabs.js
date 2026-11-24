// ---------- Pestañas: Dashboard / Historia ----------
(() => {
  const tabs = [...document.querySelectorAll('#dash-root .vw-tabs [data-tab]')];
  const secs = { tablero: document.querySelector('#dash-root #tablero'), historia: document.querySelector('#dash-root #historia') };
  const open = (k, link) => {
    Object.entries(secs).forEach(([n, s]) => { if (s) s.hidden = n !== k; });
    tabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === k)));
    if (link) dash.setLink(k);
    if (k === 'historia') dash.draw('escena');
  };
  tabs.forEach((b) => b.addEventListener('click', () => open(b.dataset.tab, true)));
  open(location.hash === '#historia' ? 'historia' : 'tablero', false);
})();
