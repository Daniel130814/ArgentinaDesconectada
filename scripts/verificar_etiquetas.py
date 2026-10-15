"""
verificar_etiquetas.py — comprueba la posición de las etiquetas de provincia del mapa.

Uso (desde la raíz del repo):
    python scripts/verificar_etiquetas.py

Verifica, para las 24 provincias, que:
  1. el código de provincia y su nombre coinciden con el CSV original (38 = Jujuy, 66 = Salta, etc.);
  2. el punto de la etiqueta cae DENTRO de su provincia (point-in-polygon), tanto en el límite provincial
     (provincias.geojson) como en la unión de los polígonos de sus departamentos, que es lo que se dibuja;
  3. el punto está en el polígono más grande de la provincia.
Informa además a qué distancia del borde queda cada punto. Termina con código 1 si algo falla.
"""
import csv
import json
import sys
from pathlib import Path

import geopandas as gpd
from shapely.geometry import Point, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent
PROC = ROOT / "data" / "processed"
CRS_METRICO = "EPSG:3857"

# Nombres según el CSV original: filas de provincia (código de 2 dígitos)
nombres_csv = {}
with open(ROOT / "data" / "raw" / "hogares2022_departamentos_provincias.csv", encoding="utf-8-sig") as f:
    for fila in csv.DictReader(f):
        codigo = fila["codigo"].strip()
        if len(codigo) <= 2:
            nombres_csv[codigo.zfill(2)] = fila["territorio"]
assert len(nombres_csv) == 24, f"El CSV debería tener 24 provincias y tiene {len(nombres_csv)}"
assert nombres_csv["38"] == "Jujuy" and nombres_csv["66"] == "Salta"

etiquetas = json.loads((PROC / "etiquetas_provincias.geojson").read_text(encoding="utf-8"))["features"]
limites = {
    f["properties"]["cpr"]: shape(f["geometry"])
    for f in json.loads((PROC / "provincias.geojson").read_text(encoding="utf-8"))["features"]
}
deptos = {}
for f in json.loads((PROC / "departamentos_servicios.geojson").read_text(encoding="utf-8"))["features"]:
    if not f["properties"]["sin_datos"]:
        deptos.setdefault(f["properties"]["codigo"][:2], []).append(shape(f["geometry"]).buffer(0))
deptos = {cpr: unary_union(gs) for cpr, gs in deptos.items()}


def metrico(geom):
    return gpd.GeoSeries([geom], crs=4326).to_crs(CRS_METRICO).iloc[0]


def parte_mayor(geom):
    partes = list(geom.geoms) if geom.geom_type == "MultiPolygon" else [geom]
    return max(partes, key=lambda g: metrico(g).area)


print(f"{'cód':<4}{'provincia':<34}{'lon':>10}{'lat':>10}  {'en límite':<10}{'en deptos':<10}{'polig. mayor':<13}{'a borde (km)':>12}")
fallos = []
vistos = set()
for e in etiquetas:
    cpr, nombre = e["properties"]["cpr"], e["properties"]["nombre"]
    vistos.add(cpr)
    lon, lat = e["geometry"]["coordinates"]
    p = Point(lon, lat)
    if nombres_csv.get(cpr) != nombre:
        fallos.append(f"{cpr}: el nombre '{nombre}' no coincide con el CSV ('{nombres_csv.get(cpr)}')")
    en_limite = limites[cpr].contains(p)
    en_deptos = deptos[cpr].contains(p)
    en_mayor = parte_mayor(limites[cpr]).contains(p)
    borde_km = metrico(limites[cpr].boundary).distance(metrico(p)) / 1000
    print(f"{cpr:<4}{nombre[:32]:<34}{lon:>10.3f}{lat:>10.3f}  {str(en_limite):<10}{str(en_deptos):<10}{str(en_mayor):<13}{borde_km:>12.1f}")
    if not (en_limite and en_deptos and en_mayor):
        fallos.append(f"{cpr} {nombre}: el punto cae fuera (límite={en_limite}, deptos={en_deptos}, polígono mayor={en_mayor})")

if vistos != set(nombres_csv):
    fallos.append(f"Faltan o sobran provincias: {sorted(vistos ^ set(nombres_csv))}")
print()
if fallos:
    print("FALLAN:", *fallos, sep="\n  - ")
    sys.exit(1)
print(f"OK: las {len(etiquetas)} etiquetas caen dentro de su provincia y los códigos coinciden con el CSV.")
