/* Núcleo compartido por los dos tableros: estado, rutas, formato, tema y utilidades de gráficos. */
(function () {
  const D = window.DATOS;
  const MUNI = D.meta.municipios;                       // orden fijo => color fijo
  const NOMBRE = Object.fromEntries([...MUNI, ...D.meta.contexto].map(m => [m.cod, m.nombre]));
  const GEO = Object.fromEntries(window.GEO_ABURRA_SUR.features.map(f => [f.properties.cod, f.properties]));

  const estado = { tablero: "observatorio", seccion: null, municipio: "todos", empresa: null };
  const tableros = {};       // nombre -> { titulo, secciones: [{id, titulo, render}] }
  let graficos = [];

  // ---------------------------------------------------------------- tema
  function css(nombre) { return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim(); }
  function t() {
    return {
      text: css("--text"), text2: css("--text-2"), text3: css("--text-3"), grid: css("--grid"),
      border: css("--border"), surface: css("--surface"), accent: css("--accent"), ref: css("--serie-ref"),
      series: [1, 2, 3, 4, 5, 6].map(i => css(`--serie-${i}`)),
      seq: [1, 2, 3, 4, 5, 6].map(i => css(`--seq-${i}`)),
      ok: css("--ok"), alerta: css("--alerta"), critico: css("--critico"),
      fontT: css("--font-titulos"), fontX: css("--font-texto"),
    };
  }
  function colorMunicipio(cod) {
    const i = MUNI.findIndex(m => m.cod === cod);
    return i >= 0 ? t().series[i] : t().ref;
  }
  function aplicarTema(modo) {
    if (modo) document.documentElement.setAttribute("data-theme", modo);
    try { if (modo) localStorage.setItem("ccas-tema", modo); } catch (e) { /* sin almacenamiento */ }
  }
  function temaActual() {
    const a = document.documentElement.getAttribute("data-theme");
    if (a) return a;
    return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  // ---------------------------------------------------------------- formato
  const nf = (d = 0) => new Intl.NumberFormat("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmt = {
    n: (x, d = 0) => x == null || isNaN(x) ? "—" : nf(d).format(x),
    pct: (x, d = 1) => x == null || isNaN(x) ? "—" : nf(d).format(x) + " %",
    // valores en millones de COP
    cop: (mm) => {
      if (mm == null || isNaN(mm)) return "—";
      const a = Math.abs(mm), s = mm < 0 ? "−" : "";
      if (a >= 1e6) return `${s}$${nf(1).format(a / 1e6)} billones`;
      if (a >= 1e3) return `${s}$${nf(a >= 1e5 ? 0 : 1).format(a / 1e3)} mil millones`;
      return `${s}$${nf(a >= 100 ? 0 : 1).format(a)} millones`;
    },
    copCorto: (mm) => {
      if (mm == null || isNaN(mm)) return "—";
      const a = Math.abs(mm), s = mm < 0 ? "−" : "";
      if (a >= 1e6) return `${s}${nf(1).format(a / 1e6)} B`;
      if (a >= 1e3) return `${s}${nf(0).format(a / 1e3)} mM`;
      return `${s}${nf(0).format(a)} M`;
    },
    delta: (actual, previo, sufijo = "vs. año anterior") => {
      if (!previo || actual == null) return "";
      const v = (actual / previo - 1) * 100;
      const cls = Math.abs(v) < 0.5 ? "flat" : v > 0 ? "up" : "down";
      const ico = cls === "up" ? "▲" : cls === "down" ? "▼" : "■";
      return `<span class="delta ${cls}">${ico} ${nf(1).format(Math.abs(v))} %</span> <span>${sufijo}</span>`;
    },
  };

  // ---------------------------------------------------------------- estadística
  const est = {
    suma: a => a.reduce((s, x) => s + (x || 0), 0),
    mediana(a) {
      const v = a.filter(x => x != null && !isNaN(x)).sort((x, y) => x - y);
      if (!v.length) return null;
      const m = Math.floor(v.length / 2);
      return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
    },
    cuantil(a, q) {
      const v = a.filter(x => x != null && !isNaN(x)).sort((x, y) => x - y);
      if (!v.length) return null;
      const p = (v.length - 1) * q, b = Math.floor(p);
      return v[b] + (v[Math.min(b + 1, v.length - 1)] - v[b]) * (p - b);
    },
    percentil(a, x) {      // % de valores por debajo de x (empates a la mitad)
      const v = a.filter(y => y != null && !isNaN(y));
      if (!v.length || x == null) return null;
      const menores = v.filter(y => y < x).length, iguales = v.filter(y => y === x).length;
      return (menores + iguales / 2) / v.length * 100;
    },
  };

  // ---------------------------------------------------------------- gráficos
  function grafico(el, opcion) {
    const c = echarts.init(el, null, { renderer: "svg" });
    c.setOption(opcion);
    graficos.push(c);
    return c;
  }
  function baseEjes() {
    const k = t();
    return {
      textStyle: { fontFamily: k.fontX, color: k.text2 },
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      tooltip: {
        trigger: "axis", confine: true, backgroundColor: k.surface, borderColor: k.border,
        textStyle: { color: k.text, fontSize: 12 }, extraCssText: "box-shadow:0 4px 14px rgb(0 0 0 / 12%);border-radius:8px;",
        axisPointer: { type: "line", lineStyle: { color: k.text3, width: 1 } },
      },
    };
  }
  function ejeCat(datos, extra = {}) {
    const k = t();
    return Object.assign({
      type: "category", data: datos, axisLine: { lineStyle: { color: k.border } }, axisTick: { show: false },
      axisLabel: { color: k.text2, fontSize: 11 },
    }, extra);
  }
  function ejeVal(extra = {}) {
    const k = t();
    return Object.assign({
      type: "value", splitLine: { lineStyle: { color: k.grid } }, axisLine: { show: false },
      axisLabel: { color: k.text3, fontSize: 11, formatter: v => fmt.n(v, Math.abs(v) < 1 && v !== 0 ? 2 : 0) },
    }, extra);
  }
  function leyenda(items) {
    return `<div class="leyenda">${items.map(i =>
      `<span><i class="${i.linea ? "linea" : ""} ${i.ref ? "ref" : ""}" style="background:${i.color}"></i>${i.nombre}</span>`).join("")}</div>`;
  }
  function tooltipFila(color, nombre, valor) {
    return `<div style="display:flex;gap:8px;align-items:center;justify-content:space-between;min-width:180px">
      <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px"></span>${nombre}</span>
      <b style="font-variant-numeric:tabular-nums">${valor}</b></div>`;
  }
  function limpiarGraficos() { graficos.forEach(g => g.dispose()); graficos = []; }

  // ---------------------------------------------------------------- utilidades DOM
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  function esc(s) { return String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function card({ id, titulo, sub = "", fuente = "", cls = "c6", alto = "", cuerpo = null, acciones = "" }) {
    return `<section class="card ${cls}" aria-labelledby="t-${id}">
      <div class="card-head"><div><h3 id="t-${id}">${titulo}</h3>${sub ? `<p class="sub">${sub}</p>` : ""}</div>${acciones}</div>
      ${cuerpo ?? `<div class="chart ${alto}" id="${id}" role="img" aria-label="${esc(titulo)}"></div>`}
      ${fuente ? `<p class="fuente">Fuente: ${fuente}</p>` : ""}
    </section>`;
  }
  function kpi({ etq, valor, contexto = "", cls = "c3" }) {
    return `<div class="card kpi ${cls}"><span class="etq">${etq}</span><span class="valor">${valor}</span><span class="contexto">${contexto}</span></div>`;
  }
  function filtroMunicipio(alCambiar, { incluirTodos = true } = {}) {
    const op = [...(incluirTodos ? [{ cod: "todos", nombre: "Aburrá Sur" }] : []), ...MUNI];
    const html = `<div class="filtro"><span>Municipio</span><div class="chips" role="group" aria-label="Municipio">
      ${op.map(m => `<button class="chip" data-mun="${m.cod}" aria-pressed="${estado.municipio === m.cod}">
        ${m.cod !== "todos" ? `<i class="punto" style="background:${colorMunicipio(m.cod)}"></i>` : ""}${m.nombre}</button>`).join("")}
    </div></div>`;
    const enlazar = (raiz) => $$("[data-mun]", raiz).forEach(b => b.addEventListener("click", () => {
      estado.municipio = b.dataset.mun; alCambiar();
    }));
    return { html, enlazar };
  }
  function descargarCSV(nombre, filas) {
    if (!filas.length) return;
    const cols = Object.keys(filas[0]);
    const txt = [cols.join(";"), ...filas.map(f => cols.map(c => {
      const v = f[c]; return typeof v === "number" ? String(v).replace(".", ",") : `"${String(v ?? "").replace(/"/g, '""')}"`;
    }).join(";"))].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + txt], { type: "text/csv;charset=utf-8" }));
    a.download = nombre; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------------------------------------------------------------- navegación
  function registrar(nombre, def) { tableros[nombre] = def; }
  function ir(tablero, seccion) {
    estado.tablero = tablero;
    estado.seccion = seccion || tableros[tablero].secciones[0].id;
    history.replaceState(null, "", `#${estado.tablero}/${estado.seccion}`);
    pintar();
  }
  function pintar() {
    const def = tableros[estado.tablero];
    $$(".selector-tablero button").forEach(b => b.setAttribute("aria-selected", b.dataset.tablero === estado.tablero));
    $("#subnav").innerHTML = def.secciones.map(s =>
      `<button role="tab" data-sec="${s.id}" aria-selected="${s.id === estado.seccion}">${s.titulo}</button>`).join("");
    $$("#subnav button").forEach(b => b.addEventListener("click", () => ir(estado.tablero, b.dataset.sec)));
    rerender();
  }
  function rerender() {
    limpiarGraficos();
    const def = tableros[estado.tablero];
    const sec = def.secciones.find(s => s.id === estado.seccion) || def.secciones[0];
    const vista = $("#vista");
    const y = window.scrollY;
    vista.innerHTML = "";
    sec.render(vista);
    window.scrollTo(0, y);
  }

  function iniciar() {
    try { const g = localStorage.getItem("ccas-tema"); if (g) aplicarTema(g); } catch (e) { /* nada */ }
    $("#pieFecha").textContent = `Datos procesados: ${D.meta.generado}`;
    $$(".selector-tablero button").forEach(b => b.addEventListener("click", () => ir(b.dataset.tablero)));
    $("#btnTema").addEventListener("click", () => { aplicarTema(temaActual() === "dark" ? "light" : "dark"); rerender(); });
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", rerender);
    let to; window.addEventListener("resize", () => { clearTimeout(to); to = setTimeout(() => graficos.forEach(g => g.resize()), 120); });
    echarts.registerMap("aburra", window.GEO_ABURRA_SUR);
    const [tb, sec] = location.hash.replace("#", "").split("/");
    ir(tableros[tb] ? tb : "observatorio", sec);
  }

  window.App = {
    D, MUNI, NOMBRE, GEO, estado, t, colorMunicipio, fmt, est, grafico, baseEjes, ejeCat, ejeVal, leyenda,
    tooltipFila, $, $$, esc, card, kpi, filtroMunicipio, descargarCSV, registrar, ir, rerender, iniciar,
  };
})();
