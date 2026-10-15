# Metodología

## 1. Pregunta

¿Cuánto cambia el acceso de los hogares a cuatro servicios básicos —agua de red, cloacas, gas de red e internet— según el departamento del país donde viven?

La visualización describe **brechas entre territorios**. No establece causas, distancias recorridas ni calidad de las redes.

## 2. Fuente, unidad y cobertura

- **Fuente:** INDEC, Censo Nacional de Población, Hogares y Viviendas 2022. Cuadros de hogares publicados por jurisdicción y departamento, con verificaciones puntuales en REDATAM.
- **Unidad estadística:** hogares en viviendas particulares. Total: **15.932.302 hogares**.
- **Cobertura:** 527 departamentos, partidos y comunas de 24 jurisdicciones.
- **Cartografía:** INDEC (GeoNode), con base geométrica del IGN. La capa de departamentos tiene 529 polígonos.

Las cuatro variables provienen del mismo operativo, el mismo año, la misma unidad y el mismo nivel geográfico. No se combinan fuentes con definiciones distintas.

## 3. Variables

| Servicio    | Variable | Definición utilizada                                                                                                            | Qué no mide                                                                            |
| ----------- | -------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Agua de red | H14      | Hogares cuya fuente de agua **para beber y cocinar** es la red pública. La provisión puede estar dentro o fuera de la vivienda. | Continuidad, presión ni calidad del agua.                                              |
| Cloacas     | H18      | Hogares con desagüe del inodoro a red pública. El denominador incluye **todos** los hogares, también los que no tienen baño.    | Estado de la red ni tratamiento de efluentes.                                          |
| Gas de red  | H19      | Hogares que usan **principalmente gas de red para cocinar**.                                                                    | Si la red pasa por la zona; un hogar con red puede cocinar con electricidad o garrafa. |
| Internet    | H24A     | Hogares con conexión a internet **en la vivienda**. Excluye el acceso solo por teléfono celular (H24B).                         | Velocidad, estabilidad, tecnología ni costo.                                           |

## 4. Cálculos

**Porcentaje con acceso:** `100 × hogares con el servicio / hogares totales` del territorio.

**Porcentaje sin acceso:** `100 − porcentaje con acceso`. Es la variable que representan la altura y el color del mapa.

**Agregados provinciales y nacionales:** se calculan sumando numeradores y denominadores de los departamentos. **Nunca se promedian porcentajes**, porque eso daría el mismo peso a un departamento de 500 hogares que a uno de 500.000.

**Medias nacionales:**

| Agua de red | Cloacas | Gas de red | Internet |
| ----------- | ------- | ---------- | -------- |
| 85,03%      | 61,25%  | 52,66%     | 76,49%   |

Las tarjetas muestran siempre el porcentaje junto con la **cantidad de hogares**, y lo comparan con las medias nacional y provincial.

## 5. Índice de servicios bajo la media (vista Resumen)

`servicios_bajo_media` cuenta en cuántos de los cuatro servicios el departamento tiene un porcentaje con acceso **menor** que la media nacional. Toma valores de 0 a 4. La igualdad con la media no se cuenta como "bajo la media".

**Qué es y qué no es:**

- Es una **clasificación de territorios**.
- **No** cuenta hogares que carecen de los cuatro servicios a la vez. Para eso habría que cruzar las variables hogar por hogar, y los datos agregados no lo permiten.
- **No** es un índice de pobreza ni de necesidades básicas insatisfechas.

Resultado: 150 departamentos están bajo la media en los cuatro servicios y concentran 1.599.191 hogares.

## 6. Control de calidad de los datos

Durante la preparación se detectaron y resolvieron las siguientes incidencias:

