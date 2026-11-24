// ---------- Pobreza: tendencia, cambio por corregimiento, tabla ----------
(() => {
  dash.draw('pob_trend', (el) => {
    const msg = MZ.stateMsg(['indicadores']);
    if (msg === null) { el.classList.add('dash-skeleton'); return; }
    el.classList.remove('dash-skeleton'); if (msg) return MZ.placeholder(el, msg);
    const ind = dash.params().pob_ind || 'pgen'; const dist = MZ.distrito();
    const rows = dash.data('indicadores').data.filter((r) => r.indicador === ind);
    const names = ['La Pintada', 'Donoso', 'Omar Torrijos Herrera', 'Área de estudio'];
    const series = names.map((nm) => ({
      name: nm, color: MZ.distColor(nm), bold: nm === 'Área de estudio', dash: nm === 'Área de estudio' ? '5 3' : null,
      dim: !!dist && nm !== dist && nm !== 'Área de estudio',
      points: rows.filter((r) => r.territorio === nm).map((r) => ({ x: r.anio, y: r.valor })).sort((a, b) => a.x - b.x),
    }));
    MZ.lineChart(el, { series, xMin: 2010, xMax: 2026, yFmt: (v) => MZ.f0(v) + '%', selYear: MZ.anio(), zeroBase: true, tipFmt: (v) => MZ.f1(v) + '%' });
  });

  dash.draw('cambio_unid', (el) => {
    const msg = MZ.stateMsg(['unidades']);
    if (msg === null) { el.classList.add('dash-skeleton'); return; }
    el.classList.remove('dash-skeleton'); if (msg) return MZ.placeholder(el, msg);
    el.replaceChildren();
    const dist = MZ.distrito();
    const rows = dash.data('unidades').data.filter((u) => u.d_pgen !== null).sort((a, b) => a.d_pgen - b.d_pgen);
    const W = Math.max(280, el.clientWidth), bh = 22, H = rows.length * bh + 30;
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', el.getAttribute('aria-label'));
    const lab = (u) => u.nombre.split(' + ')[0] + (u.nombre.includes('+') ? ' +' : '');
    const probe = svg.append('g'); let lw = 0;
    rows.forEach((u) => { const t = probe.append('text').attr('font-size', 11).text(lab(u)); lw = Math.max(lw, t.node().getComputedTextLength()); }); probe.remove();
    const m = { l: Math.min(lw + 10, W * 0.42), r: 44, t: 4, b: 24 };
    const ext = d3.max(rows, (u) => Math.abs(u.d_pgen)) || 1;
    const x = d3.scaleLinear().domain([-ext, ext]).nice().range([m.l, W - m.r]);
    svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(5).tickFormat((v) => (v > 0 ? '+' : '') + v));
    svg.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', m.t).attr('y2', H - m.b).style('stroke', 'var(--cds-chart-reference)');
    const tp = MZ.tip(el);
    const g = svg.append('g').selectAll('g').data(rows).join('g').attr('transform', (u, i) => `translate(0,${m.t + i * bh})`).style('opacity', (u) => (!dist || u.distrito === dist ? 1 : 0.3));
    g.append('rect').attr('x', (u) => x(Math.min(0, u.d_pgen))).attr('width', (u) => Math.abs(x(u.d_pgen) - x(0))).attr('y', 4).attr('height', bh - 8)
      .style('fill', (u) => MZ.distColor(u.distrito));
    g.append('text').attr('x', m.l - 6).attr('y', bh / 2 + 4).attr('text-anchor', 'end').attr('font-size', 11).style('fill', 'var(--color-fg)').text(lab);
    g.append('text').attr('x', (u) => (u.d_pgen < 0 ? x(u.d_pgen) - 4 : x(u.d_pgen) + 4)).attr('text-anchor', (u) => (u.d_pgen < 0 ? 'end' : 'start'))
      .attr('y', bh / 2 + 4).attr('font-size', 11).style('fill', 'var(--cds-text-secondary)')
      .text((u) => ((u.d_pgen > 0 ? '+' : '') + MZ.f1(u.d_pgen)))
      .each(function (u) { if (u.d_pgen < 0 && x(u.d_pgen) - 4 - this.getComputedTextLength() < m.l) d3.select(this).attr('x', x(0) + 4).attr('text-anchor', 'start'); });
    g.append('rect').attr('x', 0).attr('width', W).attr('height', bh).style('fill', 'transparent')
      .on('pointermove', (ev, u) => { const [mx, my] = d3.pointer(ev, el); tp.show([[u.nombre], [`${u.distrito}`, 's'], [`2015: ${MZ.f1(u.pgen_2015)}% → 2023: ${MZ.f1(u.pgen_2023)}%`], [`Cambio: ${u.d_pgen > 0 ? '+' : ''}${MZ.f1(u.d_pgen)} pp`]], mx, my); })
      .on('pointerleave', () => tp.hide());
    const lg = document.createElement('div'); lg.className = 'legend';
    ['La Pintada', 'Donoso', 'Omar Torrijos Herrera'].forEach((d) => { const s = document.createElement('span'); const sw = document.createElement('i'); sw.className = 'sw'; sw.style.background = MZ.distColor(d); s.append(sw, d); lg.appendChild(s); });
    el.appendChild(lg);
  });

  dash.draw('tabla_ad', (tb) => {
    tb.replaceChildren(); const d = dash.data('antes_despues');
    if (d.status !== 'ok') { const tr = tb.insertRow(); const td = tr.insertCell(); td.colSpan = 8; td.textContent = d.status === 'error' ? 'No se pudieron calcular los cambios.' : '—'; return; }
    const dist = MZ.distrito();
    d.data.forEach((r) => {
      const tr = tb.insertRow(); tr.dataset.key = r.clave; if (dist && r.territorio === dist) tr.className = 'sel';
      const c = (t, cls) => { const td = tr.insertCell(); td.textContent = t; if (cls) td.className = cls; return td; };
      c(r.territorio); c(r.indicador); c(r.periodo);
      c(r.antes === null ? '—' : MZ.f1(r.antes), 'n'); c(r.despues === null ? '—' : MZ.f1(r.despues), 'n');
      c(r.cambio === null ? '—' : (r.cambio > 0 ? '+' : '') + MZ.f1(r.cambio), 'n'); c(r.cambio_anual === null ? '—' : (r.cambio_anual > 0 ? '+' : '') + MZ.f2(r.cambio_anual), 'n');
      const td = tr.insertCell(); const ch = document.createElement('span'); ch.className = 'chip ' + (r.veredicto === 'Mejora' ? 'good' : r.veredicto === 'Deterioro' ? 'bad' : 'flat'); ch.textContent = r.veredicto; td.appendChild(ch);
    });
  });
})();

