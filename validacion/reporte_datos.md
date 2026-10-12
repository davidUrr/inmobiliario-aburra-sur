# Reporte de conciliación de datos

Generado: 2026-10-12 18:21 · base: `<ruta>/TableroLonja/datos/lonja.db`

**36 de 38 controles aprobados.**

| Estado | Control | Base (SQL directo) | Tablero | Nota |
|---|---|---:|---:|---|
| ✅ | RUES · empresas activas cámara 55 | 3.507,0 | 3.507,0 |  |
| ✅ | RUES · matriculadas en 2025 | 323,0 | 323,0 |  |
| ✅ | RUES · renovaron en 2025 | 2.349,0 | 2.349,0 |  |
| ✅ | RUES · medianas y grandes | 22,0 | 22,0 |  |
| ✅ | IGAC · transacciones Aburrá Sur 2021 | 37.536,0 | 37.536,0 |  |
| ✅ | IGAC · valor transado 2021 (millones) | 7.908.633,3 | 7.908.633,3 |  |
| ✅ | IGAC · folios nuevos 2021 | 5.778,0 | 5.778,0 |  |
| ✅ | IGAC · transacciones Aburrá Sur 2022 | 61.376,0 | 61.376,0 |  |
| ✅ | IGAC · valor transado 2022 (millones) | 14.048.469,0 | 14.048.469,1 |  |
| ✅ | IGAC · folios nuevos 2022 | 5.907,0 | 5.907,0 |  |
| ✅ | IGAC · transacciones Aburrá Sur 2023 | 53.676,0 | 53.676,0 |  |
| ✅ | IGAC · valor transado 2023 (millones) | 11.510.772,2 | 11.510.772,2 |  |
| ✅ | IGAC · folios nuevos 2023 | 4.216,0 | 4.216,0 |  |
| ✅ | IGAC · transacciones 2023 · Envigado | 19.303,0 | 19.303,0 |  |
| ✅ | IGAC · transacciones 2023 · Itag | 10.887,0 | 10.887,0 |  |
| ✅ | IGAC · transacciones 2023 · Sabaneta | 16.950,0 | 16.950,0 |  |
| ✅ | IGAC · transacciones 2023 · La Estrella | 3.484,0 | 3.484,0 |  |
| ✅ | IGAC · transacciones 2023 · Caldas | 3.052,0 | 3.052,0 |  |
| ✅ | Dinámica · transacciones 2023 · Envigado | 24.193,0 | 24.193,0 |  |
| ✅ | Dinámica · transacciones 2023 · Itag | 14.388,0 | 14.388,0 |  |
| ✅ | Dinámica · transacciones 2023 · Sabaneta | 28.777,0 | 28.777,0 |  |
| ✅ | Dinámica · transacciones 2023 · La Estrella | 7.048,0 | 7.048,0 |  |
| ✅ | Dinámica · transacciones 2023 · Caldas | 4.608,0 | 4.608,0 |  |
| ✅ | EMIS · empresas en Aburrá Sur | 159,0 | 159,0 |  |
| ❌ | Fuente · filas EMIS repetidas 2023 (defecto de lonja.db) | 0,0 | 12,0 | el tablero deduplica por NIT; el Power BI de la Lonja podría estar sumándolas |
| ✅ | EMIS · empresas con ingresos 2023 | 152,0 | 152,0 |  |
| ✅ | EMIS · ingresos 2023 sin depurar (millones) | 526.804,0 | 526.803,9 |  |
| ✅ | EMIS · ingresos 2023 depurados (millones) | 526.804,0 | 526.803,9 | 0 registro(s) atípico(s) excluido(s) |
| ❌ | Fuente · filas EMIS repetidas 2024 (defecto de lonja.db) | 0,0 | 12,0 | el tablero deduplica por NIT; el Power BI de la Lonja podría estar sumándolas |
| ✅ | EMIS · empresas con ingresos 2024 | 147,0 | 147,0 |  |
| ✅ | EMIS · ingresos 2024 sin depurar (millones) | 1.071.610,8 | 1.071.610,8 |  |
| ✅ | EMIS · ingresos 2024 depurados (millones) | 754.240,0 | 754.240,0 | 1 registro(s) atípico(s) excluido(s) |
| ✅ | Índice de salud · registros que no cuadran con la fórmula | 0,0 | 0,0 |  |
| ✅ | DANE · población CNPV 2018 · Envigado | 212.437,0 | 212.437,0 | valor del Marco Geoestadístico; verificar contra DANE |
| ✅ | DANE · población CNPV 2018 · Caldas | 76.260,0 | 76.260,0 | valor del Marco Geoestadístico; verificar contra DANE |
| ✅ | DANE · población CNPV 2018 · Itagüí | 263.332,0 | 263.332,0 | valor del Marco Geoestadístico; verificar contra DANE |
| ✅ | DANE · población CNPV 2018 · Sabaneta | 81.797,0 | 81.797,0 | valor del Marco Geoestadístico; verificar contra DANE |
| ✅ | DANE · población CNPV 2018 · La Estrella | 67.881,0 | 67.881,0 | valor del Marco Geoestadístico; verificar contra DANE |

## Coherencia entre fuentes IGAC (2023)

El Panorama usa *transacciones inmobiliarias* y la sección Mercado usa *dinámica inmobiliaria*. Son dos productos distintos del IGAC y no cuentan igual; la diferencia debe explicarse al cliente.

| Municipio | Transacciones (IGAC) | Dinámica (IGAC) | Diferencia |
|---|---:|---:|---:|
| Envigado | 19.303,0 | 24.193,0 | 25,3 % |
| Itag | 10.887,0 | 14.388,0 | 32,2 % |
| Sabaneta | 16.950,0 | 28.777,0 | 69,8 % |
| La Estrella | 3.484,0 | 7.048,0 | 102,3 % |
| Caldas | 3.052,0 | 4.608,0 | 51,0 % |
