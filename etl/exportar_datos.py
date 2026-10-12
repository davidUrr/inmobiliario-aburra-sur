"""Exporta los datos del tablero inmobiliario Aburrá Sur a web/data/*.js.

Fuente: base SQLite del Tablero Inmobiliario de La Lonja (mismo ETL, mismas tablas stg_*).
Se filtra la jurisdicción de la Cámara de Comercio Aburrá Sur: Envigado, Itagüí, Sabaneta,
La Estrella y Caldas.

Uso:
    python etl/exportar_datos.py "C:/ruta/TableroLonja/datos/lonja.db"
"""
import json
import sqlite3
import sys
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "web" / "data"
MAPA = "datos/referencia/mapas/Colombia_departamentos_municipios_poblacion-topov2.json"

# DIVIPOLA -> nombre de presentación, en orden fijo (el color sigue al municipio)
MUNICIPIOS = {
    "05266": "Envigado",
    "05360": "Itagüí",
    "05631": "Sabaneta",
    "05380": "La Estrella",
    "05129": "Caldas",
}
CONTEXTO = {"05001": "Medellín"}          # solo como referencia en el mapa y en comparaciones
CODIGO_CAMARA_RUES = 55                   # Cámara de Comercio Aburrá Sur en el RUES
ANIO_MIN_RUES = 2010
UMBRAL_ROTACION = 20                      # ingresos/activos por encima de esto => registro atípico

VARIABLES_EMIS = {
    "Total Ingreso Operativo": "ingresos",
    "Activos Totales": "activos",
    "Pasivos Totales": "pasivos",
    "Total de patrimonio": "patrimonio",
    "Ganancia (Pérdida) Neta": "utilidad",
    "Ganancia operativa (EBIT)": "ebit",
    "Margen Neto (%)": "margen_neto",
    "Margen Operacional (%)": "margen_op",
    "Rendimiento Sobre Los Activos (ROA) (%)": "roa",
    "Rendimiento Sobre El Patrimonio (ROE) (%)": "roe",
    "Razón De Liquidez (x)": "liquidez",
}


def sin_tilde(t):
    return (t.upper().replace("Á", "A").replace("É", "E").replace("Í", "I")
            .replace("Ó", "O").replace("Ú", "U").replace("Ü", "U"))


def r(x, n=2):
    return None if x is None else round(float(x), n)


def municipio_por_nombre(nombre):
    n = sin_tilde(nombre or "")
    for cod, nom in MUNICIPIOS.items():
        if sin_tilde(nom) == n:
            return cod
    return None


# --------------------------------------------------------------------------- mapa
def decodificar_topojson(topo, objeto, codigos):
    """TopoJSON (arcos cuantizados y delta) -> lista de features GeoJSON para los códigos pedidos."""
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    arcos = []
    for arco in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arco:
            x += dx
            y += dy
            pts.append([round(x * sx + tx, 5), round(y * sy + ty, 5)])
        arcos.append(pts)

    def anillo(indices):
        pts = []
        for i in indices:
            a = arcos[i] if i >= 0 else list(reversed(arcos[~i]))
            pts.extend(a if not pts else a[1:])
        return pts

    feats = []
    for g in topo["objects"][objeto]["geometries"]:
        p = g["properties"]
        if p["MPIO_CDPMP"] not in codigos:
            continue
        if g["type"] == "Polygon":
            coords = [anillo(a) for a in g["arcs"]]
        else:
            coords = [[anillo(a) for a in poli] for poli in g["arcs"]]
        feats.append({
            "type": "Feature",
            "properties": {
                "cod": p["MPIO_CDPMP"],
                "name": MUNICIPIOS.get(p["MPIO_CDPMP"]) or CONTEXTO[p["MPIO_CDPMP"]],
                "poblacion": p["STP27_PERS"],
                "hogares": p["TSP16_HOG"],
                "area_km2": round(p["AREA"] / 1e6, 1),
                "contexto": p["MPIO_CDPMP"] in CONTEXTO,
            },
            "geometry": {"type": g["type"], "coordinates": coords},
        })
    return feats


