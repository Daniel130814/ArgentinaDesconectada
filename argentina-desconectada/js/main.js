// Punto de entrada: carga de datos y armado del mapa.
import { initMap, SERVICIOS, esAMBA, ENCUADRE_PAIS } from './map.js';
import { initPanel } from './panel.js';

const NOTAS = {
  agua_red: 'Hogares con agua por red pública.',
  cloacas_red: 'Hogares con desagüe a red pública (cloacas).',
  gas_red: 'Hogares que cocinan principalmente con gas de red. No mide si la red existe en la zona: el NEA casi no tiene red de gas natural.',
  internet_vivienda: 'Hogares con conexión a internet en la vivienda (no celular). No mide velocidad ni calidad.',
  resumen: 'Clasifica territorios: cuenta en cuántos de los 4 servicios el departamento está bajo la media nacional. No es la cantidad de hogares sin los cuatro servicios.',
};

const status = document.querySelector('#status');

async function main() {
  const res = await fetch('data/processed/departamentos_servicios.geojson');
  if (!res.ok) throw new Error(`No se pudo cargar el GeoJSON (${res.status})`);
  const geojson = await res.json();
  const resumen = await fetch('data/processed/resumen_nacional.json').then((r) => (r.ok ? r.json() : null));
  const provincias = await fetch('data/processed/provincias.geojson').then((r) => (r.ok ? r.json() : null));
  const media = resumen ? resumen.media_nacional : null;

  // Seleccionar (clic, toque o búsqueda) deja el departamento fijo: mover el mouse ya no cambia el panel.
  let fijo = null;
  const panel = initPanel(document.querySelector('#panel'), geojson, media, soltar);
  function marcarEnMapas(codigo) {
    mapaPais.marcar(codigo);
    mapaAmba.marcar(codigo);
  }
  function seleccionar(p) {
    fijo = p;
    panel.mostrar(p, true);
    marcarEnMapas(p.codigo);
  }
  function soltar() {
    fijo = null;
    panel.mostrar(null);
    marcarEnMapas(null);
  }
  const onHover = (p) => {
    if (!fijo) panel.mostrar(p);
  };
  const onSeleccion = seleccionar;
  const mapaPais = initMap(document.querySelector('#map'), geojson, { encuadre: L.latLngBounds(ENCUADRE_PAIS), provincias, onHover, onSeleccion });
  const mapaAmba = initMap(document.querySelector('#map-amba'), geojson, { filtro: esAMBA, conLeyenda: false, zoomSnap: 0.1, provincias, onHover, onSeleccion });
  const mapa = {
    setServicio(s) {
      mapaPais.setServicio(s);
      mapaAmba.setServicio(s);
      panel.setServicio(s);
    },
  };

  // Buscador de departamento y zoom por provincia
  const nombres = geojson.features.filter((f) => !f.properties.sin_datos).map((f) => f.properties);
  const etiquetaDe = (p) => `${p.territorio} (${p.provincia})`;
  const porEtiqueta = new Map(nombres.map((p) => [etiquetaDe(p), p]));
  const lista = document.querySelector('#lista-deptos');
  lista.innerHTML = [...porEtiqueta.keys()].sort((a, b) => a.localeCompare(b, 'es')).map((n) => `<option value="${n}">`).join('');
  const nombresProv = [...new Set(nombres.map((p) => p.provincia))].sort((a, b) => a.localeCompare(b, 'es'));
  const selProv = document.querySelector('#provincia');
  selProv.innerHTML = '<option value="">Todo el país</option>' + nombresProv.map((n) => `<option>${n}</option>`).join('');
  const buscador = document.querySelector('#buscador');
  const avisoBusqueda = document.querySelector('#aviso-busqueda');

  function irADepartamento(p) {
    seleccionar(p);
    mapaPais.enfocar(p.codigo);
  }
  buscador.addEventListener('input', () => {
    const p = porEtiqueta.get(buscador.value.trim());
    if (p) {
      avisoBusqueda.textContent = '';
      irADepartamento(p);
    }
  });
  buscador.addEventListener('change', () => {
    const v = buscador.value.trim();
    if (v && !porEtiqueta.has(v)) avisoBusqueda.textContent = 'No encontramos ese departamento. Elegí una opción de la lista, con la provincia entre paréntesis.';
  });
  selProv.addEventListener('change', () => mapaPais.enfocarProvincia(selProv.value));

  const opciones = {
    ...Object.fromEntries(Object.entries(SERVICIOS).map(([k, v]) => [k, v.nombre])),
    resumen: 'Resumen (0–4)',
  };
  const selector = document.querySelector('#selector');
  const nota = document.querySelector('#nota');

  function elegir(clave) {
    mapa.setServicio(clave);
    nota.textContent = NOTAS[clave];
    selector.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.clave === clave)));
  }

  for (const [clave, nombre] of Object.entries(opciones)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.clave = clave;
    b.setAttribute('role', 'tab');
    const etiqueta = document.createElement('span');
    etiqueta.textContent = nombre;
    b.append(etiqueta);
    if (media && media[clave] != null) {
      const m = document.createElement('span');
      m.className = 'media';
      m.textContent = `media nacional ${media[clave].toFixed(1).replace('.', ',')}%`;
      b.append(m);
    }
    b.addEventListener('click', () => elegir(clave));
    selector.append(b);
  }
  elegir('agua_red');
}

main().catch((e) => {
  status.textContent = e.message;
  console.error(e);
});
