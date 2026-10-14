# Argentina desconectada

Estructura inicial para un mapa de conectividad y comparación territorial.
La carga de datos, el mapa, la comparación y el cálculo del índice están
pendientes de implementación.

## Estructura

- `index.html`: página principal.
- `css/style.css`: estilos.
- `js/main.js`: punto de entrada y futura carga de datos.
- `js/map.js`: futura capa del mapa y colores.
- `js/panel.js`: futura comparación y tooltip.
- `data/raw/`: CSV y GeoJSON originales, sin modificaciones.
- `data/processed/`: GeoJSON final unido y simplificado.
- `scripts/prepare.py`: base del proceso de unión y cálculo del índice 0–4.
- `METODOLOGIA.md`: definiciones y criterios del análisis.

## Vista local

Desde este directorio, ejecutar:

```sh
python -m http.server 8000
```

Abrir `http://localhost:8000` en el navegador.

## Preparación de datos

Colocar los originales en `data/raw/` y completar `METODOLOGIA.md`
antes de implementar y ejecutar `scripts/prepare.py`.
