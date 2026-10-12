# Guía de validación del tablero

Tres niveles, en este orden. Los dos primeros se repiten cada vez que se actualizan los datos.

| Nivel | Qué prueba | Cómo | Tiempo |
|---|---|---|---|
| 1. Técnico | Que abre, filtra y no muestra errores | `verificar_interfaz.py` (automático) | 2 min |
| 2. Datos | Que cada cifra sale bien de la base y coincide con la fuente oficial | `validar_datos.py` (automático) + muestreo manual | 1–2 h |
| 3. Negocio | Que la Cámara y los usuarios confían en los números y responden sus preguntas | Sesión con el cliente | 1 h |

---

## Nivel 1 · Técnico (automático)

```
python validacion/verificar_interfaz.py                      # copia local
python validacion/verificar_interfaz.py https://davidurr.github.io/inmobiliario-aburra-sur/   # sitio publicado
```
Abre las 8 vistas en Chrome en modo claro, oscuro y celular (390 px). Revisa errores de consola,
textos inválidos («NaN», «undefined») y desborde horizontal. También prueba los filtros, la búsqueda,
el paso del ranking a la ficha y el comparador. Las capturas quedan en `validacion/capturas/` para revisarlas a ojo.

Revisión visual complementaria (5 min): abrir `iniciar_tablero.cmd`, hacer clic en un municipio del mapa,
cambiar el año, descargar un CSV y abrirlo en Excel (las tildes y los decimales deben verse bien),
imprimir una ficha a PDF.

## Nivel 2 · Datos

### 2a. Conciliación con la base (automático)

```
python validacion/validar_datos.py "<ruta>\TableroLonja\datos\lonja.db"
```
Recalcula con SQL directo (sin usar el exportador) 38 cifras del tablero: RUES, IGAC, dinámica, EMIS,
índice de salud y población. Genera `validacion/reporte_datos.md`.

Resultado del 12-10-2026: **36/38 aprobados**. Las 2 alertas son un defecto de la base de la Lonja, no del tablero:
4 empresas de Caldas (Juan Raíces, Posadas Correas, Arreservis, Capital Proyectos e Ideas) aparecen 4 veces
cada una en `stg_emis_financiero`, con los códigos 05129 y 15131. El tablero las cuenta una vez;
**conviene revisar si el Power BI de la Lonja las está sumando 4 veces.**

### 2b. Contraste con las fuentes oficiales (manual, por muestreo)

Anota en cada fila si coincide. Una diferencia menor al 1 % se explica por fechas de corte.

| # | Cifra del tablero | Dónde verla en el tablero | Fuente oficial para comparar |
|---|---|---|---|
| 1 | Envigado: 19.303 transacciones y $5,4 billones en 2023 | Panorama › Comparativo municipal | IGAC: datos abiertos de transacciones inmobiliarias (datos.gov.co, buscar «transacciones inmobiliarias IGAC») |
| 2 | Sabaneta: 28.777 transacciones en 2023 (dinámica) | Mercado › Transacciones por año (tooltip) | IGAC: indicador de dinámica inmobiliaria (datos.gov.co) |
| 3 | 3.507 empresas activas del sector | Tejido empresarial | **La propia Cámara**: pedir el conteo de matrículas activas con CIIU 6810, 6820 y conexas |
| 4 | 5 NIT del ranking siguen activos y matriculados en la CCAS | Radiografía › Directorio | rues.org.co › consulta por NIT |
| 5 | Inversiones Ferbienes: ingresos 2024 de $195 mil millones | Ficha de empresa | Supersociedades: Portal de Información Empresarial (SIIS/PIE), estados financieros 2024 |
| 6 | Hacienda El Portal, Synergix y Fasivar: ingresos 2024 | Comparador | Mismo portal de Supersociedades |
| 7 | Inversiones Anata 2024: $317 mil millones (marcado como atípico) | Ficha › año 2024 | Supersociedades: confirmar si es un error de unidades. Si es real, quitar la marca |
| 8 | Población de Envigado: 212.437 | Panorama › Comparativo | DANE: CNPV 2018 por municipio |

Para la muestra de empresas conviene tomar además 5 NIT al azar del ranking, no solo las más grandes.

### 2c. Diferencia que hay que poder explicar

El Panorama usa **transacciones inmobiliarias** del IGAC y la sección Mercado usa **dinámica inmobiliaria** del IGAC.
Son productos distintos y en 2023 la dinámica cuenta entre 25 % (Envigado) y 102 % (La Estrella) más.
La explicación está en las fichas metodológicas que la Lonja ya tiene en `datos/referencia/oic/`
(Metadato_Transacciones_V2 y Metadato_indicador_dinamica). Antes de la demostración, confirmar qué
incluye cada una y ajustar la nota de la sección Metodología.

## Nivel 3 · Negocio (sesión con el cliente)

Una sesión de una hora con 2–4 personas de la Cámara (planeación/estudios económicos y desarrollo empresarial)
y, si es posible, un empresario inmobiliario.

1. **Las cifras que conocen (15 min).** Pedirles 3 datos que manejen de memoria (empresas del sector, municipio
   más dinámico, alguna empresa grande) y buscarlos en vivo. Es la prueba de confianza más rápida.
2. **Tareas reales (20 min).** Que ellos manejen el tablero, sin guía, y anotar dónde dudan:
   - «¿Qué municipio tuvo más transacciones por habitante en 2023?»
   - «¿Cuántas empresas del sector renovaron matrícula este año?»
   - «Busque una empresa que conozcan y díganme si su diagnóstico tiene sentido.»
   - «¿Qué empresas medianas tienen problemas de liquidez?»
3. **Diagnóstico y ruta (15 min).** Revisar 3 fichas con el equipo de fortalecimiento: ¿las alertas coinciden
   con lo que saben de esas empresas? ¿La ruta hacia EMFORMA, Centro de Excelencia Operacional o Consultorio
   es la que ellos recomendarían? Ajustar umbrales (liquidez < 1, endeudamiento > 70 %) según su criterio.
4. **Lo que falta (10 min).** ¿Qué pregunta no responde? ¿Con qué frecuencia lo usarían y quién?

Criterios de aceptación sugeridos:
- Ninguna cifra contrastada en el nivel 2b difiere más de 1 % sin explicación.
- Los usuarios completan al menos 3 de las 4 tareas sin ayuda.
- El equipo de fortalecimiento está de acuerdo con el diagnóstico en al menos 2 de las 3 fichas revisadas.

## Registro

| Fecha | Nivel | Responsable | Resultado | Ajustes |
|---|---|---|---|---|
| 2026-10-12 | 1 | Automático | Sin fallas (24 vistas + 5 flujos) | Corregido desborde en Metodología a 390 px |
| 2026-10-12 | 1 | Automático (sitio publicado) | Sin fallas en https://davidurr.github.io/inmobiliario-aburra-sur/ | — |
| 2026-10-12 | 2a | Automático | 36/38; 2 alertas de la base de origen | Duplicados EMIS de Caldas documentados |
| | 2b | | | |
| | 3 | | | |
