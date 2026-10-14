// Cartografía local sobre un estilo vacío, sin mapas base ni tiles externos.
const RAMPAS = {
  agua_red: ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'],
  cloacas_red: ['#f2f0f7', '#cbc9e2', '#9e9ac8', '#756bb1', '#54278f'],
  gas_red: ['#feedde', '#fdbe85', '#fd8d3c', '#e6550d', '#a63603'],
  internet_vivienda: ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c'],
  resumen: ['#ffffd4', '#fed98e', '#fe9929', '#d95f0e', '#993404'],
};
export const SERVICIOS = {
  agua_red: { nombre: 'Agua de red', campo: 'pct_agua_red', hogares: 'hogares_agua_red' },
  cloacas_red: { nombre: 'Cloacas', campo: 'pct_cloacas_red', hogares: 'hogares_cloacas_red' },
  gas_red: { nombre: 'Gas de red', campo: 'pct_gas_red', hogares: 'hogares_gas_red' },
  internet_vivienda: { nombre: 'Internet', campo: 'pct_internet_vivienda', hogares: 'hogares_internet_vivienda' },
};
const ESPECIALES = new Set(['94021', '94028']);
const MAX_ALTURA = 100000; // Metros visuales: escala lineal, sin significado geográfico.
const collection = (features) => ({ type: 'FeatureCollection', features });
const vacio = () => ({ version: 8, sources: {}, layers: [{ id: 'fondo', type: 'background', paint: { 'background-color': '#0B0D10' } }] });

function bounds(features) {
  const b = [180, 90, -180, -90];
  function recorrer(c) {
    if (typeof c[0] === 'number') {
      b[0] = Math.min(b[0], c[0]); b[2] = Math.max(b[2], c[0]);
      b[1] = Math.min(b[1], Math.max(-85, c[1])); b[3] = Math.max(b[3], Math.min(85, c[1]));
    } else c.forEach(recorrer);
  }
  features.forEach((f) => recorrer(f.geometry.coordinates));
  return [[b[0], b[1]], [b[2], b[3]]];
}

function rayado(map) {
  const data = new Uint8Array(8 * 8 * 4);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const i = (y * 8 + x) * 4;
    const gris = (x + y) % 8 < 2 ? 110 : 185;
    data.set([gris, gris, gris, 255], i);
  }
  map.addImage('sin-censo', { width: 8, height: 8, data });
}

