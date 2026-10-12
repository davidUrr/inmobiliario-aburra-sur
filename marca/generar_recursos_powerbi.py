"""Genera el tema y los fondos de Power BI con el sistema visual CCAS.

Salida en marca/powerbi/:
  tema_powerbi_ccas.json        tema importable (Vista > Temas > Buscar temas)
  fondos/fondo_portada.png      1280x720, portada
  fondos/fondo_pagina.png       1280x720, páginas de análisis (banda + logo; el título va como cuadro de texto)
  fondos/fondo_pagina_filtros.png  igual, con columna izquierda para segmentadores

Uso: python marca/generar_recursos_powerbi.py
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

MARCA = Path(__file__).resolve().parent
SAL = MARCA / "powerbi"
(SAL / "fondos").mkdir(parents=True, exist_ok=True)

AZUL, AZUL_PROF, CIAN = "#004FA3", "#003670", "#25C0EC"
FONDO, SUPERFICIE, BORDE = "#EEF4FA", "#FFFFFF", "#DEE7EF"
TINTA, TINTA_2, TINTA_3 = "#202A32", "#53616E", "#6B7B8A"
DATOS = ["#1F6FD1", "#E8743B", "#0FA38C", "#D99A00", "#C2508F", "#6A5ACD"]
W, H = 1280, 720


def fuente(nombre, peso, tam):
    f = ImageFont.truetype(str(MARCA / "fuentes" / nombre), tam)
    try:
        f.set_variation_by_axes([peso])
    except Exception:
        pass
    return f


def logo(variante, alto):
    im = Image.open(MARCA / "logos" / f"ccas_logo_{variante}.png").convert("RGBA")
    return im.resize((round(im.width * alto / im.height), alto), Image.LANCZOS)


def banda(im, alto=64):
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, alto], fill=AZUL)
    d.rectangle([0, alto, W, alto + 4], fill=CIAN)
    lg = logo("negativo", 34)
    im.alpha_composite(lg, (24, (alto - lg.height) // 2))
    x = 24 + lg.width + 18
    d.line([(x, 16), (x, alto - 16)], fill=(255, 255, 255, 90), width=1)


def pie(im):
    d = ImageDraw.Draw(im)
    d.text((24, H - 22), "Inteligencia Inmobiliaria · Aburrá Sur", font=fuente("Raleway-Variable.ttf", 500, 11), fill=TINTA_3)


# ---------------------------------------------------------------- portada
im = Image.new("RGBA", (W, H), AZUL)
d = ImageDraw.Draw(im)
# arcos concéntricos inspirados en el isotipo circular
for i, (r, col, a) in enumerate([(520, AZUL_PROF, 255), (400, "#0A5DB5", 255), (290, CIAN, 60)]):
    capa = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(capa).ellipse([W - 260 - r, H // 2 - r, W - 260 + r, H // 2 + r],
                                 outline=Image.new("RGB", (1, 1), col).getpixel((0, 0)) + (a,), width=46)
    im.alpha_composite(capa)
d.rectangle([0, H - 8, W, H], fill=CIAN)
im.alpha_composite(logo("negativo", 64), (64, 64))
d.text((64, 250), "Inteligencia Inmobiliaria", font=fuente("Montserrat-Variable.ttf", 800, 54), fill="white")
d.text((64, 318), "Aburrá Sur", font=fuente("Montserrat-Variable.ttf", 800, 54), fill=CIAN)
d.text((64, 402), "Envigado · Itagüí · Sabaneta · La Estrella · Caldas",
       font=fuente("Raleway-Variable.ttf", 500, 22), fill=(255, 255, 255, 220))
d.text((64, 640), "Mercado inmobiliario · Tejido empresarial · Desempeño financiero",
       font=fuente("Raleway-Variable.ttf", 500, 16), fill=(255, 255, 255, 190))
im.convert("RGB").save(SAL / "fondos" / "fondo_portada.png")

# ---------------------------------------------------------------- página de análisis
im = Image.new("RGBA", (W, H), FONDO)
banda(im)
pie(im)
im.convert("RGB").save(SAL / "fondos" / "fondo_pagina.png")

# ---------------------------------------------------------------- página con columna de filtros
im = Image.new("RGBA", (W, H), FONDO)
banda(im)
d = ImageDraw.Draw(im)
d.rounded_rectangle([16, 84, 216, H - 32], radius=10, fill=SUPERFICIE, outline=BORDE)
d.text((32, 98), "FILTROS", font=fuente("Montserrat-Variable.ttf", 700, 11), fill=TINTA_3)
pie(im)
im.convert("RGB").save(SAL / "fondos" / "fondo_pagina_filtros.png")

# ---------------------------------------------------------------- tema
tarjeta = {"background": [{"show": True, "color": {"solid": {"color": SUPERFICIE}}, "transparency": 0}],
           "border": [{"show": True, "color": {"solid": {"color": BORDE}}, "radius": 10}],
           "dropShadow": [{"show": False}],
           "title": [{"show": True, "fontColor": {"solid": {"color": TINTA}}, "fontFamily": "Segoe UI Semibold",
                      "fontSize": 12, "alignment": "left"}],
           "padding": [{"top": 12, "bottom": 12, "left": 14, "right": 14}]}
tema = {
    "name": "CCAS Inteligencia Inmobiliaria",
    "dataColors": DATOS + ["#8C99A6", "#0B4F9E", "#6FA6E4", "#A9CBF0"],
    "foreground": TINTA, "foregroundNeutralSecondary": TINTA_2, "foregroundNeutralTertiary": TINTA_3,
    "background": SUPERFICIE, "backgroundLight": FONDO, "backgroundNeutral": BORDE,
    "tableAccent": AZUL, "hyperlink": AZUL,
    "good": "#18794E", "neutral": "#8A5A00", "bad": "#B42318",
    "maximum": "#0B4F9E", "center": "#6FA6E4", "minimum": "#D6E6F8", "null": "#C7D4DF",
    "textClasses": {
        "title": {"fontFace": "Segoe UI Semibold", "fontSize": 12, "color": TINTA},
        "header": {"fontFace": "Segoe UI Semibold", "fontSize": 12, "color": TINTA},
        "label": {"fontFace": "Segoe UI", "fontSize": 10, "color": TINTA_2},
        "callout": {"fontFace": "Segoe UI Semibold", "fontSize": 28, "color": TINTA},
    },
    "visualStyles": {
        "*": {"*": tarjeta | {
            "categoryAxis": [{"gridlineColor": {"solid": {"color": "#E6EDF3"}}, "labelColor": {"solid": {"color": TINTA_2}}}],
            "valueAxis": [{"gridlineColor": {"solid": {"color": "#E6EDF3"}}, "labelColor": {"solid": {"color": TINTA_3}}}],
            "legend": [{"labelColor": {"solid": {"color": TINTA_2}}, "fontSize": 9}],
        }},
        "page": {"*": {"background": [{"color": {"solid": {"color": FONDO}}, "transparency": 0}],
                       "outspace": [{"color": {"solid": {"color": FONDO}}}]}},
        "card": {"*": {"labels": [{"color": {"solid": {"color": TINTA}}, "fontSize": 26, "fontFamily": "Segoe UI Semibold"}],
                       "categoryLabels": [{"color": {"solid": {"color": TINTA_3}}, "fontSize": 9}],
                       "border": [{"show": True, "color": {"solid": {"color": AZUL}}, "radius": 10}]}},
        "slicer": {"*": {"items": [{"fontColor": {"solid": {"color": TINTA}}}],
                         "header": [{"fontColor": {"solid": {"color": TINTA_3}}, "fontSize": 9}]}},
        "tableEx": {"*": {"columnHeaders": [{"fontColor": {"solid": {"color": "#FFFFFF"}}, "backColor": {"solid": {"color": AZUL}}}],
                          "values": [{"fontColorPrimary": {"solid": {"color": TINTA}}, "backColorSecondary": {"solid": {"color": "#F6F9FC"}}}]}},
        "textbox": {"*": {"background": [{"show": False}], "border": [{"show": False}]}},
        "image": {"*": {"background": [{"show": False}], "border": [{"show": False}]}},
        "shape": {"*": {"background": [{"show": False}], "border": [{"show": False}]}},
    },
}
(SAL / "tema_powerbi_ccas.json").write_text(json.dumps(tema, ensure_ascii=False, indent=2), encoding="utf-8")
print("Recursos generados en", SAL)
