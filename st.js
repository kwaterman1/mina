// ---------- Historia en scroll: cifras, escenas y observador ----------
(() => {
  const ES = d3.formatLocale({ decimal: ',', thousands: '.', grouping: [3], currency: ['B/. ', ''] });
  const f1 = ES.format(',.1f'), f0 = ES.format(',.0f'), f2 = ES.format(',.2f');
  const sgn = (v, f = f1) => (v > 0 ? '+' : v < 0 ? '−' : '') + f(Math.abs(v));
  const FMT = { pct: (v) => f1(v) + '%', pp: (v) => sgn(v), pp2: (v) => sgn(v, f2), n: f0 };
  const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

  // Cifras en el texto: cada una marcada con su fuente, fila y campo
  function fig(el) {
    const { source, field, where } = el.dataset; const d = dash.data(source);
    el.classList.toggle('dash-skeleton', d.status === 'loading');
    const rows = d.status === 'ok' && Array.isArray(d.data) ? d.data : [];
    const row = rows.find((r) => (where || '').split('&').every((p) => { const i = p.indexOf('='); return i > 0 && String(r[dec(p.slice(0, i)).trim()] ?? '') === dec(p.slice(i + 1)); }));
    const v = row ? row[field] : null;
    const s = v === null || v === undefined || v === '' ? '—' : (FMT[el.dataset.fmt] || String)(+v);
    if (el.textContent !== s) el.textContent = s;
  }
  dash.draw('fig', fig);

  // Ayudantes de dibujo
  const tip = (box) => {
    let t = box.querySelector(':scope > .st-tip');
    if (!t) { t = document.createElement('div'); t.className = 'st-tip'; t.hidden = true; box.appendChild(t); }
    return {
      show(lines, x, y) {
        t.replaceChildren(...lines.map(([s, c]) => { const d = document.createElement('div'); d.textContent = s; if (c) d.className = c; return d; }));
        t.hidden = false; const bw = box.clientWidth;
        t.style.left = Math.max(0, Math.min(bw - t.offsetWidth, x + 12)) + 'px'; t.style.top = Math.max(0, y - t.offsetHeight - 10) + 'px';
      },
      hide() { t.hidden = true; },
    };
  };
  const clear = (el) => [...el.children].forEach((c) => { if (!c.classList.contains('st-tip')) c.remove(); });
  const msg = (el, s) => { clear(el); const p = document.createElement('p'); p.className = 'st-kicker'; p.textContent = s; el.prepend(p); };
  const wait = (el, ids) => { for (const id of ids) { const s = dash.data(id).status; if (s === 'error') { msg(el, 'No se pudieron cargar estos datos.'); return true; } if (s !== 'ok') { msg(el, 'Cargando…'); return true; } } return false; };
  const size = (el) => [Math.max(300, el.clientWidth), Math.max(280, el.clientHeight || 380)];
  const svgIn = (el, W, H, label) => d3.select(el).insert('svg', ':first-child').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', label);
  const short = (n) => (n === 'Omar Torrijos Herrera' ? 'O. Torrijos H.' : n === 'Área de estudio' ? 'Los tres' : n);

  // Mapa coroplético
  const MINA = [-80.633, 8.833];
  function mapa(el, field, titulo, src = 'unidades') {
    if (wait(el, ['mapa', 'unidades', src])) return;
    const names = new Map(dash.data('unidades').data.map((r) => [r.unidad, r]));
    const geo = dash.data('mapa').data, uni = dash.data(src).data.filter((r) => r.unidad).map((r) => ({ ...r, nombre: r.nombre || (names.get(r.unidad) || {}).nombre || r.unidad, poblacion_2023: r.poblacion_2023 || (names.get(r.unidad) || {}).poblacion_2023 || 0 }));
    if (!geo || !geo.features) return msg(el, 'No se pudo leer la geometría del mapa.');
    clear(el); const [W, H] = size(el); const by = new Map(uni.map((r) => [r.unidad, r]));
    const study = { type: 'FeatureCollection', features: geo.features.filter((f) => f.properties.unidad) };
    const proj = d3.geoMercator().fitExtent([[10, 10], [W - 10, H - 60]], study); const path = d3.geoPath(proj);
    const svg = svgIn(el, W, H, `Mapa: ${titulo}`);
    const div = field.startsWith('d_');
    const vals = uni.map((r) => r[field]).filter((v) => v !== null && v !== undefined);
    const mx0 = Math.max(5, d3.max(vals, (v) => Math.abs(v)) || 5);
    const sc = div ? d3.scaleSequential((t) => d3.interpolateRdBu(1 - t)).domain([-mx0, mx0]) : d3.scaleSequential(d3.interpolateOrRd).domain([0, 100]);
    const fv = (v) => (v === null || v === undefined ? 'sin dato' : div ? sgn(v) + ' pp' : f1(v) + '%');
    svg.append('g').selectAll('path').data(geo.features.filter((f) => !f.properties.unidad)).join('path').attr('d', path)
      .style('fill', 'var(--color-panel)').style('stroke', 'var(--color-border-line)').style('stroke-width', 0.6);
    const tp = tip(el);
    svg.append('g').selectAll('path').data(study.features).join('path').attr('d', path)
      .style('fill', (f) => { const r = by.get(f.properties.unidad); const v = r ? r[field] : null; return v === null || v === undefined ? 'var(--color-panel)' : sc(v); })
      .style('stroke', 'var(--color-bg)').style('stroke-width', 1.2)
      .on('pointermove', (ev, f) => { const r = by.get(f.properties.unidad); if (!r) return; const [x, y] = d3.pointer(ev, el); tp.show([[r.nombre], [r.distrito, 's'], [`${titulo}: ${fv(r[field])}`]], x, y); })
      .on('pointerleave', () => tp.hide());
    const cen = new Map(study.features.map((f) => [f.properties.unidad, path.centroid(f)]));
    svg.append('g').style('pointer-events', 'none').selectAll('text').data(uni.filter((r) => cen.get(r.unidad))).join('text')
      .attr('x', (r) => cen.get(r.unidad)[0]).attr('y', (r) => cen.get(r.unidad)[1]).attr('text-anchor', 'middle').attr('font-size', W < 500 ? 9 : 11)
      .style('fill', 'var(--color-fg)').style('paint-order', 'stroke').style('stroke', 'var(--color-bg)').style('stroke-width', 3)
      .text((r) => r.nombre.split(' + ')[0] + (r.nombre.includes(' + ') ? ' +' : ''));
    const [mx, my] = proj(MINA);
    svg.append('path').attr('d', d3.symbol(d3.symbolStar, 240)()).attr('transform', `translate(${mx},${my})`).style('fill', 'var(--cds-chart-status-critical)').style('stroke', 'var(--color-bg)').style('stroke-width', 1.5).style('pointer-events', 'none');
    const mineLab = svg.append('text').attr('x', mx + 12).attr('y', my + 4).attr('font-size', 12).style('font-weight', 600).style('fill', 'var(--color-fg)').style('paint-order', 'stroke').style('stroke', 'var(--color-bg)').style('stroke-width', 3).style('pointer-events', 'none').text('Mina (aprox.)');
    // Quita los nombres que chocan con la etiqueta de la mina o con otro nombre (los de más población quedan primero)
    const boxes = [];
    const hit = (b) => boxes.some((o) => b.x < o.x + o.width + 2 && b.x + b.width + 2 > o.x && b.y < o.y + o.height && b.y + b.height > o.y);
    try { const mb = mineLab.node().getBBox(); if (mb.width) boxes.push(mb); } catch (e) { /* sin medidas */ }
    svg.selectAll('g text').filter(function () { return this.parentNode !== svg.node(); }).nodes()
      .map((n) => ({ n, pop: (d3.select(n).datum() || {}).poblacion_2023 || 0 })).sort((a, b) => b.pop - a.pop)
      .forEach(({ n }) => { let b; try { b = n.getBBox(); } catch (e) { return; } if (!b.width) return; if (hit(b)) n.remove(); else boxes.push(b); });
    const id = `stg-${field}-${el.dataset.draw}`; const [a, b] = sc.domain();
    const gr = svg.append('defs').append('linearGradient').attr('id', id);
    d3.range(0, 1.01, 0.1).forEach((s) => gr.append('stop').attr('offset', s).attr('stop-color', sc(a + s * (b - a))));
    const lg = svg.append('g').attr('transform', `translate(12,${H - 44})`);
    lg.append('text').attr('font-size', 11).style('fill', 'var(--cds-text-secondary)').text(titulo + (div ? ' (azul = bajó)' : ''));
    lg.append('rect').attr('y', 6).attr('width', 180).attr('height', 9).attr('fill', `url(#${id})`);
    lg.append('text').attr('y', 30).attr('font-size', 11).style('fill', 'var(--cds-text-secondary)').text(div ? sgn(a) + ' pp' : f0(a) + '%');
    lg.append('text').attr('x', 180).attr('y', 30).attr('text-anchor', 'end').attr('font-size', 11).style('fill', 'var(--cds-text-secondary)').text(div ? sgn(b) + ' pp' : f0(b) + '%');
  }

  // Líneas con franja de operación (2019–2023)
  function lineas(el, { series, xMin, xMax, yFmt, tipFmt, label }) {
    clear(el); const [W, H] = size(el);
    const all = series.flatMap((s) => s.points.map((p) => p.y)).filter((v) => v !== null && v !== undefined);
    if (!all.length) return msg(el, 'Sin datos para esta vista.');
    const y = d3.scaleLinear().domain([0, d3.max(all) * 1.1]).nice();
    const svg = svgIn(el, W, H, label);
    const probe = svg.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(5).tickFormat(yFmt));
    let lw = 0; probe.selectAll('text').each(function () { lw = Math.max(lw, this.getComputedTextLength()); }); probe.remove();
    let ew = 0; const p2 = svg.append('g'); series.forEach((s) => { const t = p2.append('text').attr('font-size', 12).text(s.name); ew = Math.max(ew, t.node().getComputedTextLength()); }); p2.remove();
    const narrow = W < 480;
    const m = { t: 24, r: narrow ? 12 : ew + 16, b: narrow ? 30 + 18 * Math.ceil(series.length / 2) : 28, l: lw + 12 };
    const x = d3.scaleLinear().domain([xMin, xMax]).range([m.l, W - m.r]); y.range([H - m.b, m.t]);
    const x0 = Math.max(2018.5, xMin - 0.5), x1 = Math.min(2023.92, xMax + 0.5);
    if (x1 > x0) {
      svg.append('rect').attr('x', x(x0)).attr('width', x(x1) - x(x0)).attr('y', m.t).attr('height', H - m.b - m.t).style('fill', 'var(--cds-chart-muted)').style('opacity', 0.15);
      svg.append('text').attr('x', (x(x0) + x(x1)) / 2).attr('y', m.t - 8).attr('text-anchor', 'middle').attr('font-size', 11).style('fill', 'var(--cds-text-secondary)').text('Operación');
    }
    svg.append('g').attr('class', 'gridl').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.l - m.r)).tickFormat(''));
    svg.append('g').attr('class', 'axis').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(yFmt)).call((g) => g.select('.domain').remove());
    const step = xMax - xMin > 8 ? (narrow ? 4 : 2) : 1;
    const xt = d3.range(Math.ceil(xMin), xMax + 1).filter((v) => (xMax - v) % step === 0);
    svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickValues(xt).tickFormat(d3.format('d')));
    const line = d3.line().defined((p) => p.y !== null && p.y !== undefined).x((p) => x(p.x)).y((p) => y(p.y));
    const labs = [];
    series.forEach((s) => {
      svg.append('path').attr('d', line(s.points)).style('fill', 'none').style('stroke', s.color).style('stroke-width', s.bold ? 2.5 : 1.75).style('stroke-dasharray', s.dash || null);
      svg.append('g').selectAll('circle').data(s.points.filter((p) => p.y !== null && p.y !== undefined)).join('circle').attr('cx', (p) => x(p.x)).attr('cy', (p) => y(p.y)).attr('r', s.points.length < 5 ? 4 : 2.5).style('fill', s.color);
      const last = [...s.points].reverse().find((p) => p.y !== null && p.y !== undefined); if (last) labs.push({ s, y: y(last.y) });
    });
    if (!narrow) {
      labs.sort((a, b) => a.y - b.y); for (let i = 1; i < labs.length; i++) if (labs[i].y - labs[i - 1].y < 14) labs[i].y = labs[i - 1].y + 14;
      labs.forEach((l) => svg.append('text').attr('x', W - m.r + 6).attr('y', l.y + 4).attr('font-size', 12).style('fill', l.s.color).text(l.s.name));
    } else {
      const lg = svg.append('g').attr('transform', `translate(${m.l},${H - m.b + 34})`);
      series.forEach((s, i) => { const gx = (i % 2) * ((W - m.l) / 2), gy = Math.floor(i / 2) * 18; lg.append('rect').attr('x', gx).attr('y', gy - 8).attr('width', 10).attr('height', 10).style('fill', s.color); lg.append('text').attr('x', gx + 14).attr('y', gy + 1).attr('font-size', 11).style('fill', 'var(--cds-text-secondary)').text(s.name); });
    }
    const tp = tip(el); const xs = [...new Set(series.flatMap((s) => s.points.filter((p) => p.y !== null && p.y !== undefined).map((p) => p.x)))].sort((a, b) => a - b);
    const hl = svg.append('line').attr('y1', m.t).attr('y2', H - m.b).style('stroke', 'var(--cds-chart-axis)').style('display', 'none');
    svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).style('fill', 'transparent')
      .on('pointermove', (ev) => {
        const [px, py] = d3.pointer(ev); const xv = x.invert(px); const xn = xs.reduce((a, b) => (Math.abs(b - xv) < Math.abs(a - xv) ? b : a), xs[0]);
        hl.style('display', null).attr('x1', x(xn)).attr('x2', x(xn));
        const sr = svg.node().getBoundingClientRect(), er = el.getBoundingClientRect();
        tp.show([[String(xn)]].concat(series.map((s) => { const p = s.points.find((q) => q.x === xn); return [`${s.name}: ${p && p.y !== null && p.y !== undefined ? tipFmt(p.y) : 'sin dato'}`, 's']; })), (x(xn) * sr.width) / W + (sr.left - er.left), (py * sr.height) / H);
      })
      .on('pointerleave', () => { hl.style('display', 'none'); tp.hide(); });
  }

  function ipm(el) {
    if (wait(el, ['indicadores'])) return;
    clear(el); const [W, H] = size(el); const d = dash.data('indicadores').data;
    const names = ['La Pintada', 'Donoso', 'Omar Torrijos Herrera', 'Área de estudio'];
    const v = (n, y) => { const r = d.find((x) => x.territorio === n && x.indicador === 'ipm' && x.anio === y); return r ? r.valor : null; };
    const rows = names.map((n) => ({ n, a: v(n, 2010), b: v(n, 2023) }));
    const svg = svgIn(el, W, H, 'Pobreza multidimensional 2010 y 2023 por distrito'); const m = { t: 22, r: 10, b: 50, l: 10 };
    const x0 = d3.scaleBand().domain(names).range([m.l, W - m.r]).padding(0.25); const x1 = d3.scaleBand().domain(['a', 'b']).range([0, x0.bandwidth()]).padding(0.08);
    const y = d3.scaleLinear().domain([0, 100]).range([H - m.b, m.t]);
    svg.append('g').attr('class', 'gridl').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(-(W - m.l - m.r)).tickFormat(''));
    const tp = tip(el);
    const g = svg.append('g').selectAll('g').data(rows).join('g').attr('transform', (r) => `translate(${x0(r.n)},0)`);
    ['a', 'b'].forEach((k) => {
      g.append('rect').attr('x', x1(k)).attr('width', x1.bandwidth()).attr('y', (r) => y(r[k] ?? 0)).attr('height', (r) => y(0) - y(r[k] ?? 0)).attr('rx', 3).style('fill', k === 'a' ? 'var(--cds-chart-muted)' : dash.colors[0]);
      g.append('text').attr('x', x1(k) + x1.bandwidth() / 2).attr('y', (r) => y(r[k] ?? 0) - 5).attr('text-anchor', 'middle').attr('font-size', W < 500 ? 9 : 11).style('fill', 'var(--color-fg)').text((r) => (r[k] == null ? '' : f1(r[k])));
    });
    g.append('text').attr('x', x0.bandwidth() / 2).attr('y', H - m.b + 18).attr('text-anchor', 'middle').attr('font-size', 11).style('fill', 'var(--cds-text-secondary)').text((r) => short(r.n));
    g.append('rect').attr('width', x0.bandwidth()).attr('y', m.t).attr('height', H - m.t - m.b).style('fill', 'transparent')
      .on('pointermove', (ev, r) => { const [px, py] = d3.pointer(ev, el); tp.show([[r.n], [`IPM 2010: ${f1(r.a)}%`], [`IPM 2023: ${f1(r.b)}%`]], px, py); })
      .on('pointerleave', () => tp.hide());
    const lg = svg.append('g').attr('transform', `translate(${m.l},${H - 10})`);
    [['2010', 'var(--cds-chart-muted)'], ['2023', dash.colors[0]]].forEach(([t, c], i) => { lg.append('rect').attr('x', i * 70).attr('y', -9).attr('width', 10).attr('height', 10).style('fill', c); lg.append('text').attr('x', i * 70 + 14).attr('font-size', 11).style('fill', 'var(--cds-text-secondary)').text(t); });
  }

  // Barras horizontales simples
  function hbars(el, rows, { label, fmt }) {
    clear(el); const [W, H0] = size(el); const H = Math.min(H0, 60 + rows.length * 46);
    const svg = svgIn(el, W, H, label);
    const p = svg.append('g'); let lw = 0; rows.forEach((r) => { const t = p.append('text').attr('font-size', 12).text(r.name); lw = Math.max(lw, t.node().getComputedTextLength()); }); p.remove();
    const m = { t: 10, r: 56, b: 28, l: Math.min(lw + 12, W * 0.45) };
    const y = d3.scaleBand().domain(rows.map((r) => r.name)).range([m.t, H - m.b]).padding(0.3);
    const x = d3.scaleLinear().domain([0, d3.max(rows, (r) => r.value) || 1]).nice().range([m.l, W - m.r]);
    svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(4).tickFormat(fmt));
    const tp = tip(el);
    const g = svg.append('g').selectAll('g').data(rows).join('g').attr('transform', (r) => `translate(0,${y(r.name)})`);
    g.append('rect').attr('x', m.l).attr('width', (r) => Math.max(0, x(r.value) - m.l)).attr('height', y.bandwidth()).attr('rx', 3).style('fill', (r) => r.color);
    g.append('text').attr('x', m.l - 6).attr('y', y.bandwidth() / 2 + 4).attr('text-anchor', 'end').attr('font-size', 12).style('fill', 'var(--color-fg)').text((r) => r.name);
    g.append('text').attr('x', (r) => x(r.value) + 6).attr('y', y.bandwidth() / 2 + 4).attr('font-size', 11).style('fill', 'var(--cds-text-secondary)').text((r) => fmt(r.value));
    g.append('rect').attr('width', W).attr('height', y.bandwidth()).style('fill', 'transparent')
      .on('pointermove', (ev, r) => { const [px, py] = d3.pointer(ev, el); tp.show(r.tip, px, py); }).on('pointerleave', () => tp.hide());
  }
  function saludView(el) {
    if (wait(el, ['acceso_salud'])) return;
    const d = dash.data('acceso_salud').data; const order = ['La Pintada', 'Donoso', 'Omar Torrijos Herrera', 'Coclé', 'Colón', 'Panamá (total)'];
    const col = { 'La Pintada': dash.colors[0], Donoso: dash.colors[1], 'Omar Torrijos Herrera': dash.colors[2] };
    const nm = (r) => (r.nivel === 'Provincia' ? `${r.territorio} (provincia)` : r.territorio === 'Panamá (total)' ? 'Todo el país' : short(r.territorio));
    const rows = order.map((n) => d.find((r) => r.territorio === n)).filter((r) => r && r.pct_fuera !== null).map((r) => ({ name: nm(r), value: r.pct_fuera, color: col[r.territorio] || 'var(--cds-chart-muted)',
      tip: [[r.territorio], [`${f0(r.otro_lugar)} de ${f0(r.defunciones)} defunciones fuera de una instalación de salud`], [`Sin certificación médica: ${f0(r.sin_certificacion)}`, 's']] }));
    hbars(el, rows, { label: 'Porcentaje de las defunciones de 2025 ocurridas fuera de una instalación de salud', fmt: (v) => f0(v) + '%' });
  }
  function escuelasView(el) {
    if (wait(el, ['escuelas_oferta'])) return;
    clear(el); const [W, H] = size(el); const rows = dash.data('escuelas_oferta').data.filter((r) => r.distrito !== 'Área de estudio');
    const lv = [['primaria', 'Primaria'], ['premedia', 'Premedia'], ['media', 'Media']], cols = [dash.colors[0], dash.colors[1], dash.colors[2]];
    const svg = svgIn(el, W, H, 'Estudiantes por nivel en cada distrito, 2026'); const m = { t: 22, r: 10, b: 52, l: 10 };
    const x0 = d3.scaleBand().domain(rows.map((r) => r.distrito)).range([m.l, W - m.r]).padding(0.22);
    const x1 = d3.scaleBand().domain(lv.map((l) => l[0])).range([0, x0.bandwidth()]).padding(0.08);
    const y = d3.scaleLinear().domain([0, (d3.max(rows, (r) => r.primaria) || 1) * 1.1]).range([H - m.b, m.t]);
    svg.append('g').attr('class', 'gridl').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(-(W - m.l - m.r)).tickFormat(''));
    const tp = tip(el);
    const g = svg.append('g').selectAll('g').data(rows).join('g').attr('transform', (r) => `translate(${x0(r.distrito)},0)`);
    lv.forEach(([k], i) => {
      g.append('rect').attr('x', x1(k)).attr('width', x1.bandwidth()).attr('y', (r) => y(r[k])).attr('height', (r) => y(0) - y(r[k])).attr('rx', 3).style('fill', cols[i]);
      g.append('text').attr('x', x1(k) + x1.bandwidth() / 2).attr('y', (r) => y(r[k]) - 5).attr('text-anchor', 'middle').attr('font-size', W < 500 ? 9 : 11).style('fill', 'var(--color-fg)').text((r) => f0(r[k]));
    });
    g.append('text').attr('x', x0.bandwidth() / 2).attr('y', H - m.b + 18).attr('text-anchor', 'middle').attr('font-size', 11).style('fill', 'var(--cds-text-secondary)').text((r) => short(r.distrito));
    g.append('rect').attr('width', x0.bandwidth()).attr('y', m.t).attr('height', H - m.t - m.b).style('fill', 'transparent')
      .on('pointermove', (ev, r) => { const [px, py] = d3.pointer(ev, el); tp.show([[r.distrito], [`${r.escuelas} escuelas: ${r.con_premedia} con premedia, ${r.con_media} con media`], [`Primaria ${f0(r.primaria)} · Premedia ${f0(r.premedia)} · Media ${f0(r.media)}`, 's']], px, py); })
      .on('pointerleave', () => tp.hide());
    const lg = svg.append('g').attr('transform', `translate(${m.l},${H - 10})`);
    lv.forEach(([, t], i) => { lg.append('rect').attr('x', i * 90).attr('y', -9).attr('width', 10).attr('height', 10).style('fill', cols[i]); lg.append('text').attr('x', i * 90 + 14).attr('font-size', 11).style('fill', 'var(--cds-text-secondary)').text(t); });
  }

  function serviciosEscView(el) {
    if (wait(el, ['servicios_escuelas'])) return;
    clear(el); const [W, H0] = size(el);
    const order = ['La Pintada', 'Donoso', 'Omar Torrijos Herrera', 'Coclé', 'Colón', 'Panamá (total)'];
    const nm = (r) => (r.nivel === 'Provincia' ? `${r.territorio} (prov.)` : r.territorio === 'Panamá (total)' ? 'Todo el país' : short(r.territorio));
    const rows = order.map((n) => dash.data('servicios_escuelas').data.find((r) => r.territorio === n)).filter(Boolean);
    const ks = [['pct_internet', 'Internet'], ['pct_luz_red', 'Electricidad de red'], ['pct_agua_red', 'Agua de red o acueducto']];
    const cols = [dash.colors[0], dash.colors[1], dash.colors[2]];
    const H = Math.min(Math.max(H0, 320), 60 + rows.length * 58);
    const svg = svgIn(el, W, H, 'Porcentaje de escuelas con internet, electricidad de red y agua de red, 2025');
    const p = svg.append('g'); let lw = 0; rows.forEach((r) => { const t = p.append('text').attr('font-size', 12).text(nm(r)); lw = Math.max(lw, t.node().getComputedTextLength()); }); p.remove();
    const m = { t: 8, r: 44, b: 44, l: Math.min(lw + 14, W * 0.4) };
    const y0 = d3.scaleBand().domain(rows.map((r) => r.territorio)).range([m.t, H - m.b]).paddingInner(0.28);
    const y1 = d3.scaleBand().domain(ks.map((k) => k[0])).range([0, y0.bandwidth()]).padding(0.08);
    const x = d3.scaleLinear().domain([0, 100]).range([m.l, W - m.r]);
    svg.append('g').attr('class', 'gridl').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(4).tickSize(-(H - m.b - m.t)).tickFormat(''));
    svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(4).tickFormat((v) => v + '%'));
    const tp = tip(el);
    const g = svg.append('g').selectAll('g').data(rows).join('g').attr('transform', (r) => `translate(0,${y0(r.territorio)})`);
    g.append('rect').attr('x', m.l).attr('width', W - m.l - m.r).attr('height', y0.bandwidth()).style('fill', (r) => (r.nivel === 'Distrito' ? 'transparent' : 'var(--color-panel)'));
    ks.forEach(([k], i) => {
      g.append('rect').attr('x', m.l).attr('y', y1(k)).attr('height', y1.bandwidth()).attr('width', (r) => Math.max(0, x(r[k] || 0) - m.l)).attr('rx', 2).style('fill', cols[i]);
      g.append('text').attr('x', (r) => x(r[k] || 0) + 4).attr('y', y1(k) + y1.bandwidth() / 2 + 3.5).attr('font-size', 10).style('fill', 'var(--cds-text-secondary)').text((r) => (r[k] === null ? '' : f0(r[k]) + '%'));
    });
    g.append('text').attr('x', m.l - 6).attr('y', y0.bandwidth() / 2 + 4).attr('text-anchor', 'end').attr('font-size', 12).style('fill', 'var(--color-fg)').style('font-weight', (r) => (r.nivel === 'Distrito' ? 600 : 400)).text(nm);
    g.append('rect').attr('width', W).attr('height', y0.bandwidth()).style('fill', 'transparent')
      .on('pointermove', (ev, r) => { const [px, py] = d3.pointer(ev, el); tp.show([[r.territorio === 'Panamá (total)' ? 'Todo el país' : r.territorio], [`${f0(r.con_dato)} escuelas con dato`, 's'], [`Internet ${f1(r.pct_internet)}% · Electricidad de red ${f1(r.pct_luz_red)}% · Agua de red ${f1(r.pct_agua_red)}%`], [`Solo energía solar ${f1(r.pct_solo_solar)}% · Sin red ni pozo ${f1(r.pct_sin_red_pozo)}%`, 's']], px, py); })
      .on('pointerleave', () => tp.hide());
    const lg = svg.append('g').attr('transform', `translate(${m.l},${H - 10})`); let lx = 0;
    ks.forEach(([, t], i) => { lg.append('rect').attr('x', lx).attr('y', -9).attr('width', 10).attr('height', 10).style('fill', cols[i]); const tx = lg.append('text').attr('x', lx + 14).attr('font-size', 11).style('fill', 'var(--cds-text-secondary)').text(t); lx += 14 + tx.node().getComputedTextLength() + 16; });
  }

  const labSeries = (k, names, cols, xMin) => { const rows = dash.data('lab_anual').data; return names.map((n, i) => ({ name: n, color: cols[i], dash: n === 'Panamá (total)' ? '4 3' : null, points: d3.range(xMin, 2027).map((yy) => { const r = rows.find((q) => q.territorio === n && q.anio === yy); return { x: yy, y: r ? r[k] : null }; }) })); };
  const VIEWS = [
    (el) => mapa(el, 'pgen_2015', 'Pobreza general 2015'),
    (el) => mapa(el, 'pgen_2023', 'Pobreza general 2023'),
    (el) => mapa(el, 'd_pgen', 'Cambio 2015→2023'),
    (el) => {
      if (wait(el, ['indicadores'])) return; const d = dash.data('indicadores').data;
      const names = ['La Pintada', 'Donoso', 'Omar Torrijos Herrera', 'Área de estudio'], cols = [dash.colors[0], dash.colors[1], dash.colors[2], 'var(--color-fg)'];
      lineas(el, { label: 'Pobreza general por distrito en 2011, 2015 y 2023', xMin: 2010, xMax: 2024, yFmt: (v) => f0(v) + '%', tipFmt: (v) => f1(v) + '%',
        series: names.map((n, i) => ({ name: short(n), color: cols[i], bold: i === 3, dash: i === 3 ? '5 3' : null, points: d.filter((r) => r.indicador === 'pgen' && r.territorio === n).map((r) => ({ x: r.anio, y: r.valor })).sort((a, b) => a.x - b.x) })) });
    },
    ipm,
    (el) => { if (wait(el, ['lab_anual'])) return; lineas(el, { label: 'Ocupados en minas y canteras, Coclé y Colón, 2017–2026', xMin: 2017, xMax: 2026, yFmt: f0, tipFmt: (v) => f0(v) + ' ocupados', series: labSeries('ocup_mineria', ['Coclé', 'Colón'], [dash.colors[0], dash.colors[1]], 2017) }); },
    (el) => { if (wait(el, ['lab_anual'])) return; lineas(el, { label: 'Tasa de desempleo, Coclé y Colón frente al país, 2013–2026', xMin: 2013, xMax: 2026, yFmt: (v) => f0(v) + '%', tipFmt: (v) => f1(v) + '%', series: labSeries('tasa_desempleo', ['Coclé + Colón', 'Panamá (total)'], [dash.colors[0], 'var(--cds-chart-muted)'], 2013) }); },
    saludView,
    (el) => mapa(el, 'pct_menos100', 'Población en lugares de menos de 100 habitantes', 'dispersion'),
    escuelasView,
    serviciosEscView,
  ];
  window.ST = window.ST || { step: 0 };
  const render = (el, k) => (VIEWS[k] || VIEWS[0])(el);
  dash.draw('escena', (el) => render(el, window.ST.step));
  dash.draw('vista', (el) => render(el, +el.dataset.vista));

  // Qué capítulo está en el centro de la pantalla
  const steps = [...document.querySelectorAll('#dash-root .st-step')];
  steps.forEach((s, i) => s.classList.toggle('on', i === 0));
  const io = new IntersectionObserver((es) => {
    for (const e of es) {
      if (!e.isIntersecting) continue; const k = +e.target.dataset.step; if (k === window.ST.step) continue;
      window.ST.step = k; steps.forEach((s) => s.classList.toggle('on', s === e.target)); dash.draw('escena');
    }
  }, { root: document, rootMargin: '-45% 0px -50% 0px' });
  steps.forEach((s) => io.observe(s));
})();
