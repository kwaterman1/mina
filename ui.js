// ---------- Ayudantes compartidos ----------
window.MZ = (() => {
  const fmt1 = d3.format(',.1f'), fmt0 = d3.format(',.0f');
  const es = d3.formatLocale({ decimal: ',', thousands: '.', grouping: [3], currency: ['B/. ', ''] });
  const f1 = es.format(',.1f'), f0 = es.format(',.0f'), f2 = es.format(',.2f');
  const P = () => dash.params();
  const anio = () => +(P().anio || 2023);
  const distrito = () => P().distrito || '';
  const slugD = (d) => ({ 'La Pintada': 'la_pintada', Donoso: 'donoso', 'Omar Torrijos Herrera': 'oth' }[d] || 'area');
  const nameD = (d) => d || 'Área de estudio';
  const provSlug = (d) => (d === 'La Pintada' ? 'cocle' : d ? 'colon' : 'cocle_colon');
  const provName = (d) => (d === 'La Pintada' ? 'Coclé' : d ? 'Colón' : 'Coclé + Colón');
  const pobYear = (y, ind) => (ind === 'ipm' ? (y >= 2023 ? 2023 : y >= 2010 ? 2010 : null) : y >= 2023 ? 2023 : y >= 2015 ? 2015 : y >= 2011 ? 2011 : null);
  const prevYear = (y, ind) => (ind === 'ipm' ? (y === 2023 ? 2010 : null) : y === 2023 ? 2015 : y === 2015 ? 2011 : null);
  const etapa = (y) => (y <= 2018 ? 'pre' : y <= 2023 ? 'op' : 'post');
  const etapaTxt = { pre: 'antes de la operación comercial', op: 'mina en operación comercial', post: 'mina paralizada' };
  const ok = (id) => dash.data(id).status === 'ok';
  const reduced = () => !window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
  const distColor = (d) => ({ 'La Pintada': dash.colors[0], Donoso: dash.colors[1], 'Omar Torrijos Herrera': dash.colors[2], 'Área de estudio': 'var(--color-fg)' }[d]);
  // span con marca de fuente
  const mark = (parent, text, src, field, where, cls) => {
    const s = document.createElement('span');
    s.textContent = text; s.dataset.source = src; s.dataset.field = field; if (where) s.dataset.where = where; if (cls) s.className = cls;
    parent.appendChild(s); return s;
  };
  // tooltip dentro del contenedor
  const tip = (box) => {
    let t = box.querySelector(':scope > .tip');
    if (!t) { t = document.createElement('div'); t.className = 'tip'; t.hidden = true; box.appendChild(t); }
    return {
      show(lines, x, y) {
        t.replaceChildren(...lines.map(([txt, cls]) => { const d = document.createElement('div'); d.textContent = txt; if (cls) d.className = cls; return d; }));
        t.hidden = false;
        const bw = box.clientWidth, tw = t.offsetWidth, th = t.offsetHeight;
        t.style.left = Math.max(0, Math.min(bw - tw, x + 12)) + 'px';
        t.style.top = Math.max(0, y - th - 10) + 'px';
      },
      hide() { t.hidden = true; },
    };
  };
  const placeholder = (el, msg) => { el.replaceChildren(); const p = document.createElement('p'); p.className = 'muted'; p.textContent = msg; el.appendChild(p); };
  const stateMsg = (ids) => {
    for (const id of ids) { const s = dash.data(id).status; if (s === 'error') return 'No se pudieron cargar los datos de esta sección.'; if (s !== 'ok') return null; }
    return '';
  };

  // Gráfico de líneas genérico con franjas de etapas
  const lineChart = (el, { series, xMin, xMax, yFmt, ySuffix = '', selYear, zeroBase = false, tipFmt }) => {
    el.replaceChildren();
    const W = Math.max(280, el.clientWidth), H = Math.max(240, el.clientHeight || 300);
    const all = series.flatMap((s) => s.points.map((p) => p.y)).filter((v) => v !== null);
    if (!all.length) return placeholder(el, 'Sin datos para esta selección.');
    const y = d3.scaleLinear().domain([zeroBase ? 0 : d3.min(all) * 0.9, d3.max(all) * 1.08]).nice();
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', el.getAttribute('aria-label') || '');
    const probe = svg.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(5).tickFormat(yFmt));
    let lw = 0; probe.selectAll('text').each(function () { lw = Math.max(lw, this.getComputedTextLength()); }); probe.remove();
    let ew = 0; const probe2 = svg.append('g'); series.forEach((s) => { const t = probe2.append('text').attr('font-size', 12).text(s.name); ew = Math.max(ew, t.node().getComputedTextLength()); }); probe2.remove();
    const narrow = W < 460;
    const m = { t: 10, r: narrow ? 12 : ew + 16, b: narrow ? 26 + 18 * Math.ceil(series.length / 2) : 26, l: lw + 12 };
    const x = d3.scaleLinear().domain([xMin, xMax]).range([m.l, W - m.r]);
    y.range([H - m.b, m.t]);
    const bands = [['pre', xMin - 0.5, 2018.5], ['op', 2018.5, 2023.92], ['post', 2023.92, xMax + 0.5]];
    svg.append('g').selectAll('rect').data(bands.filter((b) => b[2] > xMin - 0.5 && b[1] < xMax + 0.5)).join('rect')
      .attr('x', (b) => x(Math.max(b[1], xMin - 0.5))).attr('width', (b) => Math.max(0, x(Math.min(b[2], xMax + 0.5)) - x(Math.max(b[1], xMin - 0.5))))
      .attr('y', m.t).attr('height', H - m.b - m.t).style('fill', (b) => (b[0] === 'op' ? 'var(--cds-chart-muted)' : 'none')).style('opacity', 0.15);
    svg.append('g').attr('class', 'gridl').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.l - m.r)).tickFormat(''));
    svg.append('g').attr('class', 'axis').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(yFmt)).call((g) => g.select('.domain').remove());
    const xt = d3.range(Math.ceil(xMin), xMax + 1).filter((v, i, a) => a.length < 8 || v % (narrow ? 4 : 2) === xMax % (narrow ? 4 : 2));
    svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickValues(xt).tickFormat(d3.format('d')));
    if (selYear >= xMin && selYear <= xMax) svg.append('line').attr('x1', x(selYear)).attr('x2', x(selYear)).attr('y1', m.t).attr('y2', H - m.b).style('stroke', 'var(--cds-chart-reference)').style('stroke-dasharray', '3 3');
    const line = d3.line().defined((p) => p.y !== null).x((p) => x(p.x)).y((p) => y(p.y));
    series.forEach((s) => {
      const g = svg.append('g').style('opacity', s.dim ? 0.3 : 1);
      g.append('path').attr('d', line(s.points)).style('fill', 'none').style('stroke', s.color).style('stroke-width', s.bold ? 2.5 : 1.75).style('stroke-dasharray', s.dash || null);
      g.selectAll('circle').data(s.points.filter((p) => p.y !== null)).join('circle').attr('cx', (p) => x(p.x)).attr('cy', (p) => y(p.y)).attr('r', s.points.length < 5 ? 4 : 2.5).style('fill', s.color);
      const last = [...s.points].reverse().find((p) => p.y !== null);
      if (last && !narrow) s._lab = { y: y(last.y), x: x(last.x) };
    });
    if (!narrow) {
      const labs = series.filter((s) => s._lab).map((s) => ({ s, y: s._lab.y }));
      labs.sort((a, b) => a.y - b.y); for (let i = 1; i < labs.length; i++) if (labs[i].y - labs[i - 1].y < 14) labs[i].y = labs[i - 1].y + 14;
      labs.forEach((l) => svg.append('text').attr('x', W - m.r + 6).attr('y', l.y + 4).attr('font-size', 12).style('fill', l.s.color).style('opacity', l.s.dim ? 0.4 : 1).text(l.s.name));
    } else {
      const lg = svg.append('g').attr('transform', `translate(${m.l},${H - m.b + 30})`);
      series.forEach((s, i) => { const gx = (i % 2) * ((W - m.l) / 2), gy = Math.floor(i / 2) * 18; lg.append('rect').attr('x', gx).attr('y', gy - 8).attr('width', 10).attr('height', 10).style('fill', s.color); lg.append('text').attr('x', gx + 14).attr('y', gy + 1).attr('font-size', 11).style('fill', 'var(--cds-text-secondary)').text(s.name); });
    }
    const tp = tip(el);
    const xs = [...new Set(series.flatMap((s) => s.points.filter((p) => p.y !== null).map((p) => p.x)))].sort((a, b) => a - b);
    const hl = svg.append('line').attr('y1', m.t).attr('y2', H - m.b).style('stroke', 'var(--cds-chart-axis)').style('display', 'none');
    svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).style('fill', 'transparent')
      .on('pointermove', (ev) => {
        const [px] = d3.pointer(ev); const xv = x.invert(px); const xn = xs.reduce((a, b) => (Math.abs(b - xv) < Math.abs(a - xv) ? b : a), xs[0]);
        hl.style('display', null).attr('x1', x(xn)).attr('x2', x(xn));
        const lines = [[String(xn)]].concat(series.map((s) => { const p = s.points.find((q) => q.x === xn); return [`${s.name}: ${p && p.y !== null ? (tipFmt || yFmt)(p.y) + ySuffix : 'sin dato'}`, 's']; }));
        const rect = el.getBoundingClientRect(), sr = svg.node().getBoundingClientRect();
        tp.show(lines, (x(xn) * sr.width) / W + (sr.left - rect.left), (d3.pointer(ev)[1] * sr.height) / H);
      })
      .on('pointerleave', () => { hl.style('display', 'none'); tp.hide(); });
  };

  return { f0, f1, f2, fmt0, fmt1, anio, distrito, slugD, nameD, provSlug, provName, pobYear, prevYear, etapa, etapaTxt, ok, mark, tip, placeholder, stateMsg, lineChart, distColor, reduced, es };
})();