| Incidencia                                                                                                                                                                                  | Tratamiento                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| REDATAM calcula el porcentaje de cloacas sobre los **casos aplicables**, excluyendo hogares sin baño. Ejemplo: radio `020070101`, 98 hogares con cloaca sobre 105 aplicables y 106 totales. | Se recalculó sobre el **total de hogares** (98/106).                                                                           |
| Una hoja del cuadro de internet de Buenos Aires (`Cuadro7.2.130`) se titula "Tres de Febrero", pero su total de 3.539 hogares corresponde a **Tres Lomas** (código 06847).                  | Se asignó por código y por total de hogares, verificado en REDATAM, y no por el título.                                        |
| Los cuadros usan `-` (cero absoluto) y `///` (dato que no corresponde presentar).                                                                                                           | Se trataron por separado: `///` no se convirtió en cero.                                                                       |
| Gas en Mártires (26063) y Guachipas (66063) figura como `///`.                                                                                                                              | Se recuperó el dato desde REDATAM (un hogar con gas de red en cada uno). La fuente queda identificada en el archivo procesado. |
| Variantes de nombres entre hojas (acentos, abreviaturas, "Lezama", "Nueve de Julio", CABA sin coma).                                                                                        | Todas las uniones se hicieron por **código INDEC de 5 dígitos**, nunca por nombre.                                             |

**Controles finales:**

- 527 departamentos y 24 jurisdicciones, sin valores faltantes en las cuatro variables.
- La suma de hogares de los departamentos coincide exactamente con el total de cada provincia.
- Los cuatro porcentajes se recalcularon desde numerador y denominador, y coinciden en todas las filas.
- Los 527 códigos departamentales tienen polígono en la cartografía.

## 7. Territorios sin datos

Los polígonos `94021` y `94028` (Antártida Argentina e Islas del Atlántico Sur) no tienen registros de hogares en viviendas particulares en el censo. Se dibujan siempre, sin altura, en gris rayado y con la etiqueta "Sin datos censales". **No se interpretan como 0%.** Las Islas Malvinas permanecen visibles en el mapa, y la Antártida se muestra en un recuadro.

## 8. Cómo se representa en el mapa

