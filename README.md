# La Argentina desconectada

La otra cara de la moneda.

**Dónde vivís define a qué redes estás conectado.**

Mapa interactivo sobre el acceso de los hogares argentinos a cuatro servicios básicos —**agua de red, cloacas, gas de red e internet**— en los 527 departamentos, partidos y comunas del país, con datos del Censo Nacional 2022.

🔗 **Ver el proyecto:** https://daniel130814.github.io/ArgentinaDesconectada/

Proyecto presentado en **Contar con Datos 2026** (Universidad de San Andrés), categoría _Exploración Interactiva_.

---

## La pregunta

¿Cuánto cambia el acceso a los servicios básicos según el lugar del país donde vive un hogar?

Los promedios nacionales esconden la respuesta. A nivel país, 76,5% de los hogares tiene internet en la vivienda; pero en la Comuna 14 de CABA son 94,7% y en el departamento Sarmiento, Santiago del Estero, 9,2%. El mapa permite recorrer esa brecha territorio por territorio.

## Hallazgos principales

- **La brecha de internet es de 85 puntos porcentuales** entre la Comuna 14 (CABA, 94,7%) y Sarmiento (Santiago del Estero, 9,2%).
- **6,2 millones de hogares no están conectados a la red cloacal** (38,7% del total). En Figueroa (Santiago del Estero) la cobertura es de 0,3%.
- **El gas de red marca un corte regional, no solo social.** En Formosa (0,9%), Chaco (1,5%), Corrientes (1,3%) y Misiones (2,6%) casi ningún hogar cocina con gas de red, mientras que en la Patagonia la mayoría supera el 80%. La red de gas natural prácticamente no llega al NEA.
- **150 departamentos están por debajo de la media nacional en los cuatro servicios**, y concentran 1,6 millones de hogares.
- **Agua de red:** aun siendo el servicio más extendido (85,0%), hay departamentos como 2 de Abril (Chaco) con 1,7% de cobertura.

_Los extremos citados consideran solo departamentos con al menos 1.000 hogares._

## Cómo usarlo

1. **Elegí un servicio** en la parte superior (Resumen, Agua, Cloacas, Gas o Internet).
2. **Tocá una provincia** para acercarte y ver sus departamentos.
3. **Tocá un departamento** para ver sus cuatro servicios comparados con la media nacional.
4. **Usá "Comparar"** para poner dos departamentos lado a lado.
5. **"Vista plana"** muestra el mapa en 2D, para leer los valores sin la distorsión de la perspectiva.

La **altura** y el **color** representan el porcentaje de hogares **sin** el servicio: cuanto más alto y brillante, más desconectado.

## Datos

| Servicio | Variable censal | Definición                                                                                                  |
| -------- | --------------- | ----------------------------------------------------------------------------------------------------------- |
| Agua     | H14             | Hogares cuya fuente de agua para beber y cocinar es la red pública                                          |
| Cloacas  | H18             | Hogares con desagüe del inodoro a red pública (sobre el total de hogares, incluidos los que no tienen baño) |
| Gas      | H19             | Hogares que usan principalmente gas de red para cocinar                                                     |
| Internet | H24A            | Hogares con conexión a internet en la vivienda (no incluye solo celular)                                    |

- **Fuente:** INDEC, Censo Nacional de Población, Hogares y Viviendas 2022.
- **Unidad:** hogares en viviendas particulares (15.932.302 hogares).
- **Nivel geográfico:** 527 departamentos, partidos y comunas.
- **Cartografía:** INDEC (GeoNode) / IGN.

### Medias nacionales

| Agua de red | Cloacas | Gas de red | Internet |
| ----------- | ------- | ---------- | -------- |
| 85,0%       | 61,3%   | 52,7%      | 76,5%    |

## Metodología (resumen)

- Todas las tasas se calculan como **hogares con el servicio / total de hogares** del territorio. Los agregados provinciales y nacionales **suman hogares**, nunca promedian porcentajes.
- El **Resumen** cuenta en cuántos de los cuatro servicios cada departamento está por debajo de la media nacional (de 0 a 4). Es una clasificación de **territorios**, no la cantidad de hogares que carecen de los cuatro servicios a la vez (eso requeriría cruzar las variables hogar por hogar).
- En la **vista nacional**, la altura corresponde al valor de la provincia y el color al de cada departamento. Dentro de una provincia, altura y color corresponden al departamento.
- **Antártida Argentina e Islas del Atlántico Sur** se muestran en el mapa sin datos, porque el censo no registra hogares en viviendas particulares allí.

El detalle completo está en [METODOLOGIA.md](METODOLOGIA.md).

## Limitaciones

- **Gas:** mide el combustible principal para cocinar, no si la red pasa por la zona. Un hogar puede tener red y cocinar con electricidad.
- **Agua:** la conexión a red pública no garantiza continuidad, presión ni calidad.
- **Internet:** indica si hay conexión en la vivienda, no su velocidad, estabilidad ni costo.
- Los datos muestran **brechas territoriales**, no sus causas.
- Es una foto de 2022: no refleja obras posteriores.

## Estructura del repositorio

```
index.html
css/                 estilos
js/                  mapa, tarjetas y comparación
data/raw/            datos originales del INDEC (sin modificar)
data/processed/      datos procesados para el mapa
scripts/prepare.py   une datos y cartografía, calcula indicadores
METODOLOGIA.md
```

### Reproducir el procesamiento

```bash
pip install pandas geopandas topojson
python scripts/prepare.py
python -m http.server 8765
```

Luego abrir `http://localhost:8765`.

## Licencia y atribución

Datos: INDEC, Censo 2022, bajo licencia [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.es). Cartografía: INDEC / IGN.

## Autor

Daniel Vidal · https://www.linkedin.com/in/daniel-vidal-it/
