/* Tablero 2 · Radiografía empresarial: ficha por empresa, comparación con pares, diagnóstico y ranking.
   Rediseño del módulo "Inteligencia financiera de competidores" (tablero UdeM) y del panel de
   Inteligencia Competitiva (Tablero Lonja). */
(function () {
  const { D, MUNI, NOMBRE, estado, t, colorMunicipio, fmt, est, grafico, baseEjes, ejeCat, ejeVal, leyenda,
    tooltipFila, $, $$, esc, card, kpi, descargarCSV } = App;

  const F = D.meta.fuentes;
  const EMP = Object.fromEntries(D.empresas.map(e => [e.nit, e]));
  const ANIOS = [...new Set(D.empresas.flatMap(e => Object.keys(e.anios)))].sort();
  const SEG = { "Inmobiliaria: bienes propios o arrendados": "Bienes propios o arrendados",
    "Inmobiliaria: a cambio de retribución o por contrata": "Por retribución o contrata", "Otras actividades": "Otras actividades" };
  // año utilizable para comparar: con ingresos y sin marca de atípico (control de calidad del ETL)
  const conDatos = (e, a) => e.anios[a]?.ingresos != null && !e.anios[a].atipico;
  const ultimoAnio = e => Object.keys(e.anios).filter(a => conDatos(e, a)).sort().pop();
  let anioSel = null;          // año elegido en la ficha (null = último de la empresa)
  let comparar = [];           // NIT del comparador
  const filtroRank = { municipio: "todos", tamano: "todos", texto: "", orden: "ingresos", desc: true };

  // indicadores comparables: clave, etiqueta, formato, mejor = "alto" | "bajo"
  const IND = [
    { k: "ingresos", n: "Ingresos operacionales", f: v => fmt.cop(v), mejor: "alto" },
    { k: "crec", n: "Crecimiento de ingresos", f: v => fmt.pct(v, 1), mejor: "alto" },
    { k: "margen_neto", n: "Margen neto", f: v => fmt.pct(v, 1), mejor: "alto" },
    { k: "roa", n: "Rentabilidad del activo (ROA)", f: v => fmt.pct(v, 1), mejor: "alto" },
    { k: "deuda_activos", n: "Endeudamiento (deuda/activos)", f: v => fmt.pct(v, 1), mejor: "bajo" },
    { k: "liquidez", n: "Liquidez (veces)", f: v => fmt.n(v, 2), mejor: "alto" },
    { k: "score", n: "Índice de salud", f: v => fmt.n(v, 0), mejor: "alto" },
  ];
  function valor(e, a, k) {
    const x = e.anios[a];
    if (!x) return null;
    if (k === "crec") { const p = e.anios[String(+a - 1)]?.ingresos; return p > 0 && x.ingresos != null ? (x.ingresos / p - 1) * 100 : null; }
    return x[k] ?? null;
  }

  // ------------------------------------------------------------ pares
  function pares(e, a) {
    const base = D.empresas.filter(x => conDatos(x, a));
    const mismo = base.filter(x => x.sector === e.sector && x.tamano === e.tamano);
    if (mismo.length >= 8) return { lista: mismo, desc: `${e.tamano.toLowerCase()}s del segmento «${SEG[e.sector] || e.sector}»` };
    const seg = base.filter(x => x.sector === e.sector);
    if (seg.length >= 8) return { lista: seg, desc: `empresas del segmento «${SEG[e.sector] || e.sector}»` };
    return { lista: base, desc: "todas las empresas de la jurisdicción" };
  }
  function percentilDe(e, a, ind, lista) {
    const v = valor(e, a, ind.k);
    if (v == null) return null;
    const p = est.percentil(lista.map(x => valor(x, a, ind.k)), v);
    return ind.mejor === "bajo" ? 100 - p : p;
  }

  // ------------------------------------------------------------ índice de salud (fórmula Tablero Lonja)
  function componentesSalud(x) {
    const roe = x.patrimonio ? (x.utilidad || 0) / x.patrimonio : 0;
    const end = x.activos ? (x.pasivos || 0) / x.activos : 0;
    const liq = x.liquidez ?? 0, m = x.margen_neto ?? 0;
    return [
      { n: "Rentabilidad", max: 30, v: roe > 0 ? Math.min(roe / 0.2 * 30, 30) : 0, d: `ROE ${fmt.pct(roe * 100, 1)}` },
      { n: "Liquidez", max: 25, v: liq < 1 ? 0 : liq < 1.5 ? 15 : liq < 2.5 ? 25 : 20, d: `${fmt.n(liq, 2)} veces` },
      { n: "Endeudamiento", max: 25, v: end > 0.8 ? 0 : end > 0.6 ? 10 : end > 0.4 ? 20 : 25, d: `pasivo/activo ${fmt.pct(end * 100, 0)}` },
      { n: "Margen", max: 20, v: m > 0 ? Math.min(m / 10 * 20, 20) : 0, d: `margen neto ${fmt.pct(m, 1)}` },
    ];
  }
  const nivelClase = n => ({ Excelente: "ok", Buena: "ok", Regular: "alerta", Deficiente: "critico" }[n] || "neutro");

  // ------------------------------------------------------------ diagnóstico con reglas explicables
  function diagnostico(e, a, lista) {
    const x = e.anios[a], out = [];
    const pc = k => percentilDe(e, a, IND.find(i => i.k === k), lista);
    const crec = valor(e, a, "crec");
    const medMargen = est.mediana(lista.map(p => p.anios[a].margen_neto));
    if (x.liquidez != null && x.liquidez < 1)
      out.push({ tipo: "critico", t: "Liquidez insuficiente", d: `Activos corrientes cubren ${fmt.n(x.liquidez, 2)} veces las deudas de corto plazo (umbral: 1,0).`,
        ruta: "Consultorio Empresarial Personalizado · finanzas, costos y flujo de caja" });
    if (x.deuda_activos != null && x.deuda_activos > 70)
      out.push({ tipo: "alerta", t: "Endeudamiento alto", d: `La deuda equivale al ${fmt.pct(x.deuda_activos, 0)} de los activos.`,
        ruta: "EMFORMA · fortalecimiento financiero y estructura de capital" });
    if (x.margen_neto != null && (x.margen_neto < 0 || x.margen_neto < medMargen))
      out.push({ tipo: x.margen_neto < 0 ? "critico" : "alerta", t: x.margen_neto < 0 ? "Operación con pérdidas" : "Margen inferior a sus pares",
        d: `Margen neto de ${fmt.pct(x.margen_neto, 1)} frente a una mediana de ${fmt.pct(medMargen, 1)} en sus pares.`,
        ruta: "Centro de Excelencia Operacional · productividad y costos" });
    if (crec != null && crec < -10)
      out.push({ tipo: "alerta", t: "Caída de ingresos", d: `Los ingresos bajaron ${fmt.pct(-crec, 1)} frente al año anterior.`,
        ruta: "Transformación Digital · canales comerciales y presencia digital" });
    if (x.score >= 80) out.push({ tipo: "ok", t: "Salud financiera excelente", d: `Índice de ${fmt.n(x.score, 0)}/100.`, ruta: "Candidata a caso de referencia y encadenamientos" });
    const roaP = pc("roa");
    if (roaP != null && roaP >= 75) out.push({ tipo: "ok", t: "Rentabilidad del activo en el cuartil superior", d: `Supera al ${fmt.n(roaP, 0)} % de sus pares.` });
    if (crec != null && crec > 15) out.push({ tipo: "ok", t: "Crecimiento destacado", d: `Ingresos +${fmt.pct(crec, 1)} frente al año anterior.` });
    if (!out.length) out.push({ tipo: "neutro", t: "Sin alertas relevantes", d: "Los indicadores están dentro de los rangos de referencia de sus pares." });
    return out;
  }

  // ------------------------------------------------------------ buscador compartido
  function buscador(idInput, placeholder) {
    return `<div class="buscador no-print">
      <label class="sr-only" for="${idInput}">${placeholder}</label>
      <input id="${idInput}" list="${idInput}-lista" placeholder="${placeholder}" autocomplete="off">
      <datalist id="${idInput}-lista">${D.empresas.map(e => `<option value="${esc(e.nombre)} · NIT ${e.nit}">`).join("")}</datalist>
    </div>`;
  }
  function nitDesdeTexto(v) { const m = /NIT (\d+)/.exec(v); return m && EMP[m[1]] ? m[1] : null; }
  function porDefecto() {
    const a = App.anioFinanciero();
    return [...D.empresas].filter(e => conDatos(e, a) && e.anios[a].score != null && e.anios[a].margen_neto != null)
      .sort((x, y) => y.anios[a].ingresos - x.anios[a].ingresos)[0].nit;
  }

  // ============================================================ FICHA
  function ficha(vista) {
    if (!estado.empresa || !EMP[estado.empresa]) estado.empresa = porDefecto();
    const e = EMP[estado.empresa];
    const anios = Object.keys(e.anios).filter(a => e.anios[a].ingresos != null).sort();
    const a = anioSel && anios.includes(anioSel) ? anioSel : anios.at(-1);
    const x = e.anios[a], ap = String(+a - 1), k = t();
    const { lista, desc } = pares(e, a);
    const comps = componentesSalud(x), score = x.score ?? est.suma(comps.map(c => c.v));
    const nivel = x.nivel || (score >= 80 ? "Excelente" : score >= 60 ? "Buena" : score >= 40 ? "Regular" : "Deficiente");

    vista.insertAdjacentHTML("beforeend", `
      <div class="seccion-titulo"><div><h2>Radiografía de la empresa</h2>
        <p>Posición financiera de una empresa frente a sus pares de la jurisdicción, con alertas y ruta de acompañamiento sugerida.</p></div>
        <div class="filtros" style="margin:0">${buscador("buscaEmp", "Buscar empresa por nombre o NIT…")}
          <label class="filtro no-print"><span>Año</span><select class="select" id="anioFicha">${anios.map(y => `<option ${y === a ? "selected" : ""}>${y}</option>`).join("")}</select></label>
          <button class="btn sec no-print" id="btnComparar">Añadir al comparador</button>
          <button class="btn no-print" id="btnPdf">Imprimir ficha</button></div></div>
      <div class="grid">
        ${x.atipico ? `<div class="c12 nota" role="alert"><span class="badge alerta">▲ Dato atípico</span> ${esc(x.atipico)}. Este año se excluye de agregados, rankings y comparaciones con pares.</div>` : ""}
        <section class="card c12 ficha">
          <div><h2>${esc(e.nombre)}</h2>
            <div class="meta"><span>NIT <b>${e.nit}</b></span><span>Municipio <b>${NOMBRE[e.cod]}</b></span>
              <span>CIIU <b>${e.ciiu || "—"}</b></span><span>Segmento <b>${SEG[e.sector] || e.sector || "—"}</b></span>
              <span>Tamaño por ingresos <b>${e.tamano}</b></span><span>Estados financieros <b>${anios[0]}–${anios.at(-1)}</b></span></div></div>
          <div style="text-align:right"><span class="badge ${nivelClase(nivel)}">${nivelClase(nivel) === "ok" ? "●" : "▲"} Salud ${nivel.toLowerCase()}</span>
            <p class="sub" style="margin-top:6px">Comparada con ${lista.length} ${desc}</p></div>
        </section>
        <section class="card c4" aria-labelledby="t-score"><h3 id="t-score">Índice de salud financiera ${a}</h3>
          <div class="score" style="margin-top:8px"><div class="anillo" id="anillo" role="img" aria-label="Índice ${fmt.n(score, 0)} de 100"></div>
            <div class="componentes">${comps.map(c => `<div class="componente"><span>${c.n}</span>
              <div class="barra" title="${c.d}"><i style="width:${c.v / c.max * 100}%"></i></div><span class="num">${fmt.n(c.v, 0)}/${c.max}</span></div>`).join("")}
            </div></div>
          <p class="fuente">Rentabilidad 30 · liquidez 25 · endeudamiento 25 · margen 20 (fórmula del Tablero Lonja).</p></section>
        <div class="c8 grid kpi-par">
          ${kpi({ etq: `Ingresos ${a}`, valor: fmt.cop(x.ingresos), contexto: fmt.delta(x.ingresos, e.anios[ap]?.ingresos), cls: "" })}
          ${kpi({ etq: "Utilidad neta", valor: fmt.cop(x.utilidad), contexto: `Margen neto ${fmt.pct(x.margen_neto, 1)}`, cls: "" })}
          ${kpi({ etq: "Activos totales", valor: fmt.cop(x.activos), contexto: `Patrimonio ${fmt.cop(x.patrimonio)}`, cls: "" })}
          ${kpi({ etq: "Participación en los ingresos del sector", valor: fmt.pct((x.cuota || 0) * 100, 2), contexto: `Puesto ${[...D.empresas].filter(z => conDatos(z, a)).sort((p, q) => q.anios[a].ingresos - p.anios[a].ingresos).findIndex(z => z.nit === e.nit) + 1} de ${D.empresas.filter(z => conDatos(z, a)).length} en Aburrá Sur`, cls: "" })}
        </div>
        ${card({ id: "pos", titulo: "Posición frente a sus pares", sub: "Percentil: 100 = mejor del grupo. Las marcas indican P25, mediana y P75.", fuente: F.emis, cls: "c7", cuerpo: `<div class="pct-lista" id="pctLista"></div>` })}
        ${card({ id: "diag", titulo: "Diagnóstico automático y ruta sugerida", sub: "Reglas explicables; la ruta es ilustrativa y se basa en la oferta pública de la Cámara", cls: "c5", cuerpo: `<div class="diag" id="diagLista"></div>` })}
        ${["ingresos", "margen_neto", "roa", "deuda_activos"].map(c => card({ id: `tr-${c}`, titulo: IND.find(i => i.k === c).n, cls: "c3", alto: "bajo" })).join("")}
        <div class="c12">${leyenda([{ nombre: "Empresa", color: k.series[0], linea: true }, { nombre: "Mediana de pares", color: k.ref, linea: true, ref: true }, { nombre: "Rango P25–P75 de pares", color: k.grid }])}</div>
        <details class="card c12"><summary><b>Cómo leer esta ficha</b></summary>
          <ul class="capacidades" style="columns:1;margin-top:10px">
            <li><b>Pares:</b> se comparan empresas del mismo segmento y tamaño; si son menos de 8, se amplía al segmento y luego a toda la jurisdicción.</li>
            <li><b>Percentil:</b> porcentaje de pares que la empresa supera. En endeudamiento se invierte: menos deuda = mejor posición.</li>
            <li><b>Índice de salud:</b> suma de puntos por rentabilidad sobre patrimonio, liquidez, endeudamiento y margen neto.</li>
            <li><b>Ruta sugerida:</b> relaciona cada alerta con un programa de la Cámara; requiere validación de un asesor.</li>
            <li>Cifras en millones de pesos según estados financieros reportados a Supersociedades.</li></ul></details>
      </div>`);

    // eventos
    const inp = $("#buscaEmp");
    inp.addEventListener("change", () => { const n = nitDesdeTexto(inp.value); if (n) { estado.empresa = n; anioSel = null; App.rerender(); } });
    $("#anioFicha").addEventListener("change", ev => { anioSel = ev.target.value; App.rerender(); });
    $("#btnPdf").addEventListener("click", () => window.print());
    $("#btnComparar").addEventListener("click", () => {
      // comparador vacío: se completa con la empresa y sus tres pares de mayores ingresos
      if (comparar.length && !comparar.includes(e.nit)) comparar = [...comparar, e.nit].slice(-4);
      App.ir("radiografia", "comparador");
    });

    // anillo del índice
    grafico($("#anillo"), { series: [{ type: "gauge", startAngle: 90, endAngle: -270, min: 0, max: 100, radius: "100%",
      pointer: { show: false }, progress: { show: true, roundCap: true, width: 12, itemStyle: { color: k.series[0] } },
      axisLine: { lineStyle: { width: 12, color: [[1, k.grid]] } }, splitLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false },
      detail: { valueAnimation: false, offsetCenter: [0, 0], fontSize: 28, fontWeight: 800, fontFamily: k.fontT, color: k.text, formatter: v => fmt.n(v, 0) },
      title: { show: false }, data: [{ value: score }] }] });

    // posición percentil
    $("#pctLista").innerHTML = IND.map(ind => {
      const p = percentilDe(e, a, ind, lista), v = valor(e, a, ind.k);
      if (p == null) return `<div class="pct-fila"><span>${ind.n}</span><span class="sub">Sin dato</span><span></span></div>`;
      const vals = lista.map(z => valor(z, a, ind.k)).filter(z => z != null);
      const med = est.mediana(vals);
      return `<div class="pct-fila"><span>${ind.n}</span>
        <div class="pct-track" title="Percentil ${fmt.n(p, 0)}"><span class="q" style="left:25%"></span><span class="q med" style="left:50%"></span><span class="q" style="left:75%"></span>
          <span class="dot" style="left:${Math.max(2, Math.min(98, p))}%"></span></div>
        <span class="val">${ind.f(v)}<small>P${fmt.n(p, 0)} · mediana ${ind.f(med)}</small></span></div>`;
    }).join("");

    // diagnóstico
    const ico = { ok: "●", alerta: "▲", critico: "■", neutro: "○" };
    const txt = { ok: "Fortaleza", alerta: "Alerta", critico: "Crítico", neutro: "Estable" };
    $("#diagLista").innerHTML = diagnostico(e, a, lista).map(d => `<div class="diag-item ${d.ruta ? "ruta" : ""}">
      <span class="badge ${d.tipo}">${ico[d.tipo]} ${txt[d.tipo]}</span>
      <div><b>${d.t}</b><p>${d.d}</p>${d.ruta ? `<p><b>Ruta sugerida:</b> ${d.ruta}</p>` : ""}</div></div>`).join("");

    // tendencias con banda de pares
    const ind4 = ["ingresos", "margen_neto", "roa", "deuda_activos"];
    ind4.forEach(c => {
      const def = IND.find(i => i.k === c);
      const banda = ANIOS.map(y => {
        const g = pares(e, y).lista.map(z => valor(z, y, c));
        return { p25: est.cuantil(g, 0.25), med: est.mediana(g), p75: est.cuantil(g, 0.75) };
      });
      grafico($(`#tr-${c}`), { ...baseEjes(), grid: { left: 4, right: 10, top: 10, bottom: 4, containLabel: true },
        tooltip: { ...baseEjes().tooltip, formatter: ps => { const i = ps[0].dataIndex;
          return `<b>${ANIOS[i]}</b>${tooltipFila(k.series[0], "Empresa", def.f(valor(e, ANIOS[i], c)))}${tooltipFila(k.ref, "Mediana pares", def.f(banda[i].med))}${tooltipFila(k.grid, "P25–P75", `${def.f(banda[i].p25)} – ${def.f(banda[i].p75)}`)}`; } },
        xAxis: ejeCat(ANIOS, { boundaryGap: false }),
        yAxis: ejeVal({ scale: c !== "ingresos", axisLabel: { color: k.text3, fontSize: 10, formatter: c === "ingresos" ? v => fmt.copCorto(v) : v => fmt.n(v) + "%" } }),
        series: [
          ...([{ type: "line", stack: "b", data: banda.map(b => b.p25), lineStyle: { opacity: 0 }, symbol: "none", silent: true },
          { type: "line", stack: "b", data: banda.map(b => b.p75 != null && b.p25 != null ? b.p75 - b.p25 : null), lineStyle: { opacity: 0 }, symbol: "none", silent: true, areaStyle: { color: k.grid, opacity: 1 } }]),
          { type: "line", data: banda.map(b => b.med), symbol: "none", lineStyle: { color: k.ref, width: 1.5, type: "dashed" } },
          { type: "line", data: ANIOS.map(y => valor(e, y, c)), symbol: "circle", symbolSize: 7, connectNulls: false,
            lineStyle: { color: k.series[0], width: 2 }, itemStyle: { color: k.series[0], borderColor: k.surface, borderWidth: 2 } },
        ] });
    });
  }

  // ============================================================ COMPARADOR
  function comparador(vista) {
    if (!comparar.length) {
      const e = EMP[estado.empresa || porDefecto()], a = ultimoAnio(e);
      comparar = [e.nit, ...pares(e, a).lista.filter(z => z.nit !== e.nit).sort((p, q) => q.anios[a].ingresos - p.anios[a].ingresos).slice(0, 3).map(z => z.nit)];
    }
    const k = t(), a = App.anioFinanciero();
    vista.insertAdjacentHTML("beforeend", `
      <div class="seccion-titulo"><div><h2>Comparador de empresas</h2>
        <p>Hasta cuatro empresas lado a lado. El color sigue a cada empresa en todas las vistas del comparador.</p></div>
        <div class="filtros" style="margin:0">${buscador("buscaComp", "Añadir empresa…")}</div></div>
      <div class="chips" id="chipsComp" style="margin-bottom:16px"></div>
      <div class="grid">
        ${card({ id: "cIng", titulo: "Ingresos operacionales", sub: "Millones de pesos", fuente: F.emis, cls: "c6" })}
        ${card({ id: "cMar", titulo: "Margen neto", sub: "Porcentaje", fuente: F.emis, cls: "c6" })}
        ${card({ id: "cTab", titulo: `Indicadores, ${a}`, sub: "Entre paréntesis, percentil frente a toda la jurisdicción", cls: "c12", cuerpo: `<div class="tabla-wrap" id="tabComp"></div>` })}
      </div>`);
    const inp = $("#buscaComp");
    inp.addEventListener("change", () => { const n = nitDesdeTexto(inp.value); if (n && !comparar.includes(n)) { comparar = [...comparar, n].slice(-4); App.rerender(); } });
    const emps = comparar.map(n => EMP[n]);
    const col = i => k.series[i];
    $("#chipsComp").innerHTML = emps.map((e, i) => `<span class="chip" aria-pressed="false"><i class="punto" style="background:${col(i)}"></i>${esc(e.nombre)}
      <button class="btn-quitar" data-nit="${e.nit}" aria-label="Quitar ${esc(e.nombre)}" style="border:0;background:none;cursor:pointer;font-weight:800;color:var(--text-3)">×</button></span>`).join("");
    $$(".btn-quitar").forEach(b => b.addEventListener("click", () => { comparar = comparar.filter(n => n !== b.dataset.nit); if (!comparar.length) comparar = [estado.empresa]; App.rerender(); }));

    const lineas = (el, c, f) => grafico(el, { ...baseEjes(),
      tooltip: { ...baseEjes().tooltip, formatter: ps => `<b>${ps[0].axisValue}</b>` + ps.filter(p => p.value != null).map(p => tooltipFila(p.color, esc(emps[p.seriesIndex].nombre), f(p.value))).join("") },
      xAxis: ejeCat(ANIOS), yAxis: ejeVal({ axisLabel: { color: k.text3, formatter: c === "ingresos" ? v => fmt.copCorto(v) : v => v + "%" } }),
      series: emps.map((e, i) => ({ type: "line", symbol: "circle", symbolSize: 7, lineStyle: { width: 2 },
        itemStyle: { color: col(i), borderColor: k.surface, borderWidth: 2 }, data: ANIOS.map(y => valor(e, y, c)) })) });
    lineas($("#cIng"), "ingresos", v => fmt.cop(v));
    lineas($("#cMar"), "margen_neto", v => fmt.pct(v, 1));
    const ley = leyenda(emps.map((e, i) => ({ nombre: esc(e.nombre), color: col(i), linea: true })));
    $("#cIng").insertAdjacentHTML("afterend", ley); $("#cMar").insertAdjacentHTML("afterend", ley);

    const todos = D.empresas.filter(z => conDatos(z, a));
    $("#tabComp").innerHTML = `<table class="tabla"><thead><tr><th>Indicador</th>${emps.map((e, i) =>
      `<th class="n"><span class="swatch" style="background:${col(i)}"></span>${esc(e.nombre.length > 28 ? e.nombre.slice(0, 27) + "…" : e.nombre)}</th>`).join("")}</tr></thead><tbody>
      <tr><td>Municipio</td>${emps.map(e => `<td class="n">${NOMBRE[e.cod]}</td>`).join("")}</tr>
      <tr><td>Tamaño</td>${emps.map(e => `<td class="n">${e.tamano}</td>`).join("")}</tr>
      ${IND.map(ind => `<tr><td>${ind.n}</td>${emps.map(e => { const v = valor(e, a, ind.k), p = percentilDe(e, a, ind, todos);
        return `<td class="n">${v == null ? "—" : ind.f(v)} <span class="sub">${p == null ? "" : `(P${fmt.n(p, 0)})`}</span></td>`; }).join("")}</tr>`).join("")}
      <tr><td>Nivel de salud</td>${emps.map(e => { const nv = e.anios[a]?.nivel; return `<td class="n">${nv ? `<span class="badge ${nivelClase(nv)}">${nv}</span>` : "—"}</td>`; }).join("")}</tr>
      </tbody></table>`;
  }

  // ============================================================ RANKING
  function ranking(vista) {
    const a = App.anioFinanciero(), k = t();
    vista.insertAdjacentHTML("beforeend", `
      <div class="seccion-titulo"><div><h2>Directorio y ranking de empresas</h2>
        <p>Todas las empresas con estados financieros en ${a}. Ordena por cualquier columna y haz clic en una fila para abrir su radiografía.</p></div>
        <button class="btn sec no-print" id="csvRank">Descargar CSV</button></div>
      <div class="filtros">
        <div class="filtro"><span>Municipio</span><select class="select" id="rMun"><option value="todos">Todos</option>${MUNI.map(m => `<option value="${m.cod}" ${filtroRank.municipio === m.cod ? "selected" : ""}>${m.nombre}</option>`).join("")}</select></div>
        <div class="filtro"><span>Tamaño</span><select class="select" id="rTam"><option value="todos">Todos</option>${["Micro", "Pequeña", "Mediana", "Grande"].map(x => `<option ${filtroRank.tamano === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
        <div class="filtro"><span>Buscar</span><input class="select" id="rTxt" value="${esc(filtroRank.texto)}" placeholder="Nombre o NIT"></div>
      </div>
      <section class="card"><div class="tabla-wrap" id="tabRank"></div></section>`);
    const cols = [["nombre", "Empresa"], ["municipio", "Municipio"], ["tamano", "Tamaño"], ["ingresos", "Ingresos"], ["crec", "Crec."],
      ["margen_neto", "Margen neto"], ["roa", "ROA"], ["deuda_activos", "Deuda/activos"], ["score", "Salud"]];
    function filas() {
      return D.empresas.filter(e => conDatos(e, a))
        .filter(e => filtroRank.municipio === "todos" || e.cod === filtroRank.municipio)
        .filter(e => filtroRank.tamano === "todos" || e.tamano === filtroRank.tamano)
        .filter(e => !filtroRank.texto || (e.nombre + " " + e.nit).toLowerCase().includes(filtroRank.texto.toLowerCase()))
        .map(e => ({ nit: e.nit, nombre: e.nombre, municipio: NOMBRE[e.cod], cod: e.cod, tamano: e.tamano, ingresos: e.anios[a].ingresos,
          crec: valor(e, a, "crec"), margen_neto: e.anios[a].margen_neto, roa: e.anios[a].roa, deuda_activos: e.anios[a].deuda_activos,
          score: e.anios[a].score, nivel: e.anios[a].nivel }))
        .sort((p, q) => { const o = filtroRank.orden, x = p[o], y = q[o];
          if (x == null) return 1; if (y == null) return -1;
          const r = typeof x === "string" ? x.localeCompare(y) : x - y; return filtroRank.desc ? -r : r; });
    }
    function pintarTabla() {
      const fs = filas();
      const f = { ingresos: v => fmt.cop(v), crec: v => fmt.pct(v, 1), margen_neto: v => fmt.pct(v, 1), roa: v => fmt.pct(v, 1), deuda_activos: v => fmt.pct(v, 0), score: v => fmt.n(v, 0) };
      $("#tabRank").innerHTML = `<p class="sub">${fs.length} empresas</p><table class="tabla"><thead><tr><th class="n">#</th>${cols.map(([c, n]) =>
        `<th data-orden="${c}" class="${f[c] ? "n" : ""}" aria-sort="${filtroRank.orden === c ? (filtroRank.desc ? "descending" : "ascending") : "none"}">${n}${filtroRank.orden === c ? (filtroRank.desc ? " ▼" : " ▲") : ""}</th>`).join("")}</tr></thead>
        <tbody>${fs.map((r, i) => `<tr class="click ${r.nit === estado.empresa ? "sel" : ""}" data-nit="${r.nit}"><td class="n">${i + 1}</td>
          <td>${esc(r.nombre)}</td><td><span class="swatch" style="background:${colorMunicipio(r.cod)}"></span>${r.municipio}</td><td>${r.tamano}</td>
          ${["ingresos", "crec", "margen_neto", "roa", "deuda_activos"].map(c => `<td class="n">${r[c] == null ? "—" : f[c](r[c])}</td>`).join("")}
          <td class="n">${r.score == null ? "—" : `<span class="badge ${nivelClase(r.nivel)}">${fmt.n(r.score, 0)}</span>`}</td></tr>`).join("")}</tbody></table>`;
      $$("#tabRank th[data-orden]").forEach(th => th.addEventListener("click", () => {
        filtroRank.desc = filtroRank.orden === th.dataset.orden ? !filtroRank.desc : true; filtroRank.orden = th.dataset.orden; pintarTabla(); }));
      $$("#tabRank tr[data-nit]").forEach(tr => tr.addEventListener("click", () => { estado.empresa = tr.dataset.nit; anioSel = null; App.ir("radiografia", "ficha"); }));
    }
    pintarTabla();
    $("#rMun").addEventListener("change", ev => { filtroRank.municipio = ev.target.value; pintarTabla(); });
    $("#rTam").addEventListener("change", ev => { filtroRank.tamano = ev.target.value; pintarTabla(); });
    $("#rTxt").addEventListener("input", ev => { filtroRank.texto = ev.target.value; pintarTabla(); });
    $("#csvRank").addEventListener("click", () => descargarCSV(`ranking_empresas_${a}.csv`, filas().map(({ cod, ...r }) => r)));
  }

  App.registrar("radiografia", {
    titulo: "Radiografía empresarial",
    secciones: [
      { id: "ficha", titulo: "Ficha de empresa", render: ficha },
      { id: "comparador", titulo: "Comparador", render: comparador },
      { id: "ranking", titulo: "Directorio y ranking", render: ranking },
    ],
  });
})();
