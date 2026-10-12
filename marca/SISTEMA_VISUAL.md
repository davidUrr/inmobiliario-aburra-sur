# Sistema visual de tableros · Cámara de Comercio Aburrá Sur

Versión 1.0 · 12 de octubre de 2026. Kit reutilizable para tableros web y Power BI.
Vista navegable: `web/guia-marca.html`.

> No es el manual oficial de la CCAS. Los valores de identidad se tomaron del sitio público
> ccas.org.co (logotipo publicado y hoja de estilos del tema «ccas», consultados el 12-10-2026).
> Al recibir el manual de Comunicaciones, cambiar solo los valores de `ccas-tablero.tokens.css`;
> los roles se conservan. Este kit reemplaza los colores *provisionales* de `../../branding/`.

## 1. Archivos

| Archivo | Uso |
|---|---|
| `logos/ccas_logo_color.png` | Logotipo a color (recortado del archivo publicado), fondos claros |
| `logos/ccas_logo_negativo.png` | Negativo blanco derivado del mismo archivo, para encabezados azules |
| `logos/ccas_isotipo_color.png` · `ccas_isotipo_negativo.png` | Isotipo circular, para favicon y espacios reducidos |
| `logos/ccas_logo_original_sitio.png` | Archivo tal como lo publica el sitio (1200×327) |
| `ccas-tablero.tokens.css` | Tokens de color, tipografía y espaciado (claro y oscuro) |
| `fuentes/` | Montserrat y Raleway (Google Fonts, licencia OFL) |
| `powerbi/tema_powerbi_ccas.json` | Tema de Power BI |
| `powerbi/fondos/*.png` | Fondos 1280×720: portada, página y página con columna de filtros |
| `generar_recursos_powerbi.py` | Regenera tema y fondos si cambian los valores |

## 2. Identidad (interfaz)

| Rol | HEX | Origen |
|---|---|---|
| Azul institucional | `#004FA3` | color principal del tema web (70 usos en la hoja de estilos) |
| Azul profundo | `#003670` / `#003C7D` | estados hover y fondos oscuros del sitio |
| Cian | `#25C0EC` | acento del sitio (bordes, botones destacados) |
| Índigo del logotipo | `#333C91` | solo dentro del logotipo |
| Tinta / secundaria | `#202A32` / `#53616E` | textos del sitio |
| Fondos | `#EEF4FA` / `#DEE7EF` | fondos y bordes del sitio |

Tipografía del sitio: **Montserrat** (títulos y cifras) y **Raleway** (texto). En Power BI se usa
Segoe UI en el tema porque el servicio web no garantiza fuentes externas; Montserrat queda en los fondos.

## 3. Datos (gráficos)

Los colores de identidad no sirven como series: el azul es muy oscuro y el cian muy claro sobre blanco.
Se derivó una paleta categórica con el azul institucional como primer tono y se validó con el
verificador de paletas (luminosidad, croma, separación para daltonismo y contraste):

| Orden | Entidad fija | Claro | Oscuro |
|---|---|---|---|
| 1 | Envigado | `#1F6FD1` | `#4A8FE8` |
| 2 | Itagüí | `#E8743B` | `#DE6A30` |
| 3 | Sabaneta | `#0FA38C` | `#14A890` |
| 4 | La Estrella | `#D99A00` | `#BE8200` |
| 5 | Caldas | `#C2508F` | `#D2649E` |
| 6 | Extra | `#6A5ACD` | `#8B7FE0` |
| — | Referencia / «Otros» | `#8C99A6` | `#7F8EA0` |

Resultado (claro, superficie blanca): todos los controles aprobados; peor par adyacente para
daltonismo ΔE 10,6; visión normal ΔE 18,3. El ámbar tiene contraste 2,45:1, por lo que siempre va con
etiqueta o leyenda. Los tres primeros tonos se distinguen entre sí en cualquier combinación (mapas y dispersión).
Modo oscuro validado contra `#13233A`.

- **Secuencial** (magnitud, mapas): `#D6E6F8 → #06336A` en un solo tono azul.
- **Estados** (reservados, siempre con ícono y texto): bueno `#18794E`, alerta `#8A5A00`, crítico `#B42318`.

## 4. Reglas

1. El color sigue a la entidad (municipio, empresa) en todo el tablero; al filtrar, lo no elegido pasa a gris.
2. Un solo eje vertical por gráfico; nunca doble eje.
3. Más de 6 categorías: agrupar en «Otros» (gris de referencia).
4. Toda visualización con título, unidad, periodo y fuente.
5. Logotipo: sin redibujar, recolorear parcialmente, deformar ni aplicar sombras. Negativo solo sobre azul.
