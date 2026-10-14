// Punto de entrada: carga de datos y armado del mapa.
import { initMap } from './map.js';
import { initPanel } from './panel.js';

initMap(document.querySelector('#map'));
initPanel(document.querySelector('#panel'));

// Pendiente: cargar el GeoJSON de data/processed/ cuando esté disponible.
