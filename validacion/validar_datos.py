"""Conciliación de cifras: recalcula con SQL directo sobre lonja.db (sin usar el exportador)
y compara con lo que carga el tablero (web/data/datos.js). Genera validacion/reporte_datos.md.

Uso:
    python validacion/validar_datos.py "C:/ruta/TableroLonja/datos/lonja.db"
"""
import json
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
MUN = {"05266": "ENVIGADO", "05360": "ITAG", "05631": "SABANETA", "05380": "LA ESTRELLA", "05129": "CALDAS"}
DIVI = tuple(int(c) for c in MUN)
resultados = []


def check(nombre, esperado, obtenido, tol=0.005, nota="", aviso=False):
    """esperado = recalculado en la base; obtenido = lo que usa el tablero."""
    if esperado is None or obtenido is None:
        ok = esperado == obtenido
    elif esperado == 0:
        ok = abs(obtenido) < 1e-9
    else:
        ok = abs(obtenido - esperado) / abs(esperado) <= tol
    resultados.append((ok, nombre, esperado, obtenido, nota))


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    c = sqlite3.connect(sys.argv[1])
    q1 = lambda s, *p: c.execute(s, p).fetchone()[0]
    txt = (RAIZ / "web" / "data" / "datos.js").read_text(encoding="utf-8")
    D = json.loads(txt[txt.index("{"):txt.rstrip().rindex("}") + 1])
    geo_txt = (RAIZ / "web" / "data" / "geo.js").read_text(encoding="utf-8")
    G = json.loads(geo_txt[geo_txt.index("{"):geo_txt.rstrip().rindex("}") + 1])

    # ---------------- RUES
    check("RUES · empresas activas cámara 55", q1("select count(*) from stg_empresas where codigo_camara=55"),
          sum(r["n"] for r in D["rues"]))
    check("RUES · matriculadas en 2025", q1("select count(*) from stg_empresas where codigo_camara=55 and fecha_matricula like '2025%'"),
          sum(r["n"] for r in D["rues"] if r["anio_matricula"] == 2025))
    check("RUES · renovaron en 2025", q1("select count(*) from stg_empresas where codigo_camara=55 and ultimo_ano_renovado=2025"),
          sum(r["n"] for r in D["rues"] if r["ultimo_renovado"] == 2025))
    check("RUES · medianas y grandes", q1("select count(*) from stg_empresas where codigo_camara=55 and tamano in ('Mediana','Grande')"),
          sum(r["n"] for r in D["rues"] if r["tamano"] in ("Mediana", "Grande")))

    # ---------------- IGAC transacciones (por nombre de municipio, distinto al exportador)
    filtro = " or ".join(f"municipio like '{n}%'" for n in MUN.values())
    for anio in (2021, 2022, 2023):
        base = c.execute(f"""select sum(total_transacciones), sum(valor_total)/1e6, sum(total_predios_nuevos)
            from stg_igac_agregado where departamento='ANTIOQUIA' and year_radica=? and ({filtro})""", (anio,)).fetchone()
        tab = [a for a in D["igac"]["anual"] if a["anio"] == anio]
        check(f"IGAC · transacciones Aburrá Sur {anio}", base[0], sum(a["transacciones"] for a in tab))
        check(f"IGAC · valor transado {anio} (millones)", base[1], sum(a["valor_mm"] for a in tab))
        check(f"IGAC · folios nuevos {anio}", base[2], sum(a["predios_nuevos"] for a in tab))
    for cod, nom in MUN.items():
        base = q1(f"""select sum(total_transacciones) from stg_igac_agregado
            where departamento='ANTIOQUIA' and year_radica=2023 and municipio like '{nom}%'""")
        tab = next(a["transacciones"] for a in D["igac"]["anual"] if a["cod"] == cod and a["anio"] == 2023)
        check(f"IGAC · transacciones 2023 · {nom.title()}", base, tab)

    # ---------------- Dinámica inmobiliaria
    for cod in MUN:
        base = q1("""select transacciones from stg_DinamicaInmobiliaria where divipola=? and ao=2023
            and zona='Total' and nivel_del_ndice like 'B%sico'""", cod)
        tab = next(d["transacciones"] for d in D["dinamica"] if d["cod"] == cod and d["anio"] == 2023 and d["zona"] == "Total")
        check(f"Dinámica · transacciones 2023 · {MUN[cod].title()}", base, tab)

    # ---------------- EMIS
    emis_base = c.execute(f"""select count(distinct conit) from stg_emis_financiero
        where cod_dane_dep in (5,'05') and (cod_dane_mun in {DIVI} or (cod_dane_mun=15131 and ciudad='Caldas'))""").fetchone()[0]
    check("EMIS · empresas en Aburrá Sur", emis_base, len(D["empresas"]))
    for anio in (2023, 2024):
        filas, unicas = c.execute(f"""select count(*), count(distinct conit) from stg_emis_financiero
            where variable='Total Ingreso Operativo' and year=? and valor is not null and cod_dane_dep in (5,'05')
            and (cod_dane_mun in {DIVI} or (cod_dane_mun=15131 and ciudad='Caldas'))""", (anio,)).fetchone()
        check(f"Fuente · filas EMIS repetidas {anio} (defecto de lonja.db)", 0, filas - unicas,
              nota="el tablero deduplica por NIT; el Power BI de la Lonja podría estar sumándolas")
        # una fila por empresa y año (la base de la Lonja repite algunas empresas)
        base = c.execute(f"""select count(*), sum(v) from (select conit, max(valor) v from stg_emis_financiero
            where variable='Total Ingreso Operativo' and year=? and valor is not null and cod_dane_dep in (5,'05')
            and (cod_dane_mun in {DIVI} or (cod_dane_mun=15131 and ciudad='Caldas')) group by conit)""", (anio,)).fetchone()
        atip = [e["anios"][str(anio)] for e in D["empresas"] if e["anios"].get(str(anio), {}).get("atipico")]
        tab_n = sum(1 for e in D["empresas"] if e["anios"].get(str(anio), {}).get("ingresos") is not None)
        tab_sum = sum(e["anios"][str(anio)]["ingresos"] for e in D["empresas"] if e["anios"].get(str(anio), {}).get("ingresos") is not None)
        check(f"EMIS · empresas con ingresos {anio}", base[0], tab_n)
        check(f"EMIS · ingresos {anio} sin depurar (millones)", base[1], tab_sum)
        check(f"EMIS · ingresos {anio} depurados (millones)", base[1] - sum(a["ingresos"] for a in atip),
              tab_sum - sum(a["ingresos"] for a in atip), nota=f"{len(atip)} registro(s) atípico(s) excluido(s)")
    # índice de salud: el tablero recalcula los componentes con la fórmula Lonja
    dif = []
    for e in D["empresas"]:
        for anio, x in e["anios"].items():
            if x.get("score") is None or x.get("ingresos") is None:
                continue
            roe = (x.get("utilidad") or 0) / x["patrimonio"] if x.get("patrimonio") else 0
            end = (x.get("pasivos") or 0) / x["activos"] if x.get("activos") else 0
            liq, m = x.get("liquidez") or 0, x.get("margen_neto") or 0
            s = (min(roe / .2 * 30, 30) if roe > 0 else 0) + (0 if liq < 1 else 15 if liq < 1.5 else 25 if liq < 2.5 else 20) \
                + (0 if end > .8 else 10 if end > .6 else 20 if end > .4 else 25) + (min(m / 10 * 20, 20) if m > 0 else 0)
            if abs(s - x["score"]) > 1:
                dif.append((e["nombre"], anio, round(s, 1), x["score"]))
    check("Índice de salud · registros que no cuadran con la fórmula", 0, len(dif),
          nota="; ".join(f"{n} {a}: {s} vs {b}" for n, a, s, b in dif[:3]))

    # ---------------- DANE
    for f in G["features"]:
        p = f["properties"]
        if p["contexto"]:
            continue
        check(f"DANE · población CNPV 2018 · {p['name']}", {"05266": 212437, "05360": 263332, "05631": 81797,
              "05380": 67881, "05129": 76260}[p["cod"]], p["poblacion"], nota="valor del Marco Geoestadístico; verificar contra DANE")

    # ---------------- coherencia entre fuentes (no es error del tablero; hay que explicarla)
    obs = []
    for cod, nom in MUN.items():
        a = next(x["transacciones"] for x in D["igac"]["anual"] if x["cod"] == cod and x["anio"] == 2023)
        b = next(d["transacciones"] for d in D["dinamica"] if d["cod"] == cod and d["anio"] == 2023 and d["zona"] == "Total")
        obs.append((nom.title(), a, b, (b / a - 1) * 100 if a else None))

    # ---------------- reporte
    ok = sum(r[0] for r in resultados)
    lineas = [f"# Reporte de conciliación de datos", "",
              f"Generado: {datetime.now():%Y-%m-%d %H:%M} · base: `{sys.argv[1]}`", "",
              f"**{ok} de {len(resultados)} controles aprobados.**", "",
              "| Estado | Control | Base (SQL directo) | Tablero | Nota |", "|---|---|---:|---:|---|"]
    fmt = lambda v: "—" if v is None else f"{v:,.1f}".replace(",", "X").replace(".", ",").replace("X", ".")
    for r in resultados:
        lineas.append(f"| {'✅' if r[0] else '❌'} | {r[1]} | {fmt(r[2])} | {fmt(r[3])} | {r[4]} |")
    lineas += ["", "## Coherencia entre fuentes IGAC (2023)", "",
               "El Panorama usa *transacciones inmobiliarias* y la sección Mercado usa *dinámica inmobiliaria*. "
               "Son dos productos distintos del IGAC y no cuentan igual; la diferencia debe explicarse al cliente.", "",
               "| Municipio | Transacciones (IGAC) | Dinámica (IGAC) | Diferencia |", "|---|---:|---:|---:|"]
    lineas += [f"| {n} | {fmt(a)} | {fmt(b)} | {fmt(d)} % |" for n, a, b, d in obs]
    (RAIZ / "validacion" / "reporte_datos.md").write_text("\n".join(lineas) + "\n", encoding="utf-8")

    sys.stdout.reconfigure(encoding="utf-8")
    for r in resultados:
        print(("OK   " if r[0] else "FALLA"), r[1], "|", fmt(r[2]), "vs", fmt(r[3]), r[4])
    print(f"\n{ok}/{len(resultados)} controles aprobados · reporte en validacion/reporte_datos.md")
    for n, a, b, d in obs:
        print(f"  Coherencia {n}: transacciones {fmt(a)} · dinámica {fmt(b)} · {fmt(d)} %")
    sys.exit(0 if ok == len(resultados) else 1)


if __name__ == "__main__":
    main()