# --------------------------------------------------------------------------- territorio
def dinamica(c):
    filas = c.execute("""
        select divipola, ao, zona, inmuebles, transacciones, ndice_de_intensidad, intensidad_de_la_dinmica
        from stg_DinamicaInmobiliaria
        where nivel_territorial='Municipal' and nivel_del_ndice like 'B%sico' and divipola in ({})
        order by divipola, ao""".format(",".join("?" * len(MUNICIPIOS | CONTEXTO))),
        list(MUNICIPIOS | CONTEXTO)).fetchall()
    return [{"cod": d, "anio": a, "zona": z, "inmuebles": i, "transacciones": t,
             "intensidad": r(ix, 4), "nivel": n} for d, a, z, i, t, ix, n in filas]


def igac(c):
    nombres = [sin_tilde(n) for n in MUNICIPIOS.values()]
    filas = c.execute("""
        select municipio, year_radica, tipo_predio_zona, nombre_natujur,
               sum(total_transacciones), sum(valor_total), sum(total_predios_nuevos)
        from stg_igac_agregado where departamento='ANTIOQUIA'
        group by 1,2,3,4""").fetchall()
    anual, actos, zona = {}, {}, {}
    for mun, anio, z, acto, tr, val, nuevos in filas:
        cod = municipio_por_nombre(mun)
        if cod is None and sin_tilde(mun) not in nombres:
            continue
        if cod is None:
            continue
        k = (cod, anio)
        a = anual.setdefault(k, {"cod": cod, "anio": anio, "transacciones": 0, "valor_mm": 0.0, "predios_nuevos": 0})
        a["transacciones"] += tr or 0
        a["valor_mm"] += (val or 0) / 1e6
        a["predios_nuevos"] += nuevos or 0
        if tr:
            ka = (cod, anio, acto)
            actos[ka] = actos.get(ka, 0) + tr
            kz = (cod, anio, z)
            zona[kz] = zona.get(kz, 0) + tr
    # actos: top 6 de la jurisdicción, el resto a "Otros"
    total_acto = {}
    for (_, _, acto), v in actos.items():
        total_acto[acto] = total_acto.get(acto, 0) + v
    top = [a for a, _ in sorted(total_acto.items(), key=lambda x: -x[1])[:6]]
    actos_out = {}
    for (cod, anio, acto), v in actos.items():
        nombre = acto.capitalize() if acto in top else "Otros actos"
        k = (cod, anio, nombre)
        actos_out[k] = actos_out.get(k, 0) + v
    for a in anual.values():
        a["valor_mm"] = round(a["valor_mm"], 1)
    return {
        "anual": sorted(anual.values(), key=lambda x: (x["cod"], x["anio"])),
        "actos": [{"cod": k[0], "anio": k[1], "acto": k[2], "transacciones": v} for k, v in sorted(actos_out.items())],
        "zona": [{"cod": k[0], "anio": k[1], "zona": k[2], "transacciones": v} for k, v in sorted(zona.items())],
    }


# --------------------------------------------------------------------------- RUES
def rues(c):
    filas = c.execute("""
        select sector_ciiu, tamano, tipo_societario, substr(fecha_matricula,1,4), ultimo_ano_renovado
        from stg_empresas where codigo_camara=?""", (CODIGO_CAMARA_RUES,)).fetchall()
    agregado = {}
    for sector, tam, tipo, anio_mat, renov in filas:
        k = (sector, tam, tipo or "Otras", int(anio_mat) if anio_mat else None, int(renov) if renov else None)
        agregado[k] = agregado.get(k, 0) + 1
    return [{"sector": k[0], "tamano": k[1], "tipo": k[2],
             "anio_matricula": k[3] if k[3] and k[3] >= ANIO_MIN_RUES else (f"<{ANIO_MIN_RUES}" if k[3] else None),
             "ultimo_renovado": k[4], "n": n} for k, n in agregado.items()]


def supervivencia(c):
    filas = c.execute("""
        select anios_desde_matricula, sector_ciiu, sum(iniciales), sum(sobrevivientes)
        from stg_supervivencia where departamento='ANTIOQUIA' and anios_desde_matricula<=10
        group by 1,2""").fetchall()
    return [{"anios": a, "sector": s, "iniciales": i, "sobrevivientes": v} for a, s, i, v in filas]


