// ---------- Cálculos nuevos: salud, acceso y escuelas ----------
dash.calc('acceso_salud', {
  title: 'Defunciones fuera de una instalación de salud, 2025',
  description: 'Porcentaje de las defunciones de 2025 ocurridas fuera de una instalación de salud y sin certificación médica.',
  inputs: ['defunciones_sitio'],
  fn: (defunciones_sitio) => defunciones_sitio.map((r) => ({
    territorio: r.territorio, nivel: r.nivel, defunciones: +r.defunciones, otro_lugar: +r.otro_lugar, sin_certificacion: +r.sin_certificacion,
    pct_fuera: +r.defunciones ? Math.round(1000 * +r.otro_lugar / +r.defunciones) / 10 : null,
    pct_sin_cert: +r.defunciones ? Math.round(1000 * +r.sin_certificacion / +r.defunciones) / 10 : null,
  })),
});

dash.calc('dispersion', {
  title: 'Población en lugares pequeños y dispersos',
  description: 'Por corregimiento (unidad del mapa) y por distrito: lugares poblados y % de la población que vive en lugares de menos de 100 habitantes.',
  inputs: ['lugares_poblados'],
  fn: (lugares_poblados) => {
    const agg = (rs) => { const pob = rs.reduce((a, r) => a + +r.poblacion, 0), peq = rs.filter((r) => +r.poblacion < 100).reduce((a, r) => a + +r.poblacion, 0); return { lugares: rs.length, poblacion: pob, pob_menos100: peq, pct_menos100: pob ? Math.round(1000 * peq / pob) / 10 : null }; };
    const out = [];
    [...new Set(lugares_poblados.map((r) => r.unidad))].forEach((u) => { const rs = lugares_poblados.filter((r) => r.unidad === u); out.push({ clave: u, nivel: 'Corregimiento', unidad: u, distrito: rs[0].distrito, ...agg(rs) }); });
    ['La Pintada', 'Donoso', 'Omar Torrijos Herrera'].forEach((d) => out.push({ clave: d, nivel: 'Distrito', unidad: null, distrito: d, ...agg(lugares_poblados.filter((r) => r.distrito === d)) }));
    out.push({ clave: 'Área de estudio', nivel: 'Total', unidad: null, distrito: null, ...agg(lugares_poblados) });
    return out;
  },
});

dash.calc('escuelas_oferta', {
  title: 'Escuelas y matrícula por nivel, 2026',
  description: 'Por distrito y total: escuelas, cuántas ofrecen premedia y media, y estudiantes en primaria, premedia y media.',
  inputs: ['escuelas'],
  fn: (escuelas) => ['La Pintada', 'Donoso', 'Omar Torrijos Herrera', 'Área de estudio'].map((d) => {
    const es = escuelas.filter((r) => d === 'Área de estudio' || r.distrito === d);
    const s = (k) => es.reduce((a, r) => a + (+r[k] || 0), 0);
    return { distrito: d, escuelas: es.length, con_premedia: es.filter((r) => +r.premedia > 0).length, con_media: es.filter((r) => +r.media > 0).length,
      primaria: s('primaria'), premedia: s('premedia'), media: s('media'), media_por_100_primaria: s('primaria') ? Math.round(1000 * s('media') / s('primaria')) / 10 : null };
  }),
});
