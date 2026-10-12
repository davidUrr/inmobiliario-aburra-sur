/* Tablero 1 · Observatorio sectorial inmobiliario (rediseño de los paneles del Tablero Lonja para Aburrá Sur). */
(function () {
  const { D, MUNI, NOMBRE, GEO, estado, t, colorMunicipio, fmt, est, grafico, baseEjes, ejeCat, ejeVal, leyenda,
    tooltipFila, $, $$, esc, card, kpi, filtroMunicipio, descargarCSV } = App;

  const F = D.meta.fuentes;
  const sel = () => estado.municipio === "todos" ? MUNI.map(m => m.cod) : [estado.municipio];
  const anioIGAC = { valor: Math.max(...D.igac.anual.filter(a => a.transacciones).map(a => a.anio)) };
  const aniosIGAC = [...new Set(D.igac.anual.filter(a => a.transacciones).map(a => a.anio))].sort();
  const aniosDin = [...new Set(D.dinamica.map(d => d.anio))].sort();
  const SECTOR_CORTO = {
    "Inmobiliaria: bienes propios o arrendados": "Inmobiliaria con bienes propios o arrendados",
    "Inmobiliaria: a cambio de retribución o por contrata": "Inmobiliaria por retribución o contrata",
    "Construcción de edificios": "Construcción de edificios",
    "Obras civiles y especializadas": "Obras civiles y especializadas",
    "Otras actividades": "Otras actividades relacionadas",
  };
  const SECTORES = Object.keys(SECTOR_CORTO);
  const TAMANOS = ["Micro", "Pequeña", "Mediana", "Grande"];
  const NIVELES = ["Deficiente", "Regular", "Buena", "Excelente"];

  // año de referencia EMIS: último con información de al menos la mitad de las empresas (regla del tablero UdeM)
  const aniosEMIS = [...new Set(D.empresas.flatMap(e => Object.keys(e.anios)))].sort();
  // registro financiero utilizable: con ingresos y sin marca de atípico (ver ETL)
  const A = (e, a) => { const x = e.anios[a]; return x && x.ingresos != null && !x.atipico ? x : undefined; };
  // variación con panel balanceado: solo empresas con dato en ambos años
  function panel(emp, a, campo = "ingresos") {
    const p = emp.filter(e => A(e, a)?.[campo] != null && A(e, +a - 1)?.[campo] != null);
    return { act: est.suma(p.map(e => A(e, a)[campo])), prev: est.suma(p.map(e => A(e, +a - 1)[campo])), n: p.length };
  }
  const conteoEMIS = Object.fromEntries(aniosEMIS.map(a => [a, D.empresas.filter(e => A(e, a)).length]));
  const maxConteo = Math.max(...Object.values(conteoEMIS));
  let anioFin = aniosEMIS.filter(a => conteoEMIS[a] >= maxConteo / 2).pop();

  // ------------------------------------------------------------ agregados
  function igacAnio(cods, anio) {
    const f = D.igac.anual.filter(a => cods.includes(a.cod) && a.anio === anio);
    return { transacciones: est.suma(f.map(a => a.transacciones)), valor: est.suma(f.map(a => a.valor_mm)),
      nuevos: est.suma(f.map(a => a.predios_nuevos)) };
  }
  function poblacion(cods) { return est.suma(cods.map(c => GEO[c].poblacion)); }
  function empresasDe(cods) { return D.empresas.filter(e => cods.includes(e.cod)); }
  function rues(filtro = () => true) { return est.suma(D.rues.filter(filtro).map(r => r.n)); }
  const anioRenovMax = Math.max(...D.rues.map(r => r.ultimo_renovado || 0));

  function selectorAnio(id, anios, valor) {
    return `<label class="filtro"><span>Año</span><select class="select" id="${id}">
      ${anios.map(a => `<option ${String(a) === String(valor) ? "selected" : ""}>${a}</option>`).join("")}</select></label>`;
  }
  function cabecera(vista, titulo, texto, filtrosHtml = "") {
    vista.insertAdjacentHTML("beforeend", `<div class="seccion-titulo"><div><h2>${titulo}</h2><p>${texto}</p></div></div>
      <div class="filtros">${filtrosHtml}</div>`);
  }

  // ============================================================ RESUMEN
  function resumen(vista) {
    const fm = filtroMunicipio(() => App.rerender());
    cabecera(vista, "Panorama del sector inmobiliario",
      "Mercado de inmuebles, tejido empresarial y desempeño financiero de las empresas del sector en la jurisdicción de la Cámara.",
      fm.html + selectorAnio("anioRes", aniosIGAC, anioIGAC.valor));
    const cods = sel(), anio = anioIGAC.valor;
    const act = igacAnio(cods, anio), prev = igacAnio(cods, anio - 1);
    const emp = empresasDe(cods);
    const ingA = est.suma(emp.map(e => A(e, anioFin)?.ingresos));
    const pan = panel(emp, anioFin);
    const activas = rues(), renovadas = rues(r => r.ultimo_renovado === anioRenovMax);
    const nombreSel = estado.municipio === "todos" ? "Aburrá Sur" : NOMBRE[estado.municipio];

    vista.insertAdjacentHTML("beforeend", `<div class="grid">
      ${kpi({ etq: `Transacciones inmobiliarias ${anio}`, valor: fmt.n(act.transacciones), contexto: `${nombreSel} · ${fmt.delta(act.transacciones, prev.transacciones)}` })}
      ${kpi({ etq: `Valor transado ${anio}`, valor: fmt.cop(act.valor), contexto: `${nombreSel} · ${fmt.delta(act.valor, prev.valor)}` })}
      ${kpi({ etq: "Empresas activas del sector", valor: fmt.n(activas), contexto: `Registro de la Cámara · ${fmt.pct(renovadas / activas * 100, 0)} renovó en ${anioRenovMax}` })}
      ${kpi({ etq: `Ingresos operacionales ${anioFin}`, valor: fmt.cop(ingA), contexto: `${emp.filter(e => A(e, anioFin)).length} empresas · ${fmt.delta(pan.act, pan.prev, `mismas ${pan.n} empresas que en ${anioFin - 1}`)}` })}
      ${card({ id: "mapa", titulo: `Transacciones por cada 1.000 habitantes, ${anio}`, sub: "Haz clic en un municipio para filtrar el tablero. Medellín se muestra como referencia.", fuente: `${F.igac}; ${F.mapa}`, cls: "c7", alto: "alto" })}
      ${card({ id: "msj", titulo: "Mensajes clave", sub: "Lectura automática a partir de los datos filtrados", cls: "c5", cuerpo: `<ul class="mensajes" id="mensajes"></ul>` })}
      ${card({ id: "tabla", titulo: "Comparativo municipal", sub: `Año ${anio} para mercado inmobiliario; ${anioFin} para empresas`, fuente: `${F.igac}; ${F.emis}; ${F.mapa}`, cls: "c12",
        acciones: `<button class="btn sec no-print" id="csvMun">Descargar CSV</button>`, cuerpo: `<div class="tabla-wrap" id="tablaMun"></div>` })}
    </div>`);
    fm.enlazar(vista);
    $("#anioRes").addEventListener("change", e => { anioIGAC.valor = +e.target.value; App.rerender(); });

    // filas comparativas
    const filas = MUNI.map(m => {
      const a = igacAnio([m.cod], anio), e = empresasDe([m.cod]);
      return { cod: m.cod, municipio: m.nombre, poblacion: GEO[m.cod].poblacion, transacciones: a.transacciones,
        por_mil: a.transacciones / GEO[m.cod].poblacion * 1000, valor_mm: a.valor, promedio_mm: a.transacciones ? a.valor / a.transacciones : null,
        predios_nuevos: a.nuevos, empresas_emis: e.length, ingresos_mm: est.suma(e.map(x => A(x, anioFin)?.ingresos)) };
    });

    // mapa
    const k = t();
    const valores = filas.map(f => f.por_mil);
    grafico($("#mapa"), {
      tooltip: { ...baseEjes().tooltip, trigger: "item", formatter: p => {
        const f = filas.find(x => x.municipio === p.name);
        if (!f) return `<b>${p.name}</b><br>Referencia (fuera de la jurisdicción)`;
        return `<b>${f.municipio}</b><br>${tooltipFila(colorMunicipio(f.cod), "Por 1.000 hab.", fmt.n(f.por_mil, 1))}
          ${tooltipFila(k.ref, "Transacciones", fmt.n(f.transacciones))}${tooltipFila(k.ref, "Valor", fmt.cop(f.valor_mm))}`;
      } },
      visualMap: { type: "continuous", min: Math.floor(Math.min(...valores) / 10) * 10, max: Math.ceil(Math.max(...valores) / 10) * 10,
        inRange: { color: k.seq.slice(0, 5) }, left: 8, bottom: 8, itemHeight: 110, text: ["más", "menos"],
        textStyle: { color: k.text2, fontSize: 11 }, calculable: false, seriesIndex: 0 },
      series: [{
        type: "map", map: "aburra", roam: false, aspectScale: 0.97, center: [-75.615, 6.115], zoom: 1.85,
        selectedMode: false,
        label: { show: true, fontFamily: k.fontT, fontSize: 12, fontWeight: 700, color: k.text,
          textBorderColor: k.surface, textBorderWidth: 3, formatter: p => p.name },
        itemStyle: { borderColor: k.surface, borderWidth: 1.5, areaColor: k.grid },
        emphasis: { label: { color: k.text }, itemStyle: { areaColor: k.accent, opacity: 0.85 } },
        data: [
          ...filas.map(f => ({ name: f.municipio, value: f.por_mil,
            label: { offset: { "La Estrella": [-34, 4], "Sabaneta": [8, 10], "Envigado": [14, -6] }[f.municipio] || [0, 0] },
            itemStyle: estado.municipio !== "todos" && estado.municipio !== f.cod ? { opacity: 0.35 } : {} })),
          { name: "Medellín", value: null, itemStyle: { areaColor: k.grid, borderColor: k.border }, label: { color: k.text3 } },
        ],
      }],
    }).on("click", p => {
      const f = filas.find(x => x.municipio === p.name);
      if (f) { estado.municipio = estado.municipio === f.cod ? "todos" : f.cod; App.rerender(); }
    });

    // mensajes clave
    const lider = [...filas].sort((a, b) => b.transacciones - a.transacciones)[0];
    const intenso = [...filas].sort((a, b) => b.por_mil - a.por_mil)[0];
    const caro = [...filas].sort((a, b) => b.promedio_mm - a.promedio_mm)[0];
    const totAS = est.suma(filas.map(f => f.transacciones));
    const anual = MUNI.map(m => ({ m, a: igacAnio([m.cod], anio).transacciones, p: igacAnio([m.cod], anio - 1).transacciones }))
      .filter(x => x.p).map(x => ({ ...x, v: x.a / x.p - 1 })).sort((a, b) => b.v - a.v);
    const ing = D.empresas.map(e => A(e, anioFin)?.ingresos || 0).sort((a, b) => b - a);
    const top5 = est.suma(ing.slice(0, 5)) / est.suma(ing) * 100;
    const conScore = D.empresas.filter(e => A(e, anioFin)?.nivel);
    const sanas = conScore.filter(e => ["Buena", "Excelente"].includes(e.anios[anioFin].nivel)).length / conScore.length * 100;
    const msj = [
      ["1", `<strong>${lider.municipio}</strong> concentra el ${fmt.pct(lider.transacciones / totAS * 100, 0)} de las transacciones`, `${fmt.n(lider.transacciones)} de ${fmt.n(totAS)} transacciones registradas en ${anio}.`],
      ["2", `<strong>${intenso.municipio}</strong> tiene el mercado más activo por habitante`, `${fmt.n(intenso.por_mil, 0)} transacciones por cada 1.000 habitantes, frente a ${fmt.n(totAS / poblacion(MUNI.map(m => m.cod)) * 1000, 0)} en la jurisdicción.`],
      ["3", `El valor promedio por transacción más alto está en <strong>${caro.municipio}</strong>`, `${fmt.cop(caro.promedio_mm)} por transacción en ${anio}.`],
      anual.length ? ["4", `Mayor variación anual: <strong>${anual[0].m.nombre}</strong> (${anual[0].v >= 0 ? "+" : ""}${fmt.pct(anual[0].v * 100, 1)})`, `Menor: ${anual[anual.length - 1].m.nombre} (${anual[anual.length - 1].v >= 0 ? "+" : ""}${fmt.pct(anual[anual.length - 1].v * 100, 1)}) frente a ${anio - 1}.`] : null,
      ["5", `Las 5 empresas más grandes generan el <strong>${fmt.pct(top5, 0)}</strong> de los ingresos`, `Sobre ${conteoEMIS[anioFin]} empresas con estados financieros en ${anioFin}.`],
      ["6", `<strong>${fmt.pct(sanas, 0)}</strong> de las empresas tiene salud financiera buena o excelente`, `Índice de salud 0–100 (rentabilidad, liquidez, endeudamiento y margen), ${anioFin}.`],
    ].filter(Boolean);
    $("#mensajes").innerHTML = msj.map(([i, a, b]) => `<li><span class="ico">${i}</span><div>${a}<p>${b}</p></div></li>`).join("");

    // tabla
    const cuerpo = filas.map(f => `<tr class="click ${estado.municipio === f.cod ? "sel" : ""}" data-cod="${f.cod}">
      <td><span class="swatch" style="background:${colorMunicipio(f.cod)}"></span>${f.municipio}</td>
      <td class="n">${fmt.n(f.poblacion)}</td><td class="n">${fmt.n(f.transacciones)}</td><td class="n">${fmt.n(f.por_mil, 1)}</td>
      <td class="n">${fmt.cop(f.valor_mm)}</td><td class="n">${fmt.cop(f.promedio_mm)}</td><td class="n">${fmt.n(f.predios_nuevos)}</td>
      <td class="n">${fmt.n(f.empresas_emis)}</td><td class="n">${fmt.cop(f.ingresos_mm)}</td></tr>`).join("");
    $("#tablaMun").innerHTML = `<table class="tabla"><thead><tr><th>Municipio</th><th class="n">Población (CNPV 2018)</th>
      <th class="n">Transacciones</th><th class="n">Por 1.000 hab.</th><th class="n">Valor transado</th><th class="n">Valor promedio</th>
      <th class="n">Folios nuevos</th><th class="n">Empresas con EE. FF.</th><th class="n">Ingresos ${anioFin}</th></tr></thead><tbody>${cuerpo}</tbody></table>`;
    $$("#tablaMun tr[data-cod]").forEach(tr => tr.addEventListener("click", () => {
      estado.municipio = estado.municipio === tr.dataset.cod ? "todos" : tr.dataset.cod; App.rerender();
    }));
    $("#csvMun").addEventListener("click", () => descargarCSV(`comparativo_municipal_${anio}.csv`, filas.map(({ cod, ...f }) => f)));
  }

  // ============================================================ MERCADO
  function serieMunicipios(campo, { conRef = false, enfasis = true } = {}) {
    const k = t(), elegido = estado.municipio;
    const lista = [...MUNI.map(m => m.cod), ...(conRef ? D.meta.contexto.map(c => c.cod) : [])];
    return lista.map(cod => {
      const ref = !MUNI.find(m => m.cod === cod);
      const atenuado = enfasis && elegido !== "todos" && elegido !== cod && !ref;
      return {
        name: NOMBRE[cod], type: "line", smooth: false, symbol: "circle", symbolSize: atenuado ? 0 : 7, showSymbol: !atenuado,
        lineStyle: { width: atenuado ? 1.5 : 2, type: ref ? "dashed" : "solid" },
        itemStyle: { color: atenuado ? k.border : ref ? k.ref : colorMunicipio(cod), borderColor: k.surface, borderWidth: 2 },
        z: atenuado ? 1 : 3,
        data: aniosDin.map(a => D.dinamica.find(d => d.cod === cod && d.anio === a && d.zona === "Total")?.[campo] ?? null),
      };
    });
  }
  function tooltipLineas(formato) {
    return ps => `<b>${ps[0].axisValue}</b>` + ps.filter(p => p.value != null)
      .sort((a, b) => b.value - a.value).map(p => tooltipFila(p.color, p.seriesName, formato(p.value))).join("");
  }
  function mercado(vista) {
    const fm = filtroMunicipio(() => App.rerender());
    cabecera(vista, "Mercado inmobiliario",
      "Transacciones, intensidad del mercado, valores y composición de actos jurídicos sobre inmuebles en cada municipio.",
      fm.html + selectorAnio("anioMer", aniosIGAC, anioIGAC.valor));
    const anio = anioIGAC.valor, k = t();
    const leyMun = (ref) => leyenda([...MUNI.map(m => ({ nombre: m.nombre, color: colorMunicipio(m.cod), linea: true })),
      ...(ref ? [{ nombre: "Medellín (referencia)", color: k.ref, linea: true, ref: true }] : [])]);
    vista.insertAdjacentHTML("beforeend", `<div class="grid">
      ${card({ id: "gTrans", titulo: "Transacciones inmobiliarias por año", sub: `Número de transacciones, ${aniosDin[0]}–${aniosDin.at(-1)}`, fuente: F.dinamica, cls: "c6",
        cuerpo: `<div class="chart" id="gTrans" role="img" aria-label="Transacciones por año"></div>${leyMun(false)}` })}
      ${card({ id: "gInt", titulo: "Índice de intensidad de la dinámica inmobiliaria", sub: `Nivel básico del índice IGAC; más alto = mercado más activo respecto a su parque de inmuebles. Referencia Medellín ${aniosDin.at(-1)}: ${fmt.n(D.dinamica.find(d => d.cod === "05001" && d.anio === aniosDin.at(-1) && d.zona === "Total")?.intensidad, 3)}`, fuente: F.dinamica, cls: "c6",
        cuerpo: `<div class="chart" id="gInt" role="img" aria-label="Índice de intensidad"></div>${leyMun(false)}` })}
      ${card({ id: "gProm", titulo: `Valor promedio por transacción, ${anio}`, sub: "Millones de pesos por transacción registrada con valor", fuente: F.igac, cls: "c6" })}
      ${card({ id: "gNuevos", titulo: "Folios de matrícula nuevos por año", sub: "Aproximación a la incorporación de nuevos predios (nueva oferta)", fuente: F.igac, cls: "c6",
        cuerpo: `<div class="chart" id="gNuevos" role="img" aria-label="Folios nuevos"></div>${leyMun(false).replaceAll("linea", "")}` })}
      ${card({ id: "gActos", titulo: `Composición de las transacciones por tipo de acto, ${anio}`, sub: "Participación de cada acto jurídico en el total del municipio", fuente: F.igac, cls: "c12", alto: "" })}
    </div>`);
    fm.enlazar(vista);
    $("#anioMer").addEventListener("change", e => { anioIGAC.valor = +e.target.value; App.rerender(); });

    grafico($("#gTrans"), { ...baseEjes(), tooltip: { ...baseEjes().tooltip, formatter: tooltipLineas(v => fmt.n(v)) },
      xAxis: ejeCat(aniosDin), yAxis: ejeVal({ axisLabel: { color: k.text3, formatter: v => fmt.n(v / 1000) + " mil" } }),
      series: serieMunicipios("transacciones") });
    grafico($("#gInt"), { ...baseEjes(), tooltip: { ...baseEjes().tooltip, formatter: tooltipLineas(v => fmt.n(v, 3)) },
      xAxis: ejeCat(aniosDin), yAxis: ejeVal(), series: serieMunicipios("intensidad") });

    const filas = MUNI.map(m => { const a = igacAnio([m.cod], anio); return { m, v: a.transacciones ? a.valor / a.transacciones : 0 }; })
      .sort((a, b) => a.v - b.v);
    grafico($("#gProm"), { ...baseEjes(), tooltip: { ...baseEjes().tooltip, trigger: "item", formatter: p => tooltipFila(p.color, p.name, fmt.cop(p.value)) },
      grid: { left: 8, right: 70, top: 8, bottom: 8, containLabel: true },
      xAxis: ejeVal({ axisLabel: { show: false } }), yAxis: ejeCat(filas.map(f => f.m.nombre)),
      series: [{ type: "bar", barWidth: 18, data: filas.map(f => ({ value: f.v,
        itemStyle: { color: estado.municipio === "todos" || estado.municipio === f.m.cod ? colorMunicipio(f.m.cod) : k.border, borderRadius: [0, 4, 4, 0] } })),
        label: { show: true, position: "right", color: k.text, fontSize: 11, formatter: p => fmt.n(p.value, 0) + " M" } }] });

    const aniosN = [...new Set(D.igac.anual.map(a => a.anio))].sort();
    grafico($("#gNuevos"), { ...baseEjes(), tooltip: { ...baseEjes().tooltip, axisPointer: { type: "shadow" },
      formatter: ps => `<b>${ps[0].axisValue}</b>` + ps.filter(p => p.value).map(p => tooltipFila(p.color, p.seriesName, fmt.n(p.value))).join("") },
      xAxis: ejeCat(aniosN), yAxis: ejeVal(),
      series: sel().map(cod => ({ name: NOMBRE[cod], type: "bar", stack: "n", barWidth: "60%",
        itemStyle: { color: colorMunicipio(cod), borderColor: k.surface, borderWidth: 1 },
        data: aniosN.map(a => D.igac.anual.find(x => x.cod === cod && x.anio === a)?.predios_nuevos || 0) })) });

    // actos: 100 % apilado por municipio
    const actos = [...new Set(D.igac.actos.map(a => a.acto))];
    const orden = actos.filter(a => a !== "Otros actos").sort((a, b) =>
      est.suma(D.igac.actos.filter(x => x.acto === b).map(x => x.transacciones)) - est.suma(D.igac.actos.filter(x => x.acto === a).map(x => x.transacciones)));
    orden.push("Otros actos");
    const mun = sel();
    const tot = Object.fromEntries(mun.map(c => [c, est.suma(D.igac.actos.filter(x => x.cod === c && x.anio === anio).map(x => x.transacciones))]));
    const corto = s => s.replace("Transferencia de dominio a título de ", "Transferencia: ").replace(/\s+/g, " ").replace(/^(.{46}).+$/, "$1…");
    grafico($("#gActos"), { ...baseEjes(),
      tooltip: { ...baseEjes().tooltip, axisPointer: { type: "shadow" }, formatter: ps => `<b>${ps[0].axisValue}</b>` +
        ps.map(p => tooltipFila(p.color, corto(p.seriesName), fmt.pct(p.value, 1))).join("") },
      legend: { bottom: 0, left: 0, icon: "roundRect", itemWidth: 10, itemHeight: 10, textStyle: { color: k.text2, fontSize: 11 }, formatter: corto },
      grid: { left: 8, right: 16, top: 8, bottom: 64, containLabel: true },
      xAxis: ejeVal({ max: 100, axisLabel: { color: k.text3, formatter: v => v + " %" } }), yAxis: ejeCat(mun.map(c => NOMBRE[c]), { inverse: true }),
      series: orden.map((a, i) => ({ name: a, type: "bar", stack: "t", barWidth: 22,
        itemStyle: { color: a === "Otros actos" ? k.ref : k.series[i], borderColor: k.surface, borderWidth: 2 },
        label: { show: true, color: "#fff", fontSize: 10, fontWeight: 700, formatter: p => p.value >= 8 ? fmt.n(p.value, 0) + "%" : "" },
        data: mun.map(c => tot[c] ? (D.igac.actos.find(x => x.cod === c && x.anio === anio && x.acto === a)?.transacciones || 0) / tot[c] * 100 : 0) })) });
    $("#gActos").style.height = Math.max(220, 120 + mun.length * 40) + "px";
  }

  // ============================================================ TEJIDO EMPRESARIAL
  function tejido(vista) {
    cabecera(vista, "Tejido empresarial del sector",
      "Empresas con matrícula activa en la Cámara de Comercio Aburrá Sur en actividades inmobiliarias y conexas (registro mercantil).",
      `<div class="nota">El registro mercantil se consolida para toda la jurisdicción de la Cámara; por eso esta sección no se filtra por municipio.</div>`);
    const k = t();
    const activas = rues(), renovadas = rues(r => r.ultimo_renovado === anioRenovMax);
    const nuevasUlt = rues(r => r.anio_matricula === anioRenovMax), nuevasPrev = rues(r => r.anio_matricula === anioRenovMax - 1);
    const medGr = rues(r => ["Mediana", "Grande"].includes(r.tamano));
    vista.insertAdjacentHTML("beforeend", `<div class="grid">
      ${kpi({ etq: "Empresas activas", valor: fmt.n(activas), contexto: "Matrícula activa, sector inmobiliario y conexos" })}
      ${kpi({ etq: `Renovaron en ${anioRenovMax}`, valor: fmt.pct(renovadas / activas * 100, 0), contexto: `${fmt.n(activas - renovadas)} empresas con renovación pendiente o rezagada` })}
      ${kpi({ etq: `Matriculadas en ${anioRenovMax}`, valor: fmt.n(nuevasUlt), contexto: fmt.delta(nuevasUlt, nuevasPrev) })}
      ${kpi({ etq: "Medianas y grandes", valor: fmt.n(medGr), contexto: `${fmt.pct(medGr / activas * 100, 1)} del total; el resto son micro y pequeñas` })}
      ${card({ id: "gSector", titulo: "Empresas activas por segmento", sub: "Clasificación CIIU de la actividad principal", fuente: F.rues, cls: "c6" })}
      ${card({ id: "gTam", titulo: "Empresas activas por tamaño", sub: "Escala ordinal de micro a grande", fuente: F.rues, cls: "c6" })}
      ${card({ id: "gMat", titulo: "Año de matrícula de las empresas hoy activas", sub: "Cohortes que siguen vigentes; no incluye empresas canceladas", fuente: F.rues, cls: "c8" })}
      ${card({ id: "gTipo", titulo: "Tipo societario", sub: "Forma jurídica", fuente: F.rues, cls: "c4" })}
      ${card({ id: "gSup", titulo: "Supervivencia empresarial por segmento", sub: "% de empresas que siguen activas según años desde la matrícula · Antioquia", fuente: F.supervivencia, cls: "c6",
        cuerpo: `<div class="chart" id="gSup" role="img" aria-label="Supervivencia"></div>${leyenda(SECTORES.map((s, i) => ({ nombre: SECTOR_CORTO[s], color: k.series[i], linea: true })))}` })}
      ${card({ id: "gRen", titulo: "Último año de renovación de la matrícula", sub: "Empresas activas según el año en que renovaron por última vez", fuente: F.rues, cls: "c6" })}
    </div>`);

    const porSector = SECTORES.map(s => ({ s, n: rues(r => r.sector === s) })).sort((a, b) => a.n - b.n);
    const barH = (el, cats, vals, color, fmtV = v => fmt.n(v)) => grafico(el, { ...baseEjes(),
      tooltip: { ...baseEjes().tooltip, trigger: "item", formatter: p => tooltipFila(p.color, p.name, fmtV(p.value)) },
      grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
      xAxis: ejeVal({ axisLabel: { show: false } }), yAxis: ejeCat(cats, { axisLabel: { color: k.text2, fontSize: 11, width: 250, overflow: "truncate" } }),
      series: [{ type: "bar", barWidth: 18, data: vals.map((v, i) => ({ value: v, itemStyle: { color: Array.isArray(color) ? color[i] : color, borderRadius: [0, 4, 4, 0] } })),
        label: { show: true, position: "right", color: k.text, fontSize: 11, formatter: p => fmtV(p.value) } }] });
    barH($("#gSector"), porSector.map(x => SECTOR_CORTO[x.s]), porSector.map(x => x.n), k.series[0]);
    barH($("#gTam"), TAMANOS, TAMANOS.map(tm => rues(r => r.tamano === tm)), [k.seq[2], k.seq[3], k.seq[4], k.seq[5]]);
    const tipos = [...new Set(D.rues.map(r => r.tipo))].map(tp => ({ tp, n: rues(r => r.tipo === tp) })).sort((a, b) => a.n - b.n);
    barH($("#gTipo"), tipos.map(x => x.tp), tipos.map(x => x.n), k.series[0]);

    const anios = ["<2010", ...Array.from({ length: anioRenovMax - 2009 }, (_, i) => 2010 + i)];
    grafico($("#gMat"), { ...baseEjes(), tooltip: { ...baseEjes().tooltip, axisPointer: { type: "shadow" },
        formatter: ps => `<b>${ps[0].axisValue === "<2010" ? "Antes de 2010" : ps[0].axisValue}</b>` + tooltipFila(k.series[0], "Empresas", fmt.n(ps[0].value)) },
      xAxis: ejeCat(anios.map(String)), yAxis: ejeVal(),
      series: [{ type: "bar", barWidth: "62%", itemStyle: { color: k.series[0], borderRadius: [4, 4, 0, 0] },
        data: anios.map(a => ({ value: rues(r => r.anio_matricula === a), itemStyle: a === "<2010" ? { color: k.ref, borderRadius: [4, 4, 0, 0] } : undefined })),
        label: { show: true, position: "top", color: k.text2, fontSize: 10, formatter: p => p.dataIndex === anios.length - 1 || p.dataIndex === 0 ? fmt.n(p.value) : "" } }] });

    const anS = [...new Set(D.supervivencia.map(s => s.anios))].sort((a, b) => a - b);
    grafico($("#gSup"), { ...baseEjes(), tooltip: { ...baseEjes().tooltip, formatter: ps => `<b>Año ${ps[0].axisValue} desde la matrícula</b>` +
        ps.sort((a, b) => b.value - a.value).map(p => tooltipFila(p.color, SECTOR_CORTO[p.seriesName], fmt.pct(p.value, 1))).join("") },
      xAxis: ejeCat(anS.map(String), { name: "años", nameLocation: "end", nameTextStyle: { color: k.text3, fontSize: 11 } }),
      yAxis: ejeVal({ min: v => Math.floor(v.min / 10) * 10, axisLabel: { color: k.text3, formatter: v => v + " %" } }),
      series: SECTORES.map((s, i) => ({ name: s, type: "line", symbol: "circle", symbolSize: 6,
        itemStyle: { color: k.series[i], borderColor: k.surface, borderWidth: 2 }, lineStyle: { width: 2 },
        data: anS.map(a => { const f = D.supervivencia.find(x => x.sector === s && x.anios === a); return f && f.iniciales ? f.sobrevivientes / f.iniciales * 100 : null; }) })) });

    const ren = [...new Set(D.rues.map(r => r.ultimo_renovado).filter(Boolean))].sort().filter(a => a >= anioRenovMax - 10);
    grafico($("#gRen"), { ...baseEjes(), tooltip: { ...baseEjes().tooltip, axisPointer: { type: "shadow" },
        formatter: ps => `<b>${ps[0].axisValue}</b>` + tooltipFila(ps[0].color, "Empresas", fmt.n(ps[0].value)) },
      xAxis: ejeCat(["Antes", ...ren.map(String)]), yAxis: ejeVal({ type: "log", min: 1, axisLabel: { color: k.text3 } }),
      series: [{ type: "bar", barWidth: "60%",
        data: [{ value: rues(r => r.ultimo_renovado && r.ultimo_renovado < ren[0]), itemStyle: { color: k.ref } },
          ...ren.map(a => ({ value: rues(r => r.ultimo_renovado === a), itemStyle: { color: a === anioRenovMax ? k.series[0] : k.seq[2] } }))],
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        label: { show: true, position: "top", color: k.text2, fontSize: 10, formatter: p => fmt.n(p.value) } }] });
    $("#gRen").insertAdjacentHTML("afterend", `<p class="sub">Escala logarítmica para ver los años con pocas empresas.</p>`);
  }

  // ============================================================ FINANZAS
  function finanzas(vista) {
    const fm = filtroMunicipio(() => App.rerender());
    cabecera(vista, "Desempeño financiero de las empresas",
      "Estados financieros de las empresas inmobiliarias de la jurisdicción que reportan a Supersociedades. Millones de pesos.",
      fm.html + selectorAnio("anioFin", aniosEMIS, anioFin));
    const k = t(), cods = sel(), emp = empresasDe(cods), a = String(anioFin), ap = String(anioFin - 1);
    const conA = emp.filter(e => A(e, a));
    const ing = est.suma(conA.map(e => e.anios[a].ingresos)), pan = panel(emp, a);
    const margen = est.mediana(conA.map(e => e.anios[a].margen_neto));
    const perd = conA.filter(e => e.anios[a].utilidad < 0).length;
    const cuotas = conA.map(e => e.anios[a].ingresos / ing);
    const hhi = est.suma(cuotas.map(c => c * c)) * 10000;
    const hhiTxt = hhi < 1500 ? ["ok", "No concentrado"] : hhi < 2500 ? ["alerta", "Moderadamente concentrado"] : ["critico", "Altamente concentrado"];

    vista.insertAdjacentHTML("beforeend", `<div class="grid">
      ${kpi({ etq: `Ingresos operacionales ${a}`, valor: fmt.cop(ing), contexto: `${conA.length} empresas · ${fmt.delta(pan.act, pan.prev, `mismas ${pan.n} empresas que en ${ap}`)}` })}
      ${kpi({ etq: "Margen neto mediano", valor: fmt.pct(margen, 1), contexto: "La mitad de las empresas está por encima de este valor" })}
      ${kpi({ etq: "Empresas con pérdidas", valor: fmt.n(perd), contexto: `${fmt.pct(perd / Math.max(conA.length, 1) * 100, 0)} de las que reportaron en ${a}` })}
      ${kpi({ etq: "Concentración del mercado (IHH)", valor: fmt.n(hhi), contexto: `<span class="badge ${hhiTxt[0]}">${hhiTxt[0] === "ok" ? "●" : "▲"} ${hhiTxt[1]}</span>` })}
      ${card({ id: "gIng", titulo: "Ingresos operacionales agregados por año", sub: "Suma de las empresas de cada municipio", fuente: F.emis, cls: "c6",
        cuerpo: `<div class="chart" id="gIng" role="img" aria-label="Ingresos por año"></div>${leyenda(MUNI.map(m => ({ nombre: m.nombre, color: colorMunicipio(m.cod), linea: true })))}` })}
      ${card({ id: "gSalud", titulo: "Salud financiera de las empresas por año", sub: "Distribución del índice de salud (0–100) por nivel", fuente: `${F.emis}; índice del Tablero Lonja`, cls: "c6",
        cuerpo: `<div class="chart" id="gSalud" role="img" aria-label="Salud financiera"></div>${leyenda(NIVELES.map((n, i) => ({ nombre: n, color: k.seq[i + 2] })))}` })}
      ${card({ id: "gTop", titulo: `Las 10 empresas con más ingresos, ${a}`, sub: "Haz clic en una barra para abrir su radiografía · etiqueta = participación en los ingresos del grupo", fuente: F.emis, cls: "c6", alto: "alto" })}
      ${card({ id: "gDisp", titulo: `Tamaño frente a rentabilidad, ${a}`, sub: "Activos totales (escala logarítmica) y margen neto; cada punto es una empresa", fuente: F.emis, cls: "c6", alto: "alto",
        cuerpo: `<div class="chart alto" id="gDisp" role="img" aria-label="Dispersión"></div>${leyenda([{ nombre: estado.municipio === "todos" ? "Empresas de Aburrá Sur" : NOMBRE[estado.municipio], color: k.series[0] }, ...(estado.municipio === "todos" ? [] : [{ nombre: "Resto de la jurisdicción", color: k.border }])])}` })}
      ${card({ id: "tTam", titulo: `Indicadores medianos por tamaño de empresa, ${a}`, sub: "Medianas: robustas frente a valores extremos", fuente: F.emis, cls: "c12", cuerpo: `<div class="tabla-wrap" id="tTam"></div>` })}
    </div>`);
    fm.enlazar(vista);
    $("#anioFin").addEventListener("change", e => { anioFin = +e.target.value; App.rerender(); });

    grafico($("#gIng"), { ...baseEjes(), tooltip: { ...baseEjes().tooltip, formatter: tooltipLineas(v => fmt.cop(v)) },
      xAxis: ejeCat(aniosEMIS), yAxis: ejeVal({ axisLabel: { color: k.text3, formatter: v => fmt.copCorto(v) } }),
      series: MUNI.map(m => {
        const at = estado.municipio !== "todos" && estado.municipio !== m.cod;
        return { name: m.nombre, type: "line", symbol: "circle", symbolSize: at ? 0 : 7, lineStyle: { width: at ? 1.5 : 2 }, z: at ? 1 : 3,
          itemStyle: { color: at ? k.border : colorMunicipio(m.cod), borderColor: k.surface, borderWidth: 2 },
          data: aniosEMIS.map(y => est.suma(empresasDe([m.cod]).map(e => A(e, y)?.ingresos))) };
      }) });

    grafico($("#gSalud"), { ...baseEjes(), tooltip: { ...baseEjes().tooltip, axisPointer: { type: "shadow" },
        formatter: ps => `<b>${ps[0].axisValue}</b>` + [...ps].reverse().map(p => tooltipFila(p.color, p.seriesName, fmt.pct(p.value, 0))).join("") },
      xAxis: ejeCat(aniosEMIS), yAxis: ejeVal({ max: 100, axisLabel: { color: k.text3, formatter: v => v + " %" } }),
      series: NIVELES.map((n, i) => ({ name: n, type: "bar", stack: "s", barWidth: "55%",
        itemStyle: { color: k.seq[i + 2], borderColor: k.surface, borderWidth: 2 },
        label: { show: true, color: i >= 2 ? "#fff" : k.text, fontSize: 10, fontWeight: 700, formatter: p => p.value >= 9 ? fmt.n(p.value, 0) + "%" : "" },
        data: aniosEMIS.map(y => { const c = emp.filter(e => A(e, y)?.nivel); return c.length ? c.filter(e => e.anios[y].nivel === n).length / c.length * 100 : 0; }) })) });

    const top = [...conA].sort((x, y) => y.anios[a].ingresos - x.anios[a].ingresos).slice(0, 10).reverse();
    const corto = s => s.replace(/ S\.?A\.?S\.?$/i, "").replace(/Sociedad Por Acciones Simplificada/i, "SAS");
    grafico($("#gTop"), { ...baseEjes(), tooltip: { ...baseEjes().tooltip, trigger: "item",
        formatter: p => `<b>${esc(top[p.dataIndex].nombre)}</b><br>${tooltipFila(p.color, "Ingresos", fmt.cop(p.value))}${tooltipFila(p.color, "Municipio", NOMBRE[top[p.dataIndex].cod])}` },
      grid: { left: 8, right: 60, top: 8, bottom: 8, containLabel: true },
      xAxis: ejeVal({ axisLabel: { show: false } }),
      yAxis: ejeCat(top.map(e => corto(e.nombre)), { axisLabel: { color: k.text2, fontSize: 11, width: 190, overflow: "truncate" } }),
      series: [{ type: "bar", barWidth: 16, cursor: "pointer",
        data: top.map(e => ({ value: e.anios[a].ingresos, itemStyle: { color: colorMunicipio(e.cod), borderRadius: [0, 4, 4, 0] } })),
        label: { show: true, position: "right", color: k.text, fontSize: 11, formatter: p => fmt.pct(p.value / ing * 100, 1) } }] })
      .on("click", p => { App.estado.empresa = top[p.dataIndex].nit; App.ir("radiografia", "ficha"); });
    $("#gTop").insertAdjacentHTML("afterend", leyenda(MUNI.map(m => ({ nombre: m.nombre, color: colorMunicipio(m.cod) }))));

    const todos = D.empresas.filter(e => A(e, a)?.activos > 0 && A(e, a)?.margen_neto != null);
    const p = v => Math.max(-100, Math.min(100, v));
    grafico($("#gDisp"), { ...baseEjes(),
      tooltip: { ...baseEjes().tooltip, trigger: "item", formatter: q => { const e = q.data.e;
        return `<b>${esc(e.nombre)}</b><br>${tooltipFila(q.color, "Activos", fmt.cop(e.anios[a].activos))}${tooltipFila(q.color, "Margen neto", fmt.pct(e.anios[a].margen_neto, 1))}${tooltipFila(q.color, "Municipio", NOMBRE[e.cod])}`; } },
      grid: { left: 8, right: 16, top: 16, bottom: 28, containLabel: true },
      xAxis: ejeVal({ type: "log", name: "Activos (millones, log)", nameLocation: "middle", nameGap: 26, nameTextStyle: { color: k.text3, fontSize: 11 },
        axisLabel: { color: k.text3, formatter: v => fmt.copCorto(v) } }),
      yAxis: ejeVal({ name: "Margen neto %", nameTextStyle: { color: k.text3, fontSize: 11, align: "left" }, axisLabel: { color: k.text3, formatter: v => v + "%" } }),
      series: [false, true].map(enfoque => ({ type: "scatter", cursor: "pointer", z: enfoque ? 3 : 1, symbolSize: 10,
        itemStyle: { color: enfoque ? k.series[0] : k.border, borderColor: k.surface, borderWidth: 1.5, opacity: enfoque ? 0.9 : 1 },
        data: todos.filter(e => (estado.municipio === "todos" || e.cod === estado.municipio) === enfoque)
          .map(e => ({ value: [e.anios[a].activos, p(e.anios[a].margen_neto)], e })) })) })
      .on("click", q => { App.estado.empresa = q.data.e.nit; App.ir("radiografia", "ficha"); });

    const filas = TAMANOS.map(tm => { const g = conA.filter(e => e.tamano === tm), m = c => est.mediana(g.map(e => e.anios[a][c]));
      return { tm, n: g.length, ing: m("ingresos"), mn: m("margen_neto"), roa: m("roa"), roe: m("roe"), deuda: m("deuda_activos"), liq: m("liquidez"), score: m("score") }; });
    $("#tTam").innerHTML = `<table class="tabla"><thead><tr><th>Tamaño</th><th class="n">Empresas</th><th class="n">Ingresos</th><th class="n">Margen neto</th>
      <th class="n">ROA</th><th class="n">ROE</th><th class="n">Deuda / activos</th><th class="n">Liquidez (x)</th><th class="n">Índice de salud</th></tr></thead><tbody>
      ${filas.map(f => `<tr><td>${f.tm}</td><td class="n">${fmt.n(f.n)}</td><td class="n">${fmt.cop(f.ing)}</td><td class="n">${fmt.pct(f.mn)}</td><td class="n">${fmt.pct(f.roa)}</td>
        <td class="n">${fmt.pct(f.roe)}</td><td class="n">${fmt.pct(f.deuda)}</td><td class="n">${fmt.n(f.liq, 2)}</td><td class="n">${fmt.n(f.score, 0)}</td></tr>`).join("")}
      </tbody></table>`;
  }

  // ============================================================ METODOLOGÍA
  function metodologia(vista) {
    cabecera(vista, "Metodología, fuentes y capacidades",
      "Cómo se construye el tablero, qué cubre cada fuente y qué capacidades demuestra para una implementación completa.");
    const cob = [
      ["Dinámica inmobiliaria", F.dinamica, `${aniosDin[0]}–${aniosDin.at(-1)}`, "Municipio", "Anual"],
      ["Transacciones y valores", F.igac, `${aniosIGAC[0]}–${aniosIGAC.at(-1)}`, "Municipio · acto · zona", "Anual"],
      ["Registro mercantil", F.rues, `Corte ${anioRenovMax}`, "Jurisdicción de la Cámara", "Mensual (posible)"],
      ["Supervivencia", F.supervivencia, "Cohortes", "Departamento", "Anual"],
      ["Estados financieros", F.emis, `${aniosEMIS[0]}–${aniosEMIS.at(-1)}`, "Empresa (NIT)", "Anual"],
      ["Cartografía y población", F.mapa, "2018", "Municipio", "Censal"],
    ];
    vista.insertAdjacentHTML("beforeend", `<div class="grid">
      ${card({ id: "flujo", titulo: "Flujo de datos", cls: "c12", cuerpo: `<div class="flujo">
        <div class="paso"><b>1 · Fuentes</b>IGAC, RUES, Supersociedades/EMIS, DANE. Archivos oficiales descargados o consultas a API.</div>
        <div class="paso"><b>2 · ETL</b>El mismo proceso en Python del Tablero Lonja normaliza códigos DIVIPOLA, CIIU, NIT y unidades.</div>
        <div class="paso"><b>3 · Modelo</b>Base SQLite con tablas de staging; reglas de calidad y bitácora de cargas.</div>
        <div class="paso"><b>4 · Exportación</b><code>etl/exportar_datos.py</code> filtra la jurisdicción y calcula cuotas, índice de salud e IHH.</div>
        <div class="paso"><b>5 · Tableros</b>Web (este demostrador) o Power BI con el tema CCAS de <code>marca/powerbi</code>.</div></div>` })}
      ${card({ id: "cob", titulo: "Cobertura de las fuentes", cls: "c12", cuerpo: `<div class="tabla-wrap"><table class="tabla"><thead><tr><th>Componente</th><th>Fuente</th><th>Periodo</th><th>Nivel</th><th>Actualización</th></tr></thead>
        <tbody>${cob.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` })}
      ${card({ id: "cal", titulo: "Notas de calidad", cls: "c6", cuerpo: `<ul class="capacidades" style="columns:1">
        <li>Los códigos de Caldas (Antioquia) mal asignados a Caldas (Boyacá) en la fuente financiera se corrigen en la exportación.</li>
        <li>El registro mercantil no trae municipio: se reporta para toda la jurisdicción de la Cámara (código RUES 55).</li>
        <li>El índice de dinámica usa el nivel «básico», el único con cobertura completa 2015–2023. En 2021 el número de inmuebles de algunos municipios cae de forma atípica en la fuente.</li>
        <li>Los valores de transacciones solo existen desde 2021; los folios nuevos, desde 2015.</li>
        <li>Solo reportan estados financieros las sociedades obligadas ante Supersociedades: las cifras no representan a todas las microempresas.</li>
        <li>El índice de salud (0–100) reutiliza la fórmula del Tablero Lonja: rentabilidad 30, liquidez 25, endeudamiento 25 y margen 20.</li></ul>` })}
      ${card({ id: "cap", titulo: "Capacidades que demuestra el prototipo", cls: "c6", cuerpo: `<ul class="capacidades" style="columns:1">
        <li><b>Integración de fuentes</b> públicas y licenciadas en un solo modelo, con ETL reproducible.</li>
        <li><b>Enfoque territorial</b>: filtros por municipio, mapa interactivo y comparativos per cápita.</li>
        <li><b>Inteligencia empresarial</b>: ficha por NIT, comparación con pares y percentiles.</li>
        <li><b>Diagnóstico automático</b> con reglas explicables y ruta de servicios sugerida.</li>
        <li><b>Lectura guiada</b>: mensajes clave generados a partir de los datos.</li>
        <li><b>Identidad institucional</b> parametrizada: el mismo sistema sirve para web y Power BI.</li>
        <li><b>Exportación</b> de tablas a CSV e impresión de fichas en PDF.</li>
        <li><b>Accesibilidad</b>: paleta validada para daltonismo, modo oscuro y etiquetas con texto.</li></ul>` })}
    </div>`);
  }

  App.registrar("observatorio", {
    titulo: "Observatorio sectorial",
    secciones: [
      { id: "resumen", titulo: "Panorama", render: resumen },
      { id: "mercado", titulo: "Mercado inmobiliario", render: mercado },
      { id: "tejido", titulo: "Tejido empresarial", render: tejido },
      { id: "finanzas", titulo: "Desempeño financiero", render: finanzas },
      { id: "metodologia", titulo: "Metodología", render: metodologia },
    ],
  });
  App.anioFinanciero = () => anioFin;
})();
