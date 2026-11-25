// Runtime mínimo que reemplaza al de Claude: carga las tablas desde la API de la app,
// calcula los dash.calc y ejecuta los dibujos (data-draw) cuando cambian datos, filtros o ancho.
(() => {
  // Cada fuente: 'table' = tabla Delta servida por /api/table/<nombre>; 'static:<ruta>' = archivo de la app.
  const SOURCES = {
    corregimientos: 'table', escuelas: 'table', salud: 'table', laboral_provincias: 'table', laboral_area: 'table',
    informalidad: 'table', mortalidad: 'table', mortalidad_infantil: 'table', lugares_poblados: 'table',
    defunciones_sitio: 'table', externos: 'table', escuelas_servicios: 'table', servicios_escuelas_ref: 'table', mapa: 'static:data/mapa_corregimientos.json',
  };
  const DEFAULT_PARAMS = { anio: 2023, distrito: '', capa: 'pgen', pob_ind: 'pgen', lab_ind: 'ocup_mineria', rama_prov: 'Colón', rama_area: 'Total', ov_mina: true, ov_esc: false, ov_sal: false, ov_lbl: true, ov_srv: false, srv_tipo: 'internet' };

  const sources = {}; // id -> {status, data, message}
  const calcs = {};   // id -> def
  const memo = new Map();
  const draws = {};   // name -> fn | {mount, update, unmount}
  const mounted = new WeakMap();
  const onDataFns = [];
  let params = { ...DEFAULT_PARAMS };
  let started = false, scheduled = false;
  const root = () => document.getElementById('dash-root');

  Object.keys(SOURCES).forEach((id) => { sources[id] = { status: 'loading', data: [] }; });

  function evalCalc(id) {
    if (memo.has(id)) return memo.get(id);
    const def = calcs[id];
    const ins = def.inputs.map((i) => dash.data(i));
    let res;
    const bad = ins.find((d) => d.status !== 'ok');
    if (bad) res = { status: bad.status === 'loading' ? 'loading' : 'error', data: null, message: bad.message };
    else {
      try { res = { status: 'ok', data: def.fn(...ins.map((d) => d.data)) }; }
      catch (e) { console.error(`Cálculo ${id}:`, e); res = { status: 'error', data: null, message: String(e) }; }
    }
    memo.set(id, res);
    return res;
  }

  function runEl(el) {
    const fn = draws[el.dataset.draw];
    if (!fn) return;
    try {
      if (typeof fn === 'function') fn(el);
      else {
        if (!mounted.has(el)) { el.replaceChildren(); mounted.set(el, fn.mount ? fn.mount(el) : undefined); }
        if (fn.update) fn.update(el, mounted.get(el));
      }
    } catch (e) { console.error(`Dibujo ${el.dataset.draw}:`, e); }
  }

  function renderAll(only) {
    const r = root(); if (!r) return;
    if (!only) onDataFns.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
    const sel = only ? `[data-draw="${only}"]` : '[data-draw]';
    r.querySelectorAll(sel).forEach((el) => { if (!el.closest('[hidden]')) runEl(el); });
  }
  function schedule() {
    if (scheduled || !started) return; scheduled = true;
    requestAnimationFrame(() => { scheduled = false; renderAll(); });
  }

  const dash = {
    colors: ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)'],
    data(id) {
      if (calcs[id]) return evalCalc(id);
      return sources[id] || { status: 'missing', data: [] };
    },
    calc(id, def) { calcs[id] = def; memo.delete(id); },
    loader() {},
    draw(name, fn) {
      if (fn === undefined) { if (started) renderAll(name); return; }
      draws[name] = fn;
    },
    onData(fn) { onDataFns.push(fn); if (started) { try { fn(); } catch (e) { console.error(e); } } },
    params() { return { ...params }; },
    setParams(p) { Object.entries(p).forEach(([k, v]) => { if (v === null || v === undefined) delete params[k]; else params[k] = v; }); schedule(); },
    resetParams() { params = { ...DEFAULT_PARAMS }; schedule(); },
    setLink(name) { history.replaceState(null, '', '#' + name); },
    refresh() {},
    async start() {
      started = true;
      renderAll();
      await Promise.all(Object.entries(SOURCES).map(async ([id, kind]) => {
        const url = kind === 'table' ? `api/table/${id}.json` : kind.slice('static:'.length);
        try {
          const res = await fetch(url, { credentials: 'same-origin' });
          if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
          const body = await res.json();
          const data = kind === 'table' ? body.rows : body;
          if (kind === 'table') data.columns = body.columns;
          sources[id] = { status: 'ok', data };
        } catch (e) {
          console.error(`Fuente ${id}:`, e);
          sources[id] = { status: 'error', data: [], message: String(e) };
        }
      }));
      memo.clear();
      renderAll();
    },
  };
  window.dash = dash;

  // Volver a dibujar cuando cambia el ancho o cuando se muestra una sección oculta (pestañas)
  let lastW = 0, t = 0;
  new ResizeObserver(() => {
    const w = root() ? root().clientWidth : 0;
    if (Math.abs(w - lastW) < 2) return; lastW = w;
    clearTimeout(t); t = setTimeout(schedule, 120);
  }).observe(document.documentElement);
  document.addEventListener('DOMContentLoaded', () => {
    new MutationObserver((ms) => {
      if (ms.some((m) => m.target.matches && m.target.matches('section') && !m.target.hasAttribute('hidden'))) schedule();
    }).observe(root(), { subtree: true, attributes: true, attributeFilter: ['hidden'] });
  });
})();
