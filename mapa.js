// ---------- Mapa ----------
(() => {
  const CAPAS = {
    pgen: { t: 'Pobreza general', u: '%', bad: true, year: 'pgen' },
    pext: { t: 'Pobreza extrema', u: '%', bad: true, year: 'pext' },
    ipm: { t: 'IPM', u: '%', bad: true, year: 'ipm' },
    d_pgen: { t: 'Cambio pobreza general 2015→2023', u: ' pp', div: true },
    d_pext: { t: 'Cambio pobreza extrema 2015→2023', u: ' pp', div: true },
    d_ipm: { t: 'Cambio IPM 2010→2023', u: ' pp', div: true },
    ingreso_pc_2023: { t: 'Ingreso per cápita 2023', u: '', pre: 'B/. ', bad: false },
    pinf_gen_2023: { t: 'Pobreza infantil 2023', u: '%', bad: true },
    matricula_x1000: { t: 'Matrícula por 1.000 hab.', u: '', bad: false },
    pct_salud_funciona: { t: 'Instalaciones de salud que funcionan', u: '%', bad: false },
    mides_x100: { t: 'Beneficiarios MIDES por 100 hab.', u: '', bad: true },
    pct_sup_sin_titulo: { t: 'Superficie sin título', u: '%', bad: true },
  };
  const MINA = [-80.633, 8.833];
  const SRV = { internet: 'internet', luz_red: 'electricidad de red', agua_red: 'agua de red o acueducto' };
  const field = (capa) => { const c = CAPAS[capa]; if (!c.year) return capa; const y = MZ.pobYear(MZ.anio(), c.year); return y ? `${c.year}_${y}` : null; };
  const scaleFor = (capa, vals) => {
    const c = CAPAS[capa];
    if (c.div) { const m = Math.max(5, d3.max(vals, (v) => Math.abs(v)) || 5); return d3.scaleSequential((t) => d3.interpolateRdBu(1 - t)).domain([-m, m]); }
    const ext = d3.extent(vals); if (ext[0] === ext[1]) ext[1] = ext[0] + 1;
    return d3.scaleSequential(c.bad ? d3.interpolateOrRd : d3.interpolateGnBu).domain(['pgen', 'pext', 'ipm', 'pinf_gen_2023'].includes(capa) ? [0, 100] : ext);
  };
  const fmtV = (capa, v) => { const c = CAPAS[capa]; if (v === null || v === undefined) return 'sin dato'; return (c.pre || '') + (c.div && v > 0 ? '+' : '') + (capa === 'ingreso_pc_2023' ? MZ.f2(v) : MZ.f1(v)) + c.u; };
  const pc = (v) => (v === null || v === undefined ? '—' : MZ.f1(v) + '%');

  dash.draw('mapa', {
    mount: (el) => ({}),
    update: (el) => {
      const msg = MZ.stateMsg(['unidades', 'mapa']);
      if (msg === null) { if (!el.querySelector('svg')) el.classList.add('dash-skeleton'); return; }
      el.classList.remove('dash-skeleton');
      if (msg) return MZ.placeholder(el, msg);
      const geo = dash.data('mapa').data; const uni = dash.data('unidades').data;
      if (!geo || !geo.features) return MZ.placeholder(el, 'No se pudo leer la geometría del mapa.');
      const p = dash.params(); const capa = CAPAS[p.capa] ? p.capa : 'pgen'; const f = field(capa); const dist = MZ.distrito();
      const byU = new Map(uni.map((u) => [u.unidad, u]));
      const study = { type: 'FeatureCollection', features: geo.features.filter((g) => g.properties.unidad) };
      const W = Math.max(300, el.clientWidth), H = Math.round(Math.min(620, Math.max(380, W * 0.78)));
      const proj = d3.geoMercator().fitExtent([[10, 10], [W - 10, H - 10]], study);
      const path = d3.geoPath(proj);
      [...el.children].forEach((c) => { if (!c.classList.contains('tip')) c.remove(); });
      const svg = d3.select(el).insert('svg', ':first-child').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', `Mapa: ${CAPAS[capa].t}`);
      const vals = f ? uni.map((u) => u[f]).filter((v) => v !== null && v !== undefined) : [];
      const sc = vals.length ? scaleFor(capa, vals) : null;
      svg.append('g').selectAll('path').data(geo.features.filter((g) => !g.properties.unidad)).join('path').attr('d', path)
        .style('fill', 'var(--color-panel)').style('stroke', 'var(--color-border-line)').style('stroke-width', 0.6);
      const tp = MZ.tip(el);
      svg.append('g').selectAll('path').data(study.features).join('path').attr('d', path)
        .style('fill', (g) => { const u = byU.get(g.properties.unidad); const v = u && f ? u[f] : null; return v === null || v === undefined || !sc ? 'var(--color-panel)' : sc(v); })
        .style('stroke', 'var(--color-bg)').style('stroke-width', 1.2)
        .style('opacity', (g) => { const u = byU.get(g.properties.unidad); return !dist || (u && u.distrito === dist) ? 1 : 0.3; })
        .on('pointermove', (ev, g) => {
          const u = byU.get(g.properties.unidad); if (!u) return;
          const [mx, my] = d3.pointer(ev, el);
          tp.show([
            [u.nombre], [`${u.distrito}, ${u.provincia} · ${MZ.f0(u.poblacion_2023)} hab. (2023)`, 's'],
            [`${CAPAS[capa].t}${CAPAS[capa].year ? ' ' + (f || '').split('_').pop() : ''}: ${fmtV(capa, f ? u[f] : null)}`],
            [`Pobreza general: ${pc(u.pgen_2011)} (2011) · ${pc(u.pgen_2015)} (2015) · ${pc(u.pgen_2023)} (2023)`, 's'],
            [`IPM: ${pc(u.ipm_2010)} (2010) → ${pc(u.ipm_2023)} (2023)`, 's'],
            [`Escuelas: ${u.escuelas} (${MZ.f0(u.matricula)} estudiantes) · Salud: ${u.salud_funcionan} de ${u.salud} funcionan`, 's'],
          ], mx, my);
          d3.select(ev.currentTarget).style('stroke', 'var(--color-fg)').style('stroke-width', 2).raise();
        })
        .on('pointerleave', (ev) => { tp.hide(); d3.select(ev.currentTarget).style('stroke', 'var(--color-bg)').style('stroke-width', 1.2); });
      // superposiciones
      const cen = new Map(study.features.map((g) => [g.properties.unidad, path.centroid(g)]));
      if (p.ov_esc) {
        const r = d3.scaleSqrt().domain([0, d3.max(uni, (u) => u.matricula) || 1]).range([0, Math.max(10, W / 28)]);
        svg.append('g').selectAll('circle').data(uni.filter((u) => u.matricula > 0 && cen.get(u.unidad))).join('circle')
          .attr('cx', (u) => cen.get(u.unidad)[0] - 8).attr('cy', (u) => cen.get(u.unidad)[1]).attr('r', (u) => r(u.matricula))
          .style('fill', dash.colors[0]).style('fill-opacity', 0.45).style('stroke', dash.colors[0]).style('pointer-events', 'none');
      }
      if (p.ov_sal) {
        const g = svg.append('g').style('pointer-events', 'none');
        uni.forEach((u) => {
          if (!cen.get(u.unidad)) return;
          const [cx, cy] = cen.get(u.unidad);
          for (let i = 0; i < u.salud; i++) {
            const ok = i < u.salud_funcionan; const xx = cx + 8 + (i % 4) * 7, yy = cy + 10 + Math.floor(i / 4) * 7;
            g.append('path').attr('d', `M${xx - 3},${yy}h6M${xx},${yy - 3}v6`).style('stroke', ok ? 'var(--color-ok)' : 'var(--color-bad)').style('stroke-width', 2.2);
          }
        });
      }
      if (p.ov_srv && MZ.ok('escuelas_servicios')) {
        const k = SRV[p.srv_tipo] ? p.srv_tipo : 'internet';
        const pts = dash.data('escuelas_servicios').data.filter((r) => +r.en_servicios === 1 && r.lon !== null && r.lat !== null && (!dist || r.distrito === dist));
        const rr = d3.scaleSqrt().domain([0, d3.max(pts, (r) => +r.total) || 1]).range([3, Math.max(7, W / 70)]);
        const tps = MZ.tip(el);
        svg.append('g').selectAll('circle').data(pts.sort((a, b) => +b.total - +a.total)).join('circle')
          .attr('cx', (r) => proj([+r.lon, +r.lat])[0]).attr('cy', (r) => proj([+r.lon, +r.lat])[1]).attr('r', (r) => rr(+r.total || 0))
          .style('fill', (r) => (+r[k] === 1 ? 'var(--color-ok)' : 'var(--color-bg)')).style('fill-opacity', 0.95).style('stroke', (r) => (+r[k] === 1 ? 'var(--color-bg)' : 'var(--color-fg)')).style('stroke-width', (r) => (+r[k] === 1 ? 1 : 1.6))
          .on('pointermove', (ev, r) => {
            const [mx, my] = d3.pointer(ev, el);
            tps.show([[r.centro], [`${r.corregimiento}, ${r.distrito} · ${MZ.f0(+r.total || 0)} estudiantes (2026)`, 's'],
              [`Internet: ${+r.internet === 1 ? 'sí' : 'no'} · Electricidad: ${r.fuente_electrica || 'sin dato'}`], [`Agua: ${r.fuente_agua || 'sin dato'}`, 's']], mx, my);
          })
          .on('pointerleave', () => tps.hide());
      }
      if (p.ov_lbl ?? true) {
        svg.append('g').style('pointer-events', 'none').selectAll('text').data(uni.filter((u) => cen.get(u.unidad))).join('text')
          .attr('x', (u) => cen.get(u.unidad)[0]).attr('y', (u) => cen.get(u.unidad)[1] - 6).attr('text-anchor', 'middle').attr('font-size', W < 500 ? 9 : 11)
          .style('fill', 'var(--color-fg)').style('paint-order', 'stroke').style('stroke', 'var(--color-bg)').style('stroke-width', 3)
          .text((u) => u.nombre.split(' + ')[0] + (u.nombre.includes(' + ') ? ' +' : ''));
      }
      if (p.ov_mina ?? true) {
        const [mx, my] = proj(MINA);
        const g = svg.append('g').style('pointer-events', 'none');
        g.append('path').attr('d', d3.symbol(d3.symbolStar, 260)()).attr('transform', `translate(${mx},${my})`).style('fill', 'var(--cds-chart-status-critical)').style('stroke', 'var(--color-bg)').style('stroke-width', 1.5);
        g.append('text').attr('x', mx + 12).attr('y', my + 4).attr('font-size', 12).style('font-weight', 600).style('fill', 'var(--color-fg)').style('paint-order', 'stroke').style('stroke', 'var(--color-bg)').style('stroke-width', 3).text('Mina Cobre Panamá');
      }
    },
  });

  dash.draw('mapa_leyenda', (el) => {
    el.replaceChildren();
    if (!MZ.ok('unidades')) return;
    const p = dash.params(); const capa = CAPAS[p.capa] ? p.capa : 'pgen'; const f = field(capa);
    const uni = dash.data('unidades').data; const vals = f ? uni.map((u) => u[f]).filter((v) => v !== null) : [];
    const t = document.createElement('span'); t.textContent = f ? `${CAPAS[capa].t}${CAPAS[capa].year ? ' · medición ' + f.split('_').pop() : ''}` : `${CAPAS[capa].t}: no hay medición para ${MZ.anio()}`; el.appendChild(t);
    if (!vals.length) return;
    const sc = scaleFor(capa, vals); const [a, b] = sc.domain();
    const svg = d3.select(el).append('svg').attr('width', 220).attr('height', 26);
    const id = 'grad-' + capa; const lg = svg.append('defs').append('linearGradient').attr('id', id);
    d3.range(0, 1.01, 0.1).forEach((s) => lg.append('stop').attr('offset', s).attr('stop-color', sc(a + s * (b - a))));
    svg.append('rect').attr('x', 0).attr('y', 2).attr('width', 220).attr('height', 10).attr('fill', `url(#${id})`);
    svg.append('text').attr('x', 0).attr('y', 24).attr('font-size', 11).style('fill', 'var(--cds-text-secondary)').text(fmtV(capa, a));
    svg.append('text').attr('x', 220).attr('y', 24).attr('text-anchor', 'end').attr('font-size', 11).style('fill', 'var(--cds-text-secondary)').text(fmtV(capa, b));
    if (CAPAS[capa].div) { const s = document.createElement('span'); s.textContent = 'Azul = bajó (mejora) · Rojo = subió'; el.appendChild(s); }
    if (p.ov_srv) { const s = document.createElement('span'); s.textContent = `● verde: la escuela tiene ${SRV[p.srv_tipo] || SRV.internet} · ○ blanco: no tiene o sin especificar (tamaño = matrícula; MEDUCA 2025)`; el.appendChild(s); }
    if (p.ov_sal) { const s = document.createElement('span'); s.textContent = '+ verde: instalación funciona · + rojo: no funciona'; el.appendChild(s); }
  });
})();