# --------------------------------------------------------------------------- EMIS
def emis(c):
    filas = c.execute("""
        select conit, compaa, ciudad, cod_dane_mun, cdigos_de_actividades_principales_local,
               sector_ciiu, tamano_ingresos, year, variable, valor, score_salud, nivel_salud_score
        from stg_emis_financiero where cod_dane_dep in (5, '05')""").fetchall()
    empresas = {}
    for nit, nom, ciudad, mun, ciiu, sector, tam, anio, var, val, score, nivel in filas:
        cod = f"{int(mun):05d}" if mun else None
        if cod == "15131" and sin_tilde(ciudad or "") == "CALDAS":   # Caldas (Antioquia) mal codificado en la fuente
            cod = "05129"
        if cod not in MUNICIPIOS:
            continue
        nit = str(int(nit)) if isinstance(nit, float) else str(nit)
        e = empresas.setdefault(nit, {"nit": nit, "nombre": nom, "cod": cod, "ciiu": (ciiu or "").split(";")[0] or None,
                                      "sector": sector, "tamano": tam, "anios": {}})
        a = e["anios"].setdefault(str(anio), {})
        if var in VARIABLES_EMIS:
            a[VARIABLES_EMIS[var]] = r(val, 3)
        if score is not None:
            a["score"] = r(score, 1)
            a["nivel"] = nivel
    # indicadores calculados y control de calidad
    for e in empresas.values():
        for a in e["anios"].values():
            act, pas, pat, ut, ing = (a.get(k) for k in ("activos", "pasivos", "patrimonio", "utilidad", "ingresos"))
            # endeudamiento total (pasivo/activo): el campo "Deuda/Activos" de EMIS solo cubre deuda financiera
            a["deuda_activos"] = r(pas / act * 100, 2) if act and pas is not None else None
            if a.get("roe") is None and pat and pat > 0 and ut is not None:
                a["roe"] = r(ut / pat * 100, 2)
            if ing and act and ing / act > UMBRAL_ROTACION:
                a["atipico"] = f"Ingresos {ing / act:.0f} veces los activos: posible error de unidades en la fuente"
    # cuota de mercado por ingresos dentro de Aburrá Sur (sin registros atípicos)
    totales = {}
    for e in empresas.values():
        for anio, a in e["anios"].items():
            if not a.get("atipico"):
                totales[anio] = totales.get(anio, 0) + max(a.get("ingresos") or 0, 0)
    for e in empresas.values():
        for anio, a in e["anios"].items():
            ing = max(a.get("ingresos") or 0, 0)
            a["cuota"] = r(ing / totales[anio], 5) if totales[anio] and not a.get("atipico") else None
    return sorted(empresas.values(), key=lambda e: e["nombre"])


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    db = Path(sys.argv[1])
    raiz_lonja = db.parent.parent
    c = sqlite3.connect(db)
    SALIDA.mkdir(parents=True, exist_ok=True)

    topo = json.loads((raiz_lonja / MAPA).read_text(encoding="utf-8"))
    geo = {"type": "FeatureCollection",
           "features": decodificar_topojson(topo, "MGN_ANM_MPIOS", set(MUNICIPIOS) | set(CONTEXTO))}

    datos = {
        "meta": {
            "generado": date.today().isoformat(),
            "jurisdiccion": "Cámara de Comercio Aburrá Sur",
            "municipios": [{"cod": k, "nombre": v} for k, v in MUNICIPIOS.items()],
            "contexto": [{"cod": k, "nombre": v} for k, v in CONTEXTO.items()],
            "fuentes": {
                "dinamica": "IGAC · Observatorio Inmobiliario Catastral, índice de dinámica inmobiliaria (2015–2023)",
                "igac": "IGAC · Transacciones inmobiliarias por municipio (valores 2021–2023; folios nuevos 2015–2023)",
                "rues": "RUES · Registro mercantil, matrículas activas de la Cámara de Comercio Aburrá Sur (código 55)",
                "supervivencia": "RUES · Cohortes de supervivencia empresarial, Antioquia",
                "emis": "EMIS · Estados financieros reportados a Supersociedades (2020–2024), millones de COP",
                "mapa": "DANE · Marco Geoestadístico Nacional 2018; población y hogares CNPV 2018",
            },
        },
        "dinamica": dinamica(c),
        "igac": igac(c),
        "rues": rues(c),
        "supervivencia": supervivencia(c),
        "empresas": emis(c),
    }
    (SALIDA / "datos.js").write_text(
        "window.DATOS = " + json.dumps(datos, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    (SALIDA / "geo.js").write_text(
        "window.GEO_ABURRA_SUR = " + json.dumps(geo, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(f"empresas EMIS: {len(datos['empresas'])} | registros RUES agrupados: {len(datos['rues'])} | "
          f"dinámica: {len(datos['dinamica'])} | geo: {len(geo['features'])} municipios")


if __name__ == "__main__":
    main()