- **Vista nacional:** la **altura** es el porcentaje de hogares sin el servicio **en la provincia**, así que todos los departamentos de una provincia comparten la altura. El **color** es el valor **de cada departamento**. Son la misma variable a dos escalas de agregación, y la leyenda lo indica.
- **Dentro de una provincia:** altura y color corresponden al departamento.
- **Color:** rampa secuencial propia, de asfalto a amarillo señal; luminosidad creciente, apta para daltonismo. Interpola entre cinco paradas (0 → #23272E, 25 → #4A3F2C, 50 → #8C5A1E, 75 → #E07A14, 100 → #F7D046), con dominio fijo de 0 a 100% del porcentaje de hogares sin servicio y la misma rampa en los cuatro servicios. Así el mismo color significa lo mismo en todas las vistas.
- **Altura:** escala lineal, sin raíces ni logaritmos, tanto en la vista nacional como dentro de una provincia. El máximo de extrusión es de 20.000 unidades visuales (`altura = porcentaje / 100 × 20.000`; en Resumen, `índice / 4 × 20.000`). Es una exageración visual que no representa elevación ni distancias reales. En la vista 3D, la inclinación de la cámara es de 40° en pantallas grandes (30° en celular).
- **Vista Resumen:** el color muestra las cinco categorías (0 a 4) del índice departamental, con cinco pasos de la misma rampa. La altura provincial es la media del índice ponderada por hogares: `suma(índice × hogares) / suma(hogares)`. Puede tener decimales.
- **Selección y atenuado:** no se usa transparencia. Lo que no está en foco se atenúa mezclando su color con el del fondo: al entrar a una provincia, las demás bajan a altura 0 y se mezclan al 70% con el fondo; al seleccionar un departamento, su techo se pinta de blanco, se eleva un 15% y sus vecinos se mezclan al 30%. El aumento de altura es solo visual y no cambia los valores de las tarjetas.
- **Límites:** los límites se dibujan como franjas internas de cada polígono, a la altura de su techo. Cada franja se calcula en un sistema métrico (EPSG:3857) como el polígono menos su propio polígono reducido. El ancho es proporcional al tamaño: en provincias, el menor entre 2.000 m y el 1,5% del lado menor de su caja envolvente; en departamentos, el menor entre 400 m y el 3% de ese lado, con un mínimo de 60 m. Así las provincias y departamentos chicos, como CABA y sus comunas, conservan bordes finos. Los límites provinciales siempre se ven; los departamentales se ven atenuados en la vista nacional y nítidos dentro de la provincia elegida.
- **Vista plana (predeterminada):** el mapa abre sin altura ni perspectiva, para leer los valores sin la distorsión del 3D (ocultamiento y exageración de volúmenes). El botón «Vista 3D» agrega la altura y la inclinación, y «Vista plana» vuelve a quitarlas. Las franjas se reemplazan por líneas comunes (1,2 px en provincias y 0,4 px en departamentos).

## 9. Comparación entre departamentos

- Muestra el porcentaje con acceso y la cantidad de hogares de cada departamento, con una marca en la media nacional.
- La diferencia se expresa en **puntos porcentuales** (A − B), no como variación relativa.
- La frase resumen describe el servicio con mayor diferencia absoluta, sin atribuir causas.
- Las comparaciones sugeridas buscan extremos entre departamentos con **al menos 1.000 hogares**. Si se elige un departamento más chico, se muestra una advertencia, porque pocos hogares de diferencia producen grandes variaciones porcentuales.

## 10. Limitaciones

- **Fecha:** los datos son de mayo de 2022 y no reflejan obras posteriores.
- **Nivel agregado:** los porcentajes describen territorios, no personas. Un valor departamental no permite inferir la situación de cada hogar ni de cada localidad dentro del departamento.
- **Heterogeneidad interna:** un departamento puede combinar una ciudad bien conectada con áreas rurales sin redes; el promedio oculta esa diferencia.
- **Departamentos chicos:** con pocos hogares, los porcentajes son más sensibles.
- **Conceptos:** el gas mide uso para cocinar y no disponibilidad de red; el agua y el internet miden acceso, no calidad.
- **Geometría:** los polígonos se simplificaron para que el mapa cargue rápido (tolerancia de 0,005° y coordenadas con 4 decimales; para CABA y los 24 partidos del conurbano, que son chicos, la tolerancia es diez veces menor: 0,0005°). Puede haber pequeñas diferencias visuales en límites compartidos. Los límites son estadísticos, no deslindes legales.
- **Redondeo:** los porcentajes departamentales se muestran con un decimal; los agregados provinciales se calculan con totales de hogares, sin ese redondeo.

## 11. Reproducibilidad

- Los datos originales están sin modificar en `data/raw/`.
- `scripts/prepare.py` une datos y cartografía por código, calcula medias e índice, y genera los archivos de `data/processed/`, incluidas las franjas de borde (`bordes_provincias.geojson` y `bordes_departamentos.geojson`).
- Para reproducir: `pip install pandas geopandas` y luego `python scripts/prepare.py`.
- Los resultados por departamento se pueden descargar desde la ventana de Metodología del sitio, o en `data/processed/argentina_desconectada_departamentos.csv`: una fila por departamento (527, sin provincias ni territorios sin datos), códigos como texto con ceros a la izquierda, porcentajes con un decimal y punto decimal, codificación UTF-8 con BOM. Incluye hogares y porcentaje con cada servicio, y el índice de servicios bajo la media.

## 12. Fuentes y licencias

- INDEC, Censo 2022, cuadros de hogares: [cuadro 2 (agua)](https://www.indec.gob.ar/ftp/cuadros/poblacion/c2022_tp_hogares_c2.xlsx), [cuadro 3 (cloacas)](https://www.indec.gob.ar/ftp/cuadros/poblacion/c2022_tp_hogares_c3.xlsx), [cuadro 4 (gas)](https://www.indec.gob.ar/ftp/cuadros/poblacion/c2022_tp_hogares_c4.xlsx) y [cuadro 7 (internet)](https://www.indec.gob.ar/ftp/cuadros/poblacion/c2022_tp_hogares_c7.xlsx), en sus versiones nacional y por jurisdicción.
- [REDATAM, Censo 2022](https://redatam.indec.gob.ar/binarg/RpWebEngine.exe/Portal?BASE=CPV2022&lang=ESP).
- [Definiciones de la base de datos](https://redatam.indec.gob.ar/redarg/CENSOS/CPV2022/Docs/Redatam_Definiciones_de_la_base_de_datos.pdf).
- Cartografía: [INDEC GeoNode, capa Departamentos](https://geonode.indec.gob.ar/layers/geonode:departamentos/metadata_detail).
- Licencia de los datos del INDEC: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.es).