// ---------- Empleo ----------
(() => {
  const LAB = {
    ocup_mineria: { rate: false }, tasa_desempleo: { rate: true }, pct_informal: { rate: true },
    ocup_agro: { rate: false }, ocup_construccion: { rate: false }, ocupados: { rate: false },
  };
  dash.draw('lab_chart', (el) => {
    const msg = MZ.stateMsg(['lab_anual']);
    if (msg === null) { el.classList.add('dash-skeleton'); return; }
    el.classList.remove('dash-skeleton'); if (msg) return MZ.placeholder(el, msg);
    const k = LAB[dash.params().lab_ind] ? dash.params().lab_ind : 'ocup_mineria'; const cfg = LAB[k];
    const rows = dash.data('lab_anual').data; const dist = MZ.distrito();
    const terrs = cfg.rate ? ['Coclé', 'Colón', 'Panamá (total)'] : ['Coclé', 'Colón'];
    const prov = dist ? (dist === 'La Pintada' ? 'Coclé' : 'Colón') : null;
    const cols = { 'Coclé': dash.colors[0], 'Colón': dash.colors[1], 'Panamá (total)': 'var(--cds-chart-muted)' };
    const xMin = k.startsWith('ocup_') ? 2017 : 2013;
    const series = terrs.map((t) => ({ name: t, color: cols[t], dash: t === 'Panamá (total)' ? '4 3' : null, dim: !!prov && t !== prov && t !== 'Panamá (total)',
      points: d3.range(xMin, 2027).map((y) => { const r = rows.find((x) => x.territorio === t && x.anio === y); return { x: y, y: r ? r[k] : null }; }) }));
    MZ.lineChart(el, { series, xMin, xMax: 2026, yFmt: cfg.rate ? (v) => MZ.f0(v) + '%' : (v) => MZ.f0(v), selYear: MZ.anio(), zeroBase: true, tipFmt: cfg.rate ? (v) => MZ.f1(v) + '%' : MZ.f0 });
  });

  dash.draw('rama_chart', (el) => {
    const msg = MZ.stateMsg(['laboral_area']);
    if (msg === null) { el.classList.add('dash-skeleton'); return; }
    el.classList.remove('dash-skeleton'); if (msg) return MZ.placeholder(el, msg);
    el.replaceChildren();
    const p = dash.params(); const prov = p.rama_prov || 'Colón', area = p.rama_area || 'Total';
    let y = MZ.anio(); let note = '';
    if (y < 2017) { note = 'no hay datos por rama antes de 2017'; y = 2017; }
    if (y === 2020) return MZ.placeholder(el, 'No hay datos provinciales por rama en 2020 (pandemia). Elige otro año.');
    const rows = dash.data('laboral_area').data.filter((r) => r.categoria === 'Rama de actividad' && r.serie === 'Ocupados' && r.provincia === prov && r.area === area && r.item !== 'Total' && r.item !== 'Nunca han trabajado');
    const val = (item, yy) => { const r = rows.find((x) => x.item === item && +x.anio === yy); return r ? +r.valor : 0; };
    const items = [...new Set(rows.map((r) => r.item))].map((it) => ({ it, v: val(it, y), b: val(it, 2018) })).sort((a, b) => b.v - a.v).slice(0, 10);
    const short = (s) => s.replace('Comercio al por mayor y al por menor', 'Comercio').replace('Administración Pública y Defensa; Planes de Seguridad Social de Afiliación Obligatoria', 'Administración pública').replace('Actividades Administrativas y Servicios de Apoyo', 'Servicios administrativos').replace('Servicios Sociales y Relacionados con la Salud Humana', 'Salud y servicios sociales').replace('Enzeñanza', 'Enseñanza').replace('Explotación de minas y canteras', 'Minas y canteras').replace(/^Act\. de los Hog.*/, 'Hogares empleadores').replace(/,.*$/, '');
    const W = Math.max(280, el.clientWidth), bh = 24, H = items.length * bh + 28;
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', el.getAttribute('aria-label'));
    const probe = svg.append('g'); let lw = 0; items.forEach((d) => { const t = probe.append('text').attr('font-size', 11).text(short(d.it)); lw = Math.max(lw, t.node().getComputedTextLength()); }); probe.remove();
    const m = { l: Math.min(lw + 10, W * 0.45), r: 50, t: 2, b: 24 };
    const fit = (txtNode, s) => { txtNode.textContent = s; let t = s; while (t.length > 4 && txtNode.getComputedTextLength() > m.l - 10) { t = t.slice(0, -1); txtNode.textContent = t.trimEnd() + '…'; } };
    const x = d3.scaleLinear().domain([0, d3.max(items, (d) => Math.max(d.v, d.b)) || 1]).nice().range([m.l, W - m.r]);
    svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(4).tickFormat((v) => MZ.f0(v)));
    const tp = MZ.tip(el);
    const g = svg.append('g').selectAll('g').data(items).join('g').attr('transform', (d, i) => `translate(0,${m.t + i * bh})`);
    g.append('rect').attr('x', m.l).attr('y', 4).attr('height', bh - 8).attr('width', (d) => Math.max(0, x(d.v) - m.l)).style('fill', (d) => (d.it.startsWith('Explotación') ? 'var(--cds-chart-status-critical)' : dash.colors[0]));
    g.append('line').attr('x1', (d) => x(d.b)).attr('x2', (d) => x(d.b)).attr('y1', 1).attr('y2', bh - 1).style('stroke', 'var(--color-fg)').style('stroke-width', 2);
    g.append('text').attr('x', m.l - 6).attr('y', bh / 2 + 4).attr('text-anchor', 'end').attr('font-size', 11).style('fill', 'var(--color-fg)').each(function (d) { fit(this, short(d.it)); });
    g.append('text').attr('x', (d) => Math.max(x(d.v), x(d.b)) + 4).attr('y', bh / 2 + 4).attr('font-size', 11).style('fill', 'var(--cds-text-secondary)').text((d) => MZ.f0(d.v));
    g.append('rect').attr('x', 0).attr('width', W).attr('height', bh).style('fill', 'transparent')
      .on('pointermove', (ev, d) => { const [mx, my] = d3.pointer(ev, el); const c = d.b ? Math.round(1000 * (d.v - d.b) / d.b) / 10 : null; tp.show([[d.it], [`${y}: ${MZ.f0(d.v)} ocupados`], [`2018: ${MZ.f0(d.b)}${c !== null ? ` (${c > 0 ? '+' : ''}${MZ.f1(c)}%)` : ''}`, 's']], mx, my); })
      .on('pointerleave', () => tp.hide());
    const lg = document.createElement('div'); lg.className = 'legend';
    const a = document.createElement('span'); a.textContent = `Barra: ${y}${note ? ' (' + note + ')' : ''} · Marca: 2018 · Rojo: minas y canteras · ${prov}, área ${area.toLowerCase()}`; lg.appendChild(a);
    el.appendChild(lg);
  });

  dash.draw('tabla_per', (tb) => {
    tb.replaceChildren(); const d = dash.data('periodos_lab');
    if (d.status !== 'ok') { const tr = tb.insertRow(); const td = tr.insertCell(); td.colSpan = 7; td.textContent = d.status === 'error' ? 'No se pudieron calcular los promedios.' : '—'; return; }
    const prov = MZ.distrito() ? (MZ.distrito() === 'La Pintada' ? 'Coclé' : 'Colón') : 'Coclé + Colón';
    d.data.forEach((r) => {
      const tr = tb.insertRow(); tr.dataset.key = r.clave; if (r.territorio === prov) tr.className = 'sel';
      const c = (t, cls) => { const td = tr.insertCell(); td.textContent = t; if (cls) td.className = cls; return td; };
      const v = (x) => (x === null ? '—' : r.unidad === 'pp' ? MZ.f1(x) + '%' : MZ.f0(x));
      const ch = (x) => (x === null ? '—' : (x > 0 ? '+' : '') + MZ.f1(x) + (r.unidad === 'pp' ? ' pp' : '%'));
      const goodDown = r.unidad === 'pp';
      const cls = (x) => { if (x === null) return 'n flat'; const thr = r.unidad === 'pp' ? 1 : 10; const good = goodDown ? x <= -thr : x >= thr; const bad = goodDown ? x >= thr : x <= -thr; return 'n ' + (good ? 'good' : bad ? 'bad' : 'flat'); };
      c(r.territorio); c(r.indicador); c(v(r.antes), 'n'); c(v(r.operacion), 'n'); c(v(r.post), 'n'); c(ch(r.cambio_op), cls(r.cambio_op)); c(ch(r.cambio_post), cls(r.cambio_post));
    });
  });
})();