// ---------- Controles ----------
(() => {
  const bind = (sel, key, conv = (v) => v) => document.querySelectorAll(sel).forEach((el) => {
    el.addEventListener('change', () => dash.setParams({ [key]: el.type === 'checkbox' ? el.checked : conv(el.value) }));
  });
  bind('#f-anio', 'anio', Number); bind('#f-distrito', 'distrito'); bind('#f-capa', 'capa'); bind('#f-pobind', 'pob_ind');
  bind('#f-labind', 'lab_ind'); bind('#f-ramaprov', 'rama_prov'); bind('#f-ramaarea', 'rama_area');
  bind('#ov-mina', 'ov_mina'); bind('#ov-esc', 'ov_esc'); bind('#ov-sal', 'ov_sal'); bind('#ov-lbl', 'ov_lbl');
  dash.onData(() => {
    const p = dash.params();
    const set = (sel, v) => document.querySelectorAll(sel).forEach((el) => { if (document.activeElement === el) return; if (el.type === 'checkbox') el.checked = !!v; else el.value = String(v ?? ''); });
    set('#f-anio', p.anio ?? 2023); set('#f-distrito', p.distrito ?? ''); set('#f-capa', p.capa ?? 'pgen'); set('#f-pobind', p.pob_ind ?? 'pgen');
    set('#f-labind', p.lab_ind ?? 'ocup_mineria'); set('#f-ramaprov', p.rama_prov ?? 'Colón'); set('#f-ramaarea', p.rama_area ?? 'Total');
    set('#ov-mina', p.ov_mina ?? true); set('#ov-esc', p.ov_esc ?? false); set('#ov-sal', p.ov_sal ?? false); set('#ov-lbl', p.ov_lbl ?? true);
    const et = MZ.etapa(MZ.anio());
    document.querySelectorAll('.timeline [data-etapa]').forEach((d) => { d.className = d.dataset.etapa === et ? 'on' : ''; });
  });
})();

