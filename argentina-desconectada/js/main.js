// Punto de entrada: carga de datos y armado del mapa.
import { initMap, SERVICIOS, esAMBA, esPartidoGBA, nombreProvincia } from './map.js';
import { initTarjetas, initTooltip } from './panel.js';

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
  if (!resumen || !provincias) throw new Error('No se pudo cargar el resumen o la cartografía provincial.');
  const datosProv = resumen ? resumen.provincias : {};
  const media = resumen ? resumen.media_nacional : null;

  const contenedor = document.querySelector('#map');
  const tooltip = initTooltip(contenedor, geojson, resumen);
  const tarjetas = initTarjetas(contenedor, resumen, () => marcarEnMapas(null));
  function marcarEnMapas(codigo) {
    mapaPais.marcar(codigo);
    mapaAmba.marcar(codigo);
  }
  function seleccionar(p, ancla = mapaPais.ancla(p.codigo)) {
    tooltip.ocultar();
    if (tarjetas.mostrar(p, ancla) !== false) marcarEnMapas(p.codigo);
  }
  const recuadroAmba = document.querySelector('.amba');
  const reservaAmba = () => (!recuadroAmba.hidden && getComputedStyle(recuadroAmba).position === 'absolute' ? recuadroAmba.offsetWidth + 16 : 0);
  const selProv = document.querySelector('#provincia');
  function onProvincia(cpr) {
    tarjetas.cambiarProvincia();
    tooltip.ocultar();
    recuadroAmba.hidden = cpr !== '06';
    selProv.value = cpr && datosProv[cpr] ? nombreProvincia(datosProv[cpr].nombre) : '';
  }
  const mapaPais = initMap(contenedor, geojson, { provincias, resumen, reserva: reservaAmba, contenedorLeyenda: document.querySelector('#leyenda-mapa'), onSeleccion: seleccionar, onProvincia, onProvinciaHover: tooltip.mostrar, onFuera: tarjetas.cerrarPorMapa });
  const mapaAmba = initMap(document.querySelector('#map-amba'), geojson, { filtro: esAMBA, activo: esPartidoGBA, conLeyenda: false, conZoom: false, provincias, onSeleccion: (p) => seleccionar(p), onFuera: tarjetas.cerrarPorMapa });
  const mapa = {
    setServicio(s) {
      mapaPais.setServicio(s);
      mapaAmba.setServicio(s);
      tarjetas.setServicio(s);
      tooltip.setServicio(s);
    },
  };
  // Buscador de departamento y zoom por provincia
  const nombres = geojson.features.filter((f) => !f.properties.sin_datos).map((f) => ({ ...f.properties, provincia: nombreProvincia(f.properties.provincia) }));
  const etiquetaDe = (p) => `${p.territorio} (${p.provincia})`;
  const porEtiqueta = new Map(nombres.map((p) => [etiquetaDe(p), p]));
  const lista = document.querySelector('#lista-deptos');
  lista.innerHTML = [...porEtiqueta.keys()].sort((a, b) => a.localeCompare(b, 'es')).map((n) => `<option value="${n}">`).join('');
  const nombresProv = [...new Set(nombres.map((p) => p.provincia))].sort((a, b) => a.localeCompare(b, 'es'));
  selProv.innerHTML = '<option value="">Todo el país</option>' + nombresProv.map((n) => `<option>${n}</option>`).join('');
  const buscador = document.querySelector('#buscador');
  const avisoBusqueda = document.querySelector('#aviso-busqueda');

  function irADepartamento(p) {
    mapaPais.enfocar(p.codigo); // abre la provincia; después se fija el departamento
    seleccionar(p);
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
  selProv.addEventListener('change', () => mapaPais.entrarProvincia(selProv.value));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !tarjetas.escape()) mapaPais.salir();
  });

  const opciones = {
    resumen: 'Resumen',
    ...Object.fromEntries(Object.entries(SERVICIOS).map(([k, v]) => [k, v.nombre])),
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