export function initMap(container, geojson, opciones = {}) {
  const {
    filtro = null, activo = null, conLeyenda = true, conZoom = true,
    reserva = () => 0, contenedorLeyenda = null, provincias = null, resumen = null,
    onHover = () => {}, onSeleccion = () => {}, onProvinciaHover = () => {}, onProvincia = () => {},
  } = opciones;
  if (!container) throw new Error('No se encontró el contenedor del mapa.');
  if (!globalThis.maplibregl) throw new Error('No se pudo cargar MapLibre.');
  container.classList.add('mapa-gl');
  const feats = geojson.features.filter((f) => !filtro || filtro(f)).map((f) => ({
    ...f, properties: { ...f.properties, codigo: String(f.properties.codigo).padStart(5, '0'),
      cpr: String(f.properties.codigo).slice(0, 2), sin_datos: !!f.properties.sin_datos || ESPECIALES.has(f.properties.codigo) },
  }));
  const validos = feats.filter((f) => !f.properties.sin_datos);
  const especiales = feats.filter((f) => f.properties.sin_datos);
  const provs = (provincias?.features || []).filter((f) => resumen?.provincias[f.properties.cpr]).map((f) => {
    const d = resumen.provincias[f.properties.cpr];
    const p = { ...f.properties, hogares_total: d.hogares_total };
    for (const [k, s] of Object.entries(SERVICIOS)) p[s.campo] = 100 * d[s.hogares] / d.hogares_total;
    p.servicios_bajo_media = Object.entries(SERVICIOS).filter(([k, s]) => p[s.campo] < resumen.media_nacional[k]).length;
    return { ...f, properties: p };
  });
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = () => window.matchMedia('(max-width: 860px)').matches;
  const duration = reduced ? 0 : 650;
  let servicio = 'agua_red', provActual = null, seleccionado = null, listo = false, modo3D = conZoom;
  let frame = 0, visuales = new Map();
  const host = document.createElement('div');
  host.className = 'mapa-canvas'; container.append(host);
  const map = new maplibregl.Map({ container: host, style: vacio(), center: [-64, -39], zoom: 3,
    pitch: conZoom ? (mobile() ? 30 : 45) : 0, attributionControl: false, renderWorldCopies: false,
    maxZoom: 13, minZoom: 1, dragPan: conZoom, scrollZoom: conZoom, boxZoom: conZoom,
    doubleClickZoom: conZoom, touchZoomRotate: conZoom, keyboard: conZoom, dragRotate: conZoom });
  const pitch = () => modo3D ? (mobile() ? 30 : 45) : 0;
  const leyenda = conLeyenda ? (contenedorLeyenda || container.appendChild(document.createElement('div'))) : null;
  if (leyenda) leyenda.classList.add('leyenda');
  const volver = document.createElement('button');
  volver.type = 'button'; volver.className = 'mapa-volver'; volver.textContent = '← Argentina'; volver.hidden = true;
  if (conZoom) {
    container.append(volver); volver.addEventListener('click', salir);
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.FullscreenControl({ container: container.parentElement }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: false, customAttribution: 'INDEC, Censo 2022 · Cartografía INDEC/IGN' }), 'bottom-right');
    const boton = document.createElement('button');
    boton.type = 'button'; boton.className = 'mapa-dimension'; boton.textContent = '2D';
    boton.setAttribute('aria-label', 'Cambiar a vista 2D'); boton.setAttribute('aria-pressed', 'false');
    container.append(boton);
    boton.addEventListener('click', () => {
      modo3D = !modo3D; boton.textContent = modo3D ? '2D' : '3D';
      boton.setAttribute('aria-label', `Cambiar a vista ${modo3D ? '2D' : '3D'}`);
      boton.setAttribute('aria-pressed', String(!modo3D));
      map.setMaxPitch(modo3D ? 60 : 0);
      map.easeTo({ pitch: pitch(), bearing: modo3D ? map.getBearing() : 0, duration }); actualizarValores();
    });
  }
  function dibujarLeyenda() {
    if (!leyenda) return;
    const titulo = servicio === 'resumen' ? `Altura y color: servicios bajo la media nacional<br>(${provActual ? 'departamentos' : 'provincias'}, de 0 a 4; clasifica territorios)`
      : `Altura y color: % de hogares sin ${SERVICIOS[servicio].nombre.toLowerCase()}`;
    leyenda.innerHTML = `<b>${titulo}</b>` + RAMPAS[servicio].map((c, i) => `<div><i style="background:${c}"></i>${servicio === 'resumen' ? i : `${i * 20}–${(i + 1) * 20}%`}</div>`).join('')
      + '<div><i class="sin-censo"></i>Sin datos censales</div>';
  }
  function destino(p) {
    const raw = servicio === 'resumen' ? p.servicios_bajo_media : p[SERVICIOS[servicio].campo];
    if (p.sin_datos || raw == null) return { altura: 0, color: '#b9b9b9' };
    const v = servicio === 'resumen' ? raw : Math.max(0, Math.min(100, 100 - raw));
    return { altura: modo3D ? v / (servicio === 'resumen' ? 4 : 100) * MAX_ALTURA : 0,
      color: RAMPAS[servicio][servicio === 'resumen' ? v : Math.min(4, Math.floor(v / 20))] };
  }
  // Interpolación explícita: las expresiones por entidad no garantizan transiciones de paint.
  function actualizarValores() {
    dibujarLeyenda(); if (!listo) return;
    cancelAnimationFrame(frame);
    const pasos = [['deptos', validos], ['provs', provs]].flatMap(([source, fs]) => fs.map((f) => {
      const id = source === 'deptos' ? f.properties.codigo : f.properties.cpr;
      const key = `${source}:${id}`, fin = destino(f.properties);
      return { source, id, key, fin, inicio: visuales.get(key) || fin };
    }));
    const rgb = (c) => c.match(/\w\w/g).map((x) => parseInt(x, 16));
    const start = performance.now();
    function tick(now) {
      const t = reduced ? 1 : Math.min(1, (now - start) / 450);
      for (const paso of pasos) {
        const a = rgb(paso.inicio.color.slice(1)), b = rgb(paso.fin.color.slice(1));
        const color = '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
        const estado = { altura: paso.inicio.altura + (paso.fin.altura - paso.inicio.altura) * t, color };
        visuales.set(paso.key, estado); map.setFeatureState({ source: paso.source, id: paso.id }, estado);
      }
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  }
  function fit(fs, maxZoom = 7, animar = true) {
    if (!fs.length) return;
    map.fitBounds(bounds(fs), { padding: { top: 65, bottom: conZoom ? 65 : 15, left: Math.min(reserva() + 25, host.clientWidth / 2), right: 45 },
      maxZoom, pitch: pitch(), duration: animar ? duration : 0 });
  }
  function actualizarNivel() {
    if (!listo) return;
    const nacional = conZoom && provActual == null;
    for (const id of ['provincia-base', 'provincia-volumen', 'provincia-borde']) map.setLayoutProperty(id, 'visibility', nacional ? 'visible' : 'none');
    for (const id of ['departamento-base', 'departamento-volumen', 'departamento-borde']) {
      map.setLayoutProperty(id, 'visibility', nacional ? 'none' : 'visible');
      map.setFilter(id, activo ? ['in', ['get', 'codigo'], ['literal', validos.filter(activo).map((f) => f.properties.codigo)]] : ['==', ['get', 'cpr'], provActual || '']);
    }
    map.setLayoutProperty('resto', 'visibility', !nacional ? 'visible' : 'none');
    map.setFilter('resto', activo ? ['!', ['in', ['get', 'codigo'], ['literal', validos.filter(activo).map((f) => f.properties.codigo)]]] : ['!=', ['get', 'cpr'], provActual || '']);
    etiquetas.forEach(({ marker }) => { marker.getElement().hidden = !nacional; });
    volver.hidden = !provActual; dibujarLeyenda();
  }
  function abrir(cpr) {
    if (!provs.some((f) => f.properties.cpr === cpr)) return;
    provActual = cpr; onProvinciaHover(null); onProvincia(cpr); actualizarNivel();
    if (listo) fit(validos.filter((f) => f.properties.cpr === cpr));
  }
  function salir() {
    if (!provActual) return;
    provActual = null; seleccionado = null; onProvinciaHover(null); onProvincia(null); actualizarNivel();
    if (listo) fit(validos);
  }
  const etiquetas = [];
  map.on('load', () => {
    rayado(map);
    map.addSource('deptos', { type: 'geojson', data: collection(validos), promoteId: 'codigo' });
    map.addSource('provs', { type: 'geojson', data: collection(provs), promoteId: 'cpr' });
    map.addSource('sin-datos', { type: 'geojson', data: collection(especiales) });
    map.addLayer({ id: 'resto', type: 'fill', source: activo ? 'deptos' : 'provs', paint: { 'fill-color': ['coalesce', ['feature-state', 'color'], '#b9b9b9'], 'fill-opacity': 0.2 } });
    for (const [prefijo, source] of [['provincia', 'provs'], ['departamento', 'deptos']]) {
      const color = ['coalesce', ['feature-state', 'color'], '#b9b9b9'];
      map.addLayer({ id: `${prefijo}-base`, type: 'fill', source, paint: { 'fill-color': color } });
      map.addLayer({ id: `${prefijo}-volumen`, type: 'fill-extrusion', source, paint: {
        'fill-extrusion-color': color, 'fill-extrusion-height': ['coalesce', ['feature-state', 'altura'], 0], 'fill-extrusion-opacity': 1 } });
      map.addLayer({ id: `${prefijo}-borde`, type: 'line', source, paint: { 'line-color': '#dae1eb', 'line-width': prefijo === 'provincia' ? 1 : 0.5 } });
    }
    map.addLayer({ id: 'sin-censo', type: 'fill', source: 'sin-datos', paint: { 'fill-pattern': 'sin-censo' } });
    map.addLayer({ id: 'seleccion', type: 'line', source: 'deptos', filter: ['==', ['get', 'codigo'], ''], paint: { 'line-color': '#ff4f91', 'line-width': 3 } });
    if (conZoom) for (const f of provs) {
      const b = bounds(validos.filter((d) => d.properties.cpr === f.properties.cpr));
      const el = document.createElement('button'); el.type = 'button'; el.className = 'etiqueta-prov';
      el.textContent = f.properties.nombre; el.setAttribute('aria-label', `Ver departamentos de ${f.properties.nombre}`);
      el.addEventListener('click', (e) => { e.stopPropagation(); abrir(f.properties.cpr); });
      const marker = new maplibregl.Marker({ element: el }).setLngLat([(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2]).addTo(map);
      etiquetas.push({ marker });
    }
    listo = true; actualizarNivel(); actualizarValores();
    if (seleccionado) map.setFilter('seleccion', ['==', ['get', 'codigo'], seleccionado]);
    fit(activo ? validos.filter(activo) : provActual ? validos.filter((f) => f.properties.cpr === provActual) : validos, conZoom ? 7 : 10, false);
  });
  map.on('error', (e) => { const status = document.querySelector('#status'); if (status) status.textContent = `No se pudo dibujar el mapa: ${e.error.message}`; console.error(e.error); });
  function hit(e) {
    if (!listo) return null;
    const nacional = conZoom && !provActual;
    const layers = nacional ? ['provincia-volumen', 'provincia-base'] : ['departamento-volumen', 'departamento-base'];
    return map.queryRenderedFeatures(e.point, { layers })[0];
  }
  map.on('click', (e) => {
    const f = hit(e); if (!f) return;
    if (conZoom && !provActual) abrir(f.properties.cpr);
    else onSeleccion(feats.find((d) => d.properties.codigo === f.properties.codigo).properties);
  });
  map.on('mousemove', (e) => {
    if (e.originalEvent?.sourceCapabilities?.firesTouchEvents) return;
    const f = hit(e); map.getCanvas().style.cursor = f ? 'pointer' : '';
    if (conZoom && !provActual) onProvinciaHover(f?.properties.cpr || null, e.originalEvent);
    else if (f) onHover(feats.find((d) => d.properties.codigo === f.properties.codigo).properties);
  });
  map.getCanvas().addEventListener('mouseleave', () => onProvinciaHover(null));
  new ResizeObserver(() => {
    map.resize();
    if (listo && !conZoom && host.clientWidth) fit(activo ? validos.filter(activo) : validos, 10, false);
  }).observe(container);

  // Recuadro permanente: ambas geometrías siguen presentes en el mapa principal.
  if (conZoom && especiales.length) {
    const inset = document.createElement('div'); inset.className = 'territorios-sin-censo';
    const titulo = document.createElement('span'); titulo.textContent = 'Antártida e Islas del Atlántico Sur · Sin datos censales'; inset.append(titulo);
    const miniHost = document.createElement('div'); miniHost.className = 'territorios-canvas'; inset.append(miniHost); container.append(inset);
    const mini = new maplibregl.Map({ container: miniHost, style: vacio(), interactive: false, attributionControl: false, renderWorldCopies: false });
    mini.on('load', () => {
      rayado(mini); mini.addSource('territorios', { type: 'geojson', data: collection(especiales) });
      mini.addLayer({ id: 'territorios', type: 'fill', source: 'territorios', paint: { 'fill-pattern': 'sin-censo' } });
      mini.fitBounds(bounds(especiales), { padding: 10, duration: 0 });
    });
    new ResizeObserver(() => mini.resize()).observe(miniHost);
  }
  dibujarLeyenda();
  return {
    salir, nivel: () => provActual == null ? 'pais' : 'provincia',
    setServicio(s) { if (s !== 'resumen' && !SERVICIOS[s]) return; servicio = s; actualizarValores(); },
    marcar(codigo) { seleccionado = codigo; if (listo) map.setFilter('seleccion', ['==', ['get', 'codigo'], codigo || '']); },
    enfocar(codigo) {
      if (!conZoom) return;
      const f = validos.find((d) => d.properties.codigo === codigo); if (!f) return;
      if (provActual !== f.properties.cpr) abrir(f.properties.cpr);
      this.marcar(codigo); if (listo) fit([f], 11);
    },
    entrarProvincia(nombre) { const f = provs.find((d) => d.properties.nombre === nombre); if (f) abrir(f.properties.cpr); else salir(); },
  };
}

const PARTIDOS_GBA = new Set([
  '06028', '06035', '06091', '06260', '06270', '06274', '06371', '06408', '06410', '06412', '06427', '06434',
  '06490', '06515', '06539', '06560', '06568', '06658', '06749', '06756', '06760', '06805', '06840', '06861',
]);
export const esPartidoGBA = (f) => PARTIDOS_GBA.has(f.properties.codigo);
export const esAMBA = (f) => f.properties.codigo.startsWith('02') || esPartidoGBA(f);
