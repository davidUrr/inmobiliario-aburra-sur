"""Prueba automática de la interfaz en Chrome: abre las 8 vistas en claro, oscuro y celular,
detecta errores de consola y textos inválidos (NaN, undefined), prueba filtros, búsqueda,
ranking -> ficha y comparador, y guarda capturas en validacion/capturas/.

Requisitos: pip install playwright  (usa el Chrome instalado; no descarga navegadores)
Uso: python validacion/verificar_interfaz.py [url publicada]
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
# sin argumento prueba la copia local; con argumento, una URL publicada (p. ej. GitHub Pages)
URL = sys.argv[1].rstrip("/") + "/index.html" if len(sys.argv) > 1 else (RAIZ / "web" / "index.html").as_uri()
SAL = RAIZ / "validacion" / "capturas"
SAL.mkdir(parents=True, exist_ok=True)
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
RUTAS = ["observatorio/resumen", "observatorio/mercado", "observatorio/tejido", "observatorio/finanzas",
         "observatorio/metodologia", "radiografia/ficha", "radiografia/comparador", "radiografia/ranking"]
fallas = []


def revisar(pg, etiqueta, errores):
    txt = pg.inner_text("main")
    malos = [w for w in ("NaN", "undefined", "Infinity", "[object") if w in txt]
    ancho = pg.evaluate("document.documentElement.scrollWidth")
    vista = pg.viewport_size["width"]
    problemas = errores[:] + ([f"texto inválido: {malos}"] if malos else []) + \
        ([f"desborde horizontal: {ancho}px > {vista}px"] if ancho > vista + 1 else [])
    print(("OK   " if not problemas else "FALLA"), etiqueta, "" if not problemas else problemas)
    if problemas:
        fallas.append((etiqueta, problemas))


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME)
        for tema, ancho in (("light", 1440), ("dark", 1440), ("light", 390)):
            pg = b.new_page(viewport={"width": ancho, "height": 900}, color_scheme=tema)
            errores = []
            pg.on("console", lambda m: errores.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda e: errores.append(str(e)))
            for r in RUTAS:
                errores.clear()
                pg.goto(URL + "#" + r)
                pg.reload()
                pg.wait_for_timeout(1000)
                pg.screenshot(path=str(SAL / f"{tema}_{ancho}_{r.replace('/', '_')}.png"), full_page=True)
                revisar(pg, f"{tema} {ancho}px · {r}", errores)
            pg.close()

        # flujos de uso
        pg = b.new_page(viewport={"width": 1440, "height": 900})
        errores = []
        pg.on("pageerror", lambda e: errores.append(str(e)))
        pg.goto(URL + "#observatorio/finanzas"); pg.wait_for_timeout(800)
        pg.click('[data-mun="05631"]'); pg.wait_for_timeout(400)
        paso = "27 empresas" in pg.inner_text(".kpi .contexto")
        print("OK   " if paso else "FALLA", "filtro Sabaneta cambia los indicadores")
        pg.click('#subnav button[data-sec="mercado"]'); pg.wait_for_timeout(400)
        paso = pg.get_attribute('[data-mun="05631"]', "aria-pressed") == "true"
        print("OK   " if paso else "FALLA", "el filtro se conserva al cambiar de sección")
        pg.click('.selector-tablero [data-tablero="radiografia"]'); pg.click('#subnav button[data-sec="ranking"]'); pg.wait_for_timeout(400)
        nombre = pg.inner_text("#tabRank tbody tr:nth-child(2) td:nth-child(2)")
        pg.click("#tabRank tbody tr:nth-child(2)"); pg.wait_for_timeout(700)
        paso = pg.inner_text(".ficha h2") == nombre
        print("OK   " if paso else "FALLA", "clic en el ranking abre la ficha de esa empresa")
        pg.fill("#buscaEmp", "Synergix S.A.S. · NIT 901259188"); pg.dispatch_event("#buscaEmp", "change"); pg.wait_for_timeout(700)
        paso = pg.inner_text(".ficha h2") == "Synergix S.A.S."
        print("OK   " if paso else "FALLA", "buscador por nombre/NIT")
        pg.click("#btnComparar"); pg.wait_for_timeout(700)
        paso = pg.locator("#chipsComp .chip").count() == 4
        print("OK   " if paso else "FALLA", "comparador se completa con 4 empresas")
        if errores:
            fallas.append(("flujos", errores))
        b.close()
    print(f"\n{'SIN FALLAS' if not fallas else f'{len(fallas)} FALLAS'} · capturas en {SAL}")
    sys.exit(1 if fallas else 0)


if __name__ == "__main__":
    main()