// ---------- Servicios, mortalidad y conclusión ----------
(() => {
  dash.draw('tabla_serv', (tb) => {
    tb.replaceChildren(); const d = dash.data('servicios');
    if (d.status !== 'ok') { const tr = tb.insertRow(); const td = tr.insertCell(); td.colSpan = 8; td.textContent = d.status === 'error' ? 'No se pudieron cargar los servicios.' : '—'; return; }
    d.data.forEach((r) => {
      const tr = tb.insertRow(); if (MZ.distrito() === r.distrito) tr.className = 'sel';
      const c = (t, cls) => { const td = tr.insertCell(); td.textContent = t; if (cls) td.className = cls; };
      c(r.distrito); c(MZ.f0(r.escuelas), 'n'); c(MZ.f0(r.matricula), 'n'); c(MZ.f0(r.media), 'n'); c(MZ.f1(r.matricula_x1000), 'n'); c(MZ.f0(r.salud_total), 'n');
      c(MZ.f0(r.salud_no_funcionan), r.salud_no_funcionan ? 'n bad' : 'n'); c(MZ.f1(r.mides_x100), 'n');
    });
  });

  dash.draw('mort_chart', (el) => {
    const msg = MZ.stateMsg(['mortalidad']);
    if (msg === null) { el.classList.add('dash-skeleton'); return; }
    el.classList.remove('dash-skeleton'); if (msg) return MZ.placeholder(el, msg);
    const rows = dash.data('mortalidad').data; const dist = MZ.distrito();
    const names = ['La Pintada', 'Donoso', 'Omar Torrijos Herrera', 'Panamá (total)'];
    const series = names.map((nm) => ({ name: nm, color: nm === 'Panamá (total)' ? 'var(--cds-chart-muted)' : MZ.distColor(nm), dash: nm === 'Panamá (total)' ? '4 3' : null,
      dim: !!dist && nm !== dist && nm !== 'Panamá (total)',
      points: rows.filter((r) => r.territorio === nm).map((r) => ({ x: +r.anio, y: +r.tasa_x1000 })).sort((a, b) => a.x - b.x) }));
    MZ.lineChart(el, { series, xMin: 2021, xMax: 2025, yFmt: (v) => MZ.f1(v), selYear: MZ.anio(), zeroBase: true, tipFmt: (v) => MZ.f1(v) + ' por 1.000' });
  });
  const mortN = (name, y) => dash.draw(name, (el) => {
    const d = dash.data('mortalidad'); const r = d.status === 'ok' ? d.data.find((x) => x.territorio === 'Omar Torrijos Herrera' && +x.anio === y) : null;
    el.textContent = r ? MZ.f0(+r.defunciones) : '—';
  });
  mortN('mort_min', 2023); mortN('mort_max', 2021);

  dash.draw('veredictos', (ul) => {
    ul.replaceChildren();
    const ad = dash.data('antes_despues'), pl = dash.data('periodos_lab'), sv = dash.data('servicios');
    if (ad.status !== 'ok' || pl.status !== 'ok' || sv.status !== 'ok') { const li = document.createElement('li'); li.textContent = ad.status === 'error' || pl.status === 'error' ? 'No se pudieron calcular las lecturas.' : '—'; ul.appendChild(li); return; }
    const dist = MZ.distrito(); const s = MZ.slugD(dist); const terr = MZ.nameD(dist);
    const prov = MZ.provSlug(dist), provN = MZ.provName(dist);
    const li = (parts) => { const l = document.createElement('li'); parts.forEach((p) => { if (typeof p === 'string') l.append(p); else l.appendChild(p); }); ul.appendChild(l); };
    const m = (txt, src, field, key) => { const sp = document.createElement('span'); sp.textContent = txt; sp.dataset.source = src; sp.dataset.field = field; sp.dataset.where = key; return sp; };
    const chip = (v) => { const c = document.createElement('span'); c.className = 'chip ' + (v === 'Mejora' || v === 'Positivo' ? 'good' : v === 'Deterioro' || v === 'Negativo' ? 'bad' : 'flat'); c.textContent = v; return c; };
    const g = (k) => ad.data.find((r) => r.clave === k);
    const pg = g(`${s}_pgen_b`), pa = g(`${s}_pgen_a`), pe = g(`${s}_pext_b`), ip = g(`${s}_ipm_b`);
    if (pg && pg.cambio !== null) {
      const hasA = pa && pa.cambio_anual !== null;
      const slower = hasA && pg.cambio_anual > pa.cambio_anual;
      li([chip(pg.veredicto), ` Pobreza general en ${terr}: de `, m(MZ.f1(pg.antes) + '%', 'antes_despues', 'antes', `clave=${pg.clave}`), ' (2015) a ', m(MZ.f1(pg.despues) + '%', 'antes_despues', 'despues', `clave=${pg.clave}`),
        ' (2023), ', m((pg.cambio > 0 ? '+' : '') + MZ.f1(pg.cambio) + ' pp', 'antes_despues', 'cambio', `clave=${pg.clave}`),
        hasA ? `. ${slower ? 'Mejoró más despacio' : 'Mejoró igual o más rápido'} que en 2011–2015 (` : '.',
        ...(hasA ? [m(MZ.f2(pg.cambio_anual), 'antes_despues', 'cambio_anual', `clave=${pg.clave}`), ' frente a ', m(MZ.f2(pa.cambio_anual), 'antes_despues', 'cambio_anual', `clave=${pa.clave}`), ' pp por año).'] : [])]);
    }
    if (pe && pe.cambio !== null) li([chip(pe.veredicto), ' Pobreza extrema: de ', m(MZ.f1(pe.antes) + '%', 'antes_despues', 'antes', `clave=${pe.clave}`), ' a ', m(MZ.f1(pe.despues) + '%', 'antes_despues', 'despues', `clave=${pe.clave}`), ' entre 2015 y 2023.']);
    if (ip && ip.cambio !== null) li([chip(ip.veredicto), ' Pobreza multidimensional (vivienda, servicios, educación, salud): de ', m(MZ.f1(ip.antes) + '%', 'antes_despues', 'antes', `clave=${ip.clave}`), ' (2010) a ', m(MZ.f1(ip.despues) + '%', 'antes_despues', 'despues', `clave=${ip.clave}`), ' (2023). Esta medición abarca la construcción y la operación, no solo desde 2019.']);
    const P = (k) => pl.data.find((r) => r.clave === `${prov}_${k}`);
    const mi = P('ocup_mineria');
    if (mi) {
      const v = mi.cambio_op !== null && mi.cambio_op >= 10 ? 'Positivo' : mi.cambio_op !== null && mi.cambio_op <= -10 ? 'Negativo' : 'Sin cambio';
      li([chip(v), ` Empleo minero en ${provN}: `, m(MZ.f0(mi.antes), 'periodos_lab', 'antes', `clave=${mi.clave}`), ' ocupados al año antes, ', m(MZ.f0(mi.operacion), 'periodos_lab', 'operacion', `clave=${mi.clave}`), ' en operación y ', m(MZ.f0(mi.post), 'periodos_lab', 'post', `clave=${mi.clave}`), ' con la mina paralizada (', m((mi.cambio_post > 0 ? '+' : '') + MZ.f1(mi.cambio_post) + '%', 'periodos_lab', 'cambio_post', `clave=${mi.clave}`), ').']);
    }
    // Tasas: se comparan con el cambio del país en el mismo periodo (diferencia en diferencias simple)
    const rel = (k, label) => {
      const r = P(k), n = pl.data.find((x) => x.clave === `panama_${k}`);
      if (!r || !n || r.cambio_op === null || n.cambio_op === null) return;
      const dd = Math.round(10 * (r.cambio_op - n.cambio_op)) / 10;
      const v = dd <= -1 ? 'Mejor que el país' : dd >= 1 ? 'Peor que el país' : 'Igual que el país';
      const c = chip(v); c.className = 'chip ' + (dd <= -1 ? 'good' : dd >= 1 ? 'bad' : 'flat');
      li([c, ` ${label} en ${provN}: `, m(MZ.f1(r.antes) + '%', 'periodos_lab', 'antes', `clave=${r.clave}`), ' antes, ', m(MZ.f1(r.operacion) + '%', 'periodos_lab', 'operacion', `clave=${r.clave}`), ' en operación (', m((r.cambio_op > 0 ? '+' : '') + MZ.f1(r.cambio_op) + ' pp', 'periodos_lab', 'cambio_op', `clave=${r.clave}`), ') y ', m(MZ.f1(r.post) + '%', 'periodos_lab', 'post', `clave=${r.clave}`), ' paralizada. En todo el país el cambio fue de ', m((n.cambio_op > 0 ? '+' : '') + MZ.f1(n.cambio_op) + ' pp', 'periodos_lab', 'cambio_op', `clave=${n.clave}`), ' (incluye la pandemia).']);
    };
    rel('tasa_desempleo', 'Desempleo');
    rel('pct_informal', 'Informalidad no agrícola');
    const sr = sv.data.find((r) => r.distrito === terr);
    if (sr) li([chip('Sin línea base'), ` Servicios hoy en ${terr}: `, m(MZ.f0(sr.salud_no_funcionan), 'servicios', 'salud_no_funcionan', `distrito=${terr}`), ' de ', m(MZ.f0(sr.salud_total), 'servicios', 'salud_total', `distrito=${terr}`), ' instalaciones de salud no funcionan y hay ', m(MZ.f0(sr.media), 'servicios', 'media', `distrito=${terr}`), ' estudiantes en educación media. Sin datos anteriores no se puede atribuir un cambio.']);
  });
})();