// ---------- Encabezado y tarjetas ----------
(() => {
  const leadNum = (name, src, where, field, fmt) => dash.draw(name, (el) => {
    const d = dash.data(src); const r = d.status === 'ok' ? d.data.find((x) => x.clave === where) : null;
    el.textContent = r && r[field] !== null ? fmt(r[field]) : '—';
    el.classList.toggle('dash-skeleton', d.status === 'loading');
  });
  const pct = (v) => MZ.f1(v) + '%', pp = (v) => (v > 0 ? '+' : '') + MZ.f1(v);
  leadNum('lead_a', 'antes_despues', 'area_pgen_b', 'antes', pct);
  leadNum('lead_b', 'antes_despues', 'area_pgen_b', 'despues', pct);
  leadNum('lead_c', 'antes_despues', 'area_pgen_b', 'cambio', pp);
  leadNum('lead_d', 'antes_despues', 'area_pgen_a', 'cambio', pp);
  leadNum('lead_e', 'periodos_lab', 'cocle_colon_ocup_mineria', 'operacion', MZ.f0);
  leadNum('lead_f', 'periodos_lab', 'cocle_colon_ocup_mineria', 'post', MZ.f0);

  dash.draw('periodo_txt', (el) => { const y = MZ.anio(); el.textContent = `${y} · ${MZ.etapaTxt[MZ.etapa(y)]}`; });

  // Tarjetas de pobreza
  const pobTile = (ind) => {
    const val = (el) => {
      el.replaceChildren(); const d = dash.data('indicadores');
      el.classList.toggle('dash-skeleton', d.status === 'loading');
      if (d.status !== 'ok') { el.textContent = '—'; return; }
      const y = MZ.pobYear(MZ.anio(), ind); const k = `${MZ.slugD(MZ.distrito())}_${ind}_${y}`; const r = d.data.find((x) => x.clave === k);
      if (!r || r.valor === null) { el.textContent = 'Sin medición'; return; }
      MZ.mark(el, MZ.f1(r.valor) + '%', 'indicadores', 'valor', `clave=${k}`);
    };
    const dlt = (el) => {
      el.replaceChildren(); el.className = 'dlt'; const d = dash.data('indicadores'); if (d.status !== 'ok') { el.textContent = '—'; return; }
      const y = MZ.pobYear(MZ.anio(), ind), y0 = MZ.prevYear(y, ind), s = MZ.slugD(MZ.distrito());
      const r = d.data.find((x) => x.clave === `${s}_${ind}_${y}`), r0 = d.data.find((x) => x.clave === `${s}_${ind}_${y0}`);
      if (!r || !r0 || r.valor === null || r0.valor === null) { el.textContent = 'Sin medición previa para comparar'; el.classList.add('flat'); return; }
      const c = Math.round(10 * (r.valor - r0.valor)) / 10;
      el.classList.add(c <= -2 ? 'good' : c >= 2 ? 'bad' : 'flat');
      el.textContent = `${c > 0 ? '▲ +' : c < 0 ? '▼ ' : ''}${MZ.f1(c)} pp frente a ${y0}`;
    };
    const win = (el) => { const y = MZ.pobYear(MZ.anio(), ind); el.textContent = `${MZ.nameD(MZ.distrito())} · medición ${y ?? '—'}`; };
    dash.draw(`k_${ind}`, val); dash.draw(`k_${ind}_d`, dlt); dash.draw(`k_${ind}_w`, win);
  };
  ['pgen', 'pext', 'ipm'].forEach(pobTile);

  // Tarjetas laborales
  const labTile = (key, field, isRate, goodDown) => {
    const find = (d, y) => d.data.find((x) => x.clave === `${MZ.provSlug(MZ.distrito())}_${y}`);
    dash.draw(`k_${key}`, (el) => {
      el.replaceChildren(); const d = dash.data('lab_anual');
      el.classList.toggle('dash-skeleton', d.status === 'loading');
      if (d.status !== 'ok') { el.textContent = '—'; return; }
      const y = MZ.anio(); const r = find(d, y);
      if (!r || r[field] === null) { el.textContent = 'Sin dato'; return; }
      MZ.mark(el, isRate ? MZ.f1(r[field]) + '%' : MZ.f0(r[field]), 'lab_anual', field, `clave=${r.clave}`);
    });
    dash.draw(`k_${key}_d`, (el) => {
      el.className = 'dlt'; const d = dash.data('lab_anual'); if (d.status !== 'ok') { el.textContent = '—'; return; }
      const y = MZ.anio(), r = find(d, y), r0 = find(d, 2018);
      if (!r || !r0 || r[field] === null || r0[field] === null) { el.textContent = y < 2017 ? 'Antes de la serie de comparación' : 'Sin dato para comparar'; el.classList.add('flat'); return; }
      if (y === 2018) { el.textContent = 'Año base (2018)'; el.classList.add('flat'); return; }
      const c = isRate ? Math.round(10 * (r[field] - r0[field])) / 10 : Math.round(1000 * (r[field] - r0[field]) / r0[field]) / 10;
      const thr = isRate ? 1 : 10;
      const better = goodDown ? c <= -thr : c >= thr, worse = goodDown ? c >= thr : c <= -thr;
      el.classList.add(better ? 'good' : worse ? 'bad' : 'flat');
      el.textContent = `${c > 0 ? '▲ +' : c < 0 ? '▼ ' : ''}${MZ.f1(c)}${isRate ? ' pp' : '%'} frente a 2018`;
    });
    dash.draw(`k_${key}_w`, (el) => { el.textContent = `${MZ.provName(MZ.distrito())} · año ${MZ.anio()}`; });
  };
  labTile('des', 'tasa_desempleo', true, true);
  labTile('inf', 'pct_informal', true, true);
  labTile('min', 'ocup_mineria', false, false);
})();
