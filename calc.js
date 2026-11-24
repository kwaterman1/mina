// ---------- Cálculos (agregaciones a partir de los archivos) ----------
dash.calc('unidades', {
  title: 'Indicadores por corregimiento (unidades del mapa)',
  description: 'Agrupa los 15 corregimientos en las 12 unidades del mapa, con promedios ponderados por población.',
  inputs: ['corregimientos', 'escuelas', 'salud'],
  fn: (corregimientos, escuelas, salud) => {
    const n = (v) => (v === null || v === undefined || v === '' ? null : +v);
    const r1 = (v, d = 1) => (v === null || !isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
    const wavg = (rows, col, wcol) => {
      let s = 0, w = 0;
      rows.forEach((r) => { const v = n(r[col]), p = n(r[wcol]); if (v !== null && p) { s += v * p; w += p; } });
      return w ? s / w : null;
    };
    const sum = (rows, col) => rows.reduce((a, r) => a + (n(r[col]) || 0), 0);
    const units = [...new Set(corregimientos.map((r) => r.unidad))];
    return units.map((u) => {
      const rs = corregimientos.filter((r) => r.unidad === u).sort((a, b) => (+b.cabecera || 0) - (+a.cabecera || 0) || (+b.personas_2010 || 0) - (+a.personas_2010 || 0));
      const es = escuelas.filter((r) => r.unidad === u);
      const sa = salud.filter((r) => r.unidad === u);
      const pop = sum(rs, 'poblacion_2023');
      const o = {
        unidad: u, nombre: rs.map((r) => r.corregimiento).join(' + '), distrito: rs[0].distrito, provincia: rs[0].provincia,
        poblacion_2023: pop, personas_2010: sum(rs, 'personas_2010'),
        pgen_2011: r1(wavg(rs, 'pgen_2011', 'personas_2010')), pgen_2015: r1(wavg(rs, 'pgen_2015', 'personas_2010')), pgen_2023: r1(wavg(rs, 'pgen_2023', 'poblacion_2023')),
        pext_2011: r1(wavg(rs, 'pext_2011', 'personas_2010')), pext_2015: r1(wavg(rs, 'pext_2015', 'personas_2010')), pext_2023: r1(wavg(rs, 'pext_2023', 'poblacion_2023')),
        ipm_2010: r1(wavg(rs, 'ipm_2010', 'personas_2010')), ipm_2023: r1(wavg(rs, 'ipm_2023', 'poblacion_2023')),
        pinf_gen_2023: r1(wavg(rs, 'pinf_gen_2023', 'poblacion_2023')), ingreso_pc_2023: r1(wavg(rs, 'ingreso_pc_2023', 'poblacion_2023')),
        escuelas: es.length, matricula: es.reduce((a, r) => a + (+r.total || 0), 0),
        salud: sa.length, salud_funcionan: sa.filter((r) => r.funciona === '1').length,
        mides: sum(rs, 'mides_2024'), sup_ha: sum(rs, 'sup_ha_2024'), sup_sin_titulo: sum(rs, 'sup_sin_titulo_ha'),
      };
      o.d_pgen = r1(o.pgen_2023 - o.pgen_2015); o.d_pext = r1(o.pext_2023 - o.pext_2015); o.d_ipm = r1(o.ipm_2023 - o.ipm_2010);
      o.matricula_x1000 = r1(1000 * o.matricula / pop); o.mides_x100 = r1(100 * o.mides / pop);
      o.pct_salud_funciona = o.salud ? r1(100 * o.salud_funcionan / o.salud) : null;
      o.pct_sup_sin_titulo = o.sup_ha ? r1(100 * o.sup_sin_titulo / o.sup_ha) : null;
      return o;
    });
  },
});

dash.calc('indicadores', {
  title: 'Pobreza por distrito y área de estudio',
  description: 'Pobreza general, extrema e IPM por distrito y para los tres distritos juntos, ponderada por población.',
  inputs: ['corregimientos'],
  fn: (corregimientos) => {
    const n = (v) => (v === null || v === undefined || v === '' ? null : +v);
    const wavg = (rows, col, wcol) => {
      let s = 0, w = 0;
      rows.forEach((r) => { const v = n(r[col]), p = n(r[wcol]); if (v !== null && p) { s += v * p; w += p; } });
      return w ? Math.round(10 * s / w) / 10 : null;
    };
    const terrs = [['la_pintada', 'La Pintada'], ['donoso', 'Donoso'], ['oth', 'Omar Torrijos Herrera'], ['area', 'Área de estudio']];
    const inds = [['pgen', [2011, 2015, 2023]], ['pext', [2011, 2015, 2023]], ['ipm', [2010, 2023]]];
    const out = [];
    terrs.forEach(([slug, name]) => {
      const rs = slug === 'area' ? corregimientos : corregimientos.filter((r) => r.distrito === name);
      inds.forEach(([ind, years]) => years.forEach((y) => {
        out.push({ clave: `${slug}_${ind}_${y}`, territorio: name, indicador: ind, anio: y,
          valor: wavg(rs, `${ind}_${y}`, y === 2023 ? 'poblacion_2023' : 'personas_2010') });
      }));
    });
    return out;
  },
});

dash.calc('antes_despues', {
  title: 'Antes y después: cambios en pobreza',
  description: 'Cambio en puntos porcentuales entre mediciones, por distrito, con su ritmo anual y una lectura (umbral de 2 puntos).',
  inputs: ['indicadores'],
  fn: (indicadores) => {
    const get = (k) => { const r = indicadores.find((x) => x.clave === k); return r ? r.valor : null; };
    const label = { pgen: 'Pobreza general', pext: 'Pobreza extrema', ipm: 'IPM' };
    const terrs = [['area', 'Área de estudio'], ['la_pintada', 'La Pintada'], ['donoso', 'Donoso'], ['oth', 'Omar Torrijos Herrera']];
    const tramos = [['pgen', 2011, 2015, 'a'], ['pgen', 2015, 2023, 'b'], ['pext', 2011, 2015, 'a'], ['pext', 2015, 2023, 'b'], ['ipm', 2010, 2023, 'b']];
    const out = [];
    terrs.forEach(([slug, name]) => tramos.forEach(([ind, y0, y1, t]) => {
      const a = get(`${slug}_${ind}_${y0}`), d = get(`${slug}_${ind}_${y1}`);
      const c = a === null || d === null ? null : Math.round(10 * (d - a)) / 10;
      out.push({ clave: `${slug}_${ind}_${t}`, territorio: name, indicador: label[ind], periodo: `${y0}→${y1}`, antes: a, despues: d, cambio: c,
        cambio_anual: c === null ? null : Math.round(100 * c / (y1 - y0)) / 100,
        veredicto: c === null ? 'Sin dato' : c <= -2 ? 'Mejora' : c >= 2 ? 'Deterioro' : 'Sin cambio' });
    }));
    return out;
  },
});

dash.calc('lab_anual', {
  title: 'Indicadores laborales por año y provincia',
  description: 'Desempleo, informalidad y ocupados por rama para Coclé, Colón, ambas juntas y el país.',
  inputs: ['laboral_provincias', 'informalidad', 'laboral_area'],
  fn: (laboral_provincias, informalidad, laboral_area) => {
    const terrs = [['cocle', 'Coclé'], ['colon', 'Colón'], ['cocle_colon', 'Coclé + Colón'], ['panama', 'Panamá (total)']];
    const parts = { cocle: ['Coclé'], colon: ['Colón'], cocle_colon: ['Coclé', 'Colón'], panama: ['Panamá (total)'] };
    const out = [];
    for (let y = 2013; y <= 2026; y++) {
      terrs.forEach(([slug, name]) => {
        const ps = parts[slug];
        const lp = (serie) => { const rs = laboral_provincias.filter((r) => r.serie === serie && +r.anio === y && ps.includes(r.territorio)); return rs.length === ps.length ? rs.reduce((a, r) => a + +r.valor, 0) : null; };
        const inf = informalidad.filter((r) => r.sexo === 'Total' && +r.anio === y && ps.includes(r.territorio));
        const rama = (item) => { const rs = laboral_area.filter((r) => r.categoria === 'Rama de actividad' && r.area === 'Total' && r.serie === 'Ocupados' && +r.anio === y && r.item === item && ps.includes(r.provincia)); return rs.length === ps.length ? rs.reduce((a, r) => a + +r.valor, 0) : null; };
        const pea = lp('PEA'), des = lp('Desocupados'), ocu = lp('Ocupados');
        const infOk = inf.length === ps.length;
        const o = { clave: `${slug}_${y}`, territorio: name, anio: y, pea, ocupados: ocu, desocupados: des,
          tasa_desempleo: pea && des !== null ? Math.round(1000 * des / pea) / 10 : null,
          pct_informal: infOk ? Math.round(1000 * inf.reduce((a, r) => a + +r.informales, 0) / inf.reduce((a, r) => a + +r.ocupados_no_agricolas, 0)) / 10 : null,
          ocup_mineria: slug === 'panama' ? null : rama('Explotación de minas y canteras'),
          ocup_agro: slug === 'panama' ? null : rama('Agricultura, ganadería, caza y silvicultura'),
          ocup_construccion: slug === 'panama' ? null : rama('Construcción') };
        if (Object.keys(o).slice(3).some((k) => o[k] !== null)) out.push(o);
      });
    }
    return out;
  },
});

dash.calc('periodos_lab', {
  title: 'Empleo: promedios por etapa de la mina',
  description: 'Promedio anual antes (2015–2018, o 2017–2018 por rama), en operación (2019–2023) y paralizada (2024–2026), con sus cambios.',
  inputs: ['lab_anual'],
  fn: (lab_anual) => {
    const inds = [['tasa_desempleo', 'Tasa de desempleo (%)', 'pp'], ['pct_informal', 'Informalidad no agrícola (%)', 'pp'], ['ocup_mineria', 'Ocupados en minas y canteras', '%'], ['ocup_construccion', 'Ocupados en construcción', '%'], ['ocup_agro', 'Ocupados en agro', '%']];
    const terrs = [['cocle_colon', 'Coclé + Colón'], ['colon', 'Colón'], ['cocle', 'Coclé'], ['panama', 'Panamá (total)']];
    const avg = (rs, k, y0, y1) => { const v = rs.filter((r) => r.anio >= y0 && r.anio <= y1 && r[k] !== null).map((r) => r[k]); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const out = [];
    terrs.forEach(([slug, name]) => {
      const rs = lab_anual.filter((r) => r.territorio === name);
      inds.forEach(([k, lbl, u]) => {
        const a = avg(rs, k, 2015, 2018), o = avg(rs, k, 2019, 2023), p = avg(rs, k, 2024, 2026);
        if (a === null && o === null) return;
        const ch = (x, y) => (x === null || y === null ? null : u === 'pp' ? Math.round(10 * (y - x)) / 10 : Math.round(1000 * (y - x) / x) / 10);
        const rd = (v) => (v === null ? null : u === 'pp' ? Math.round(10 * v) / 10 : Math.round(v));
        out.push({ clave: `${slug}_${k}`, territorio: name, indicador: lbl, unidad: u, antes: rd(a), operacion: rd(o), post: rd(p), cambio_op: ch(a, o), cambio_post: ch(o, p) });
      });
    });
    return out;
  },
});

dash.calc('servicios', {
  title: 'Servicios por distrito',
  description: 'Escuelas y matrícula 2026, instalaciones de salud 2024 y beneficiarios MIDES 2024, por distrito y total.',
  inputs: ['escuelas', 'salud', 'corregimientos'],
  fn: (escuelas, salud, corregimientos) => {
    const ds = ['La Pintada', 'Donoso', 'Omar Torrijos Herrera', 'Área de estudio'];
    return ds.map((d) => {
      const f = (r) => d === 'Área de estudio' || r.distrito === d;
      const es = escuelas.filter(f), sa = salud.filter(f), co = corregimientos.filter(f);
      const pop = co.reduce((a, r) => a + +r.poblacion_2023, 0);
      const s = (k) => es.reduce((a, r) => a + (+r[k] || 0), 0);
      const mides = co.reduce((a, r) => a + (+r.mides_2024 || 0), 0);
      const func = sa.filter((r) => r.funciona === '1').length;
      return { distrito: d, poblacion_2023: pop, escuelas: es.length, matricula: s('total'), preescolar: s('preescolar'), primaria: s('primaria'), premedia: s('premedia'), media: s('media'),
        matricula_x1000: Math.round(10000 * s('total') / pop) / 10, salud_total: sa.length, salud_funcionan: func, salud_no_funcionan: sa.length - func,
        mides, mides_x100: Math.round(1000 * mides / pop) / 10 };
    });
  },
});

