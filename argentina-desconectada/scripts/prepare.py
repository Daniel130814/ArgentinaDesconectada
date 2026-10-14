"""
prepare.py — Argentina Desconectada
Une los datos del Censo 2022 (hogares por departamento) con la geometría
de departamentos de INDEC y genera el GeoJSON que consume el mapa.

Uso (desde la raíz de la repo):
    pip install pandas geopandas
    python scripts/prepare.py

Entradas:
    data/raw/hogares2022_departamentos_provincias.csv
    data/raw/departamentos.geojson
Salidas:
    data/processed/departamentos_servicios.geojson
    data/processed/resumen_nacional.json
"""
import json
from pathlib import Path

import geopandas as gpd
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"
OUT.mkdir(parents=True, exist_ok=True)

SERVICIOS = ["agua_red", "cloacas_red", "gas_red", "internet_vivienda"]
TOLERANCIA_SIMPLIFICACION = 0.005  # grados; subir si el archivo pesa > 2 MB

# ---------------------------------------------------------------- datos
df = pd.read_csv(RAW / "hogares2022_departamentos_provincias.csv", dtype={"codigo": str})
df["codigo"] = df["codigo"].str.strip()

# Códigos de 2 dígitos = provincias; de 5 (o 4 si se perdió el 0 inicial) = departamentos
df["es_depto"] = df["codigo"].str.len() >= 4
df.loc[df["es_depto"], "codigo"] = df.loc[df["es_depto"], "codigo"].str.zfill(5)
df.loc[~df["es_depto"], "codigo"] = df.loc[~df["es_depto"], "codigo"].str.zfill(2)

prov = df[~df["es_depto"]].copy()
deptos = df[df["es_depto"]].copy()
assert len(prov) == 24, f"Se esperaban 24 provincias, hay {len(prov)}"
assert len(deptos) == 527, f"Se esperaban 527 departamentos, hay {len(deptos)}"

# Media nacional: suma de numeradores / suma de denominadores (nunca promedio de %)
total_hogares = deptos["hogares_total"].sum()
media_nacional = {
    s: round(100 * deptos[f"hogares_{s}"].sum() / total_hogares, 2) for s in SERVICIOS
}

# Índice resumen: en cuántos servicios el departamento está por debajo de la media nacional (0–4).
# Es una clasificación de TERRITORIOS, no un conteo de hogares sin los cuatro servicios.
deptos["servicios_bajo_media"] = sum(
    (deptos[f"pct_{s}"] < media_nacional[s]).astype(int) for s in SERVICIOS
)

prov_nombre = prov.set_index(prov["codigo"])["territorio"].to_dict()
deptos["provincia"] = deptos["codigo"].str[:2].map(prov_nombre)

cols = (
    ["codigo", "territorio", "provincia", "hogares_total", "servicios_bajo_media"]
    + [f"hogares_{s}" for s in SERVICIOS]
    + [f"pct_{s}" for s in SERVICIOS]
)
deptos = deptos[cols]
for s in SERVICIOS:
    deptos[f"pct_{s}"] = deptos[f"pct_{s}"].round(1)

# ---------------------------------------------------------------- geometría
geo = gpd.read_file(RAW / "departamentos.geojson")
geo["cde"] = geo["cde"].astype(str).str.zfill(5)  # cde ya incluye la provincia: no concatenar cpr
geo = geo[["cde", "geometry"]].to_crs(epsg=4326)

merged = geo.merge(deptos, left_on="cde", right_on="codigo", how="left")

# Control de unión
sin_datos = merged[merged["codigo"].isna()]["cde"].tolist()
faltan_geo = sorted(set(deptos["codigo"]) - set(geo["cde"]))
print(f"Polígonos sin datos: {sin_datos}  (esperados: 94021, 94028)")
print(f"Departamentos sin geometría: {faltan_geo}  (esperado: ninguno)")
assert not faltan_geo, "Hay departamentos del CSV sin polígono"

merged["sin_datos"] = merged["codigo"].isna()  # se pintan en gris, nunca como 0%
merged = merged.drop(columns=["codigo"]).rename(columns={"cde": "codigo"})

# Simplificar para que cargue rápido (preservando topología por polígono)
merged["geometry"] = merged.geometry.simplify(TOLERANCIA_SIMPLIFICACION, preserve_topology=True)

salida = OUT / "departamentos_servicios.geojson"
merged.to_file(salida, driver="GeoJSON", COORDINATE_PRECISION=4)
print(f"OK → {salida} ({salida.stat().st_size / 1e6:.2f} MB)")

# ---------------------------------------------------------------- límites provinciales
# Se disuelven los departamentos originales (sin simplificar) por provincia: los dos primeros
# dígitos de cde son el código de provincia. Así el trazo no tiene huecos entre departamentos.
geo["cpr"] = geo["cde"].str[:2]
limites = geo.dissolve(by="cpr", as_index=False)
limites["nombre"] = limites["cpr"].map(prov_nombre)
limites["geometry"] = limites.geometry.simplify(TOLERANCIA_SIMPLIFICACION, preserve_topology=True)
sal_prov = OUT / "provincias.geojson"
limites[["cpr", "nombre", "geometry"]].to_file(sal_prov, driver="GeoJSON", COORDINATE_PRECISION=4)
print(f"OK → {sal_prov} ({sal_prov.stat().st_size / 1e6:.2f} MB, {len(limites)} provincias)")

# ---------------------------------------------------------------- resumen para la página
resumen = {
    "fuente": "INDEC, Censo Nacional de Población, Hogares y Viviendas 2022",
    "unidad": "Hogares en viviendas particulares",
    "total_hogares": int(total_hogares),
    "media_nacional": media_nacional,
    "provincias": {
        r["codigo"]: {"nombre": r["territorio"], **{s: round(r[f"pct_{s}"], 1) for s in SERVICIOS}}
        for _, r in prov.iterrows()
    },
}
(OUT / "resumen_nacional.json").write_text(json.dumps(resumen, ensure_ascii=False, indent=2), encoding="utf-8")
print("Media nacional:", media_nacional)
