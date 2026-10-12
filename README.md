# Inteligencia Inmobiliaria · Aburrá Sur

Demostrador de tableros del sector inmobiliario para la jurisdicción de la Cámara de Comercio Aburrá Sur
(Envigado, Itagüí, Sabaneta, La Estrella y Caldas). Su objetivo es mostrar capacidades concretas
con datos reales para respaldar la venta de la solución.

**Página pública:** https://davidurr.github.io/inmobiliario-aburra-sur/

**Abrir localmente:** doble clic en `iniciar_tablero.cmd` (o abrir `web/index.html` en Chrome/Edge). No requiere servidor.
Las fuentes tipográficas se cargan de Google Fonts; sin internet se usa Segoe UI.

## Contenido

```
tablero_inmobiliario/
├─ marca/                 Sistema visual reutilizable (logos, tokens, fuentes, tema y fondos Power BI)
│  └─ SISTEMA_VISUAL.md   Reglas y valores de color validados
├─ etl/exportar_datos.py  Filtra la base del Tablero Lonja para Aburrá Sur y genera web/data/*.js
├─ web/
│  ├─ index.html          Los dos tableros
│  ├─ guia-marca.html     Guía visual navegable
│  ├─ app.js              Núcleo: rutas, formato, tema, utilidades de gráficos
│  ├─ observatorio.js     Tablero 1
│  ├─ radiografia.js      Tablero 2
│  ├─ assets/ data/ vendor/ (ECharts 5.5.1 local)
└─ iniciar_tablero.cmd
```

## Tablero 1 · Observatorio sectorial

Rediseño de los paneles del Tablero Lonja (Power BI) acotados a la jurisdicción.

| Sección | Qué responde | Panel Lonja de origen |
|---|---|---|
| Panorama | ¿Cómo está el mercado y cuál municipio lidera? Mapa per cápita, mensajes clave automáticos, comparativo municipal | Inicio |
| Mercado inmobiliario | Transacciones 2015–2023, intensidad, valor promedio, folios nuevos y actos jurídicos | Dinámica inmobiliaria · Mercado y demanda |
| Tejido empresarial | Empresas activas por segmento, tamaño, tipo societario, cohortes, renovación y supervivencia | Empresas |
| Desempeño financiero | Ingresos agregados, salud financiera, top 10, tamaño vs. rentabilidad, IHH, medianas por tamaño | Indicadores financieros · Inteligencia competitiva |
| Metodología | Flujo de datos, cobertura, notas de calidad y capacidades | Metodología |

## Tablero 2 · Radiografía empresarial

Decisión: del tablero UdeM (Streamlit: comercio exterior + finanzas de competidores) **no se reutilizó el
módulo aduanero**, porque las empresas inmobiliarias casi no importan ni exportan. Sí se reutilizaron y
ampliaron tres ideas: el módulo *Inteligencia financiera de competidores* (tendencias, comparativa y detalle),
el *año de referencia* (último año con datos de al menos la mitad de las empresas) y la *guía de lectura* por módulo.
El resultado es un tablero por empresa (NIT), que es lo que más diferencia la oferta:

| Sección | Capacidad |
|---|---|
| Ficha de empresa | Índice de salud 0–100 con sus componentes, percentiles frente a pares del mismo segmento y tamaño, tendencias con banda P25–P75, **diagnóstico automático con ruta de programas de la Cámara** (EMFORMA, Centro de Excelencia Operacional, Consultorio Empresarial, Transformación Digital), impresión a PDF |
| Comparador | Hasta 4 empresas lado a lado con percentiles |
| Directorio y ranking | 146 empresas, orden por cualquier indicador, filtros y descarga CSV |

La ruta sugerida conecta el tablero con la plataforma PRODINTIA (diagnóstico → plan → seguimiento).

## Proceso seguido

1. **Diagnóstico de los insumos.** Tablero Lonja: base SQLite con 23 tablas (IGAC, RUES, EMIS, DANE, GEIH) y
   ETL en Python. Tablero UdeM: app Streamlit con base de comercio exterior y 70 registros financieros de competidores.
2. **Identidad CCAS.** Se descargó el logotipo y la hoja de estilos de ccas.org.co y se extrajeron colores y
   tipografías reales (el kit anterior de `../branding/` tenía colores provisionales).
3. **Sistema visual.** Separación entre colores de identidad y de datos; paleta categórica validada para
   daltonismo en claro y oscuro; tema y fondos de Power BI para rediseñar el tablero Lonja con la misma marca.
4. **Datos.** Se filtró la jurisdicción: RUES código de cámara 55 (verificado cruzando NIT con municipios de EMIS),
   DIVIPOLA de los 5 municipios en IGAC y EMIS.
5. **Control de calidad.** Se corrigió Caldas (Antioquia) codificado como Caldas (Boyacá); se marcó como atípico
   un registro con ingresos 96 veces sus activos y se excluye de agregados; las variaciones anuales usan panel
   balanceado (mismas empresas en ambos años); el endeudamiento se calcula como pasivo/activo porque el campo
   de EMIS solo cubre deuda financiera.
6. **Construcción y verificación.** Las 8 vistas se renderizaron en Chrome sin errores de consola, en claro,
   oscuro y a 390 px de ancho.

## Validar

Ver `validacion/VALIDACION.md`. Automático, después de cada actualización:
```
python validacion/verificar_interfaz.py
python validacion/validar_datos.py "<ruta>\TableroLonja\datos\lonja.db"
```

## Actualizar los datos

```
python etl/exportar_datos.py "<ruta>\TableroLonja\datos\lonja.db"
```
Primero se corre el ETL de la Lonja (`ejecutar_etl.bat`) con las fuentes nuevas.
Para regenerar el tema y los fondos de Power BI: `python marca/generar_recursos_powerbi.py`.

## Rediseñar el Power BI de la Lonja con esta marca

1. Vista › Temas › Buscar temas › `marca/powerbi/tema_powerbi_ccas.json`.
2. Lienzo › Imagen de fondo: `fondo_portada.png` en Inicio y `fondo_pagina.png` / `fondo_pagina_filtros.png`
   en las demás (ajuste «Ajustar», transparencia 0 %). Lienzo 1280×720.
3. Filtro de página: municipio en los 5 DIVIPOLA y `codigo_camara = 55` para las tablas del RUES.

## Limitaciones

- El RUES no trae municipio: el tejido empresarial se reporta para toda la jurisdicción.
- Valores de transacciones IGAC solo 2021–2023; dinámica 2015–2023; supervivencia solo departamental.
- EMIS cubre sociedades que reportan a Supersociedades (146 en 2024), no todas las microempresas.
- Datos EMIS licenciados: revisar condiciones de uso antes de publicar el tablero fuera de una demostración.
- Logotipo negativo e isotipo derivados del archivo publicado; reemplazar por los oficiales.
