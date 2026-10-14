# Metodología

## Fuente, unidad y cobertura

La fuente es el INDEC, Censo Nacional de Población, Hogares y Viviendas 2022.
La unidad estadística son los hogares en viviendas particulares: 15.932.302 hogares,
distribuidos en 527 departamentos de 24 provincias. La cartografía proviene de INDEC/IGN.

Los códigos se conservan como texto: dos dígitos para provincias y cinco para departamentos.
Las filas provinciales y departamentales del CSV se mantienen separadas para evitar duplicar hogares.
La unión cartográfica utiliza el código departamental completo, que ya incluye la provincia.

Los polígonos `94021` y `94028` no tienen datos censales. Se conservan en la cartografía,
planos y con gris rayado y la etiqueta «Sin datos censales». No se interpretan como cero.
Malvinas permanece visible y la Antártida se muestra también en un recuadro.

## Servicios y porcentajes

Se consideran cuatro variables:

- Agua de red (H14): hogares con agua por red pública.
- Cloacas (H18): hogares con desagüe a red pública.
- Gas de red (H19): hogares que cocinan principalmente con gas de red. No indica si la red existe en la zona.
- Internet (H24A): hogares con conexión en la vivienda, excluyendo la conexión celular. No mide velocidad ni calidad.

Para cada servicio, el porcentaje con acceso es `100 × hogares con servicio / hogares totales`.
El porcentaje sin acceso es su complemento, `100 − porcentaje con acceso`.
Las tarjetas muestran el porcentaje con acceso junto con la cantidad de hogares y las medias nacional y provincial.

Los porcentajes provinciales se obtienen de los numeradores y denominadores de
`data/processed/resumen_nacional.json`: `100 × hogares provinciales con servicio / hogares provinciales totales`.
Se utilizan estos totales completos, sin promediar los porcentajes departamentales ni los valores provinciales redondeados.

## Índice de servicios bajo la media

`servicios_bajo_media` cuenta en cuántos de los cuatro servicios el departamento tiene
un porcentaje con acceso menor que la media nacional: 0, 1, 2, 3 o 4.
La igualdad con la media no se cuenta como un servicio bajo la media.
Las medias nacionales del archivo procesado son agua 85,03%, cloacas 61,25%,
gas 52,66% e internet 76,49%.

El índice clasifica territorios. No cuenta hogares sin los cuatro servicios y no constituye
una medida de privaciones simultáneas en un mismo hogar.

## Altura y color del mapa

En la vista nacional se dibujan los departamentos con dos niveles de agregación explícitos:

- **Altura:** el porcentaje provincial de hogares sin el servicio. Todos los departamentos de una provincia comparten la misma altura.
- **Color:** el porcentaje de hogares sin el servicio de cada departamento, con una rampa continua inferno y dominio fijo de 0 a 100.

En la vista Resumen, el color conserva las cinco categorías del índice departamental.
La altura provincial se calcula como la media ponderada de los índices departamentales:

`índice provincial ponderado = suma(índice departamental × hogares del departamento) / suma(hogares de los departamentos)`.

Solo participan departamentos con datos y hogares válidos. El resultado está entre 0 y 4 y puede
ser decimal. No se redondea a una categoría para determinar la altura y no equivale a contar
cuántos porcentajes provinciales están bajo la media nacional. La ponderación representa
la distribución de hogares entre territorios clasificados; no mide servicios faltantes en cada hogar.

Al entrar en una provincia, sus departamentos interpolan durante 600 ms desde la altura
provincial a la departamental: el porcentaje departamental sin servicio o el índice 0–4, según la vista.
Las otras provincias conservan sus alturas provinciales, pasan a opacidad 0,2 y no son interactivas.
Al volver al país se recuperan las alturas provinciales. Se respeta la preferencia de movimiento reducido.

La escala vertical es lineal, sin raíces ni logaritmos. El máximo base es 63.000 unidades visuales,
el 35% de la escala anterior: `altura = porcentaje / 100 × 63.000` para servicios y
`altura = índice / 4 × 63.000` para Resumen. Estas unidades no representan elevación del terreno
ni distancias reales. El realce de selección conserva el aumento visual temporal del 15%,
sin cambiar los valores estadísticos de las tarjetas. En vista plana, todas las alturas se multiplican por cero.

Los bordes se leen mediante las paredes y la iluminación de las extrusiones; no se dibujan capas de línea.
Se conserva la geometría de los archivos procesados, sin separación artificial entre provincias.

## Preparación y límites de interpretación

`scripts/prepare.py` genera los datos procesados y simplifica las geometrías con tolerancia
de 0,005 grados, preservando su topología individual, y coordenadas de cuatro decimales.
La simplificación puede producir pequeñas diferencias visuales entre límites compartidos.
Los originales se conservan sin cambios en `data/raw/`; los derivados están en `data/processed/`.

La visualización muestra brechas entre territorios. No establece causas, distancias recorridas
ni calidad de las redes. Los porcentajes departamentales del GeoJSON están redondeados a un decimal;
las alturas provinciales de servicios se calculan a partir de los totales de hogares para evitar ese redondeo.
