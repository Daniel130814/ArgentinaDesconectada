// Cartografía local sobre un estilo vacío, sin mapas base ni tiles externos.
export const INFERNO = ['#100b24', '#420a68', '#932667', '#dd513a', '#fca50a', '#fcffa4'];
export const RAMPAS = {
  agua_red: INFERNO, cloacas_red: INFERNO, gas_red: INFERNO, internet_vivienda: INFERNO,
  resumen: ['#100b24', '#561168', '#b83c51', '#f49016', '#fcffa4'],
};
export const SERVICIOS = {
  agua_red: { nombre: 'Agua de red', campo: 'pct_agua_red', hogares: 'hogares_agua_red' },
  cloacas_red: { nombre: 'Cloacas', campo: 'pct_cloacas_red', hogares: 'hogares_cloacas_red' },
  gas_red: { nombre: 'Gas de red', campo: 'pct_gas_red', hogares: 'hogares_gas_red' },
  internet_vivienda: { nombre: 'Internet', campo: 'pct_internet_vivienda', hogares: 'hogares_internet_vivienda' },
};
const ESPECIALES = new Set(['94021', '94028']);
const MAX_ALTURA = 63000; // 35% de la escala anterior; unidades visuales, sin significado geográfico.
const ACENTO = '#ff4f91';
const suavizar = (t) => t * t * (3 - 2 * t);
export const nombreProvincia = (nombre) => nombre === 'Ciudad Autónoma de Buenos Aires' ? 'CABA' : nombre;
export function alturasProvinciales(geojson, resumen) {
  const ponderados = {};
  for (const { properties: p } of geojson.features) {
    if (p.sin_datos || ESPECIALES.has(p.codigo) || p.servicios_bajo_media == null || !(p.hogares_total > 0)) continue;
    const a = (ponderados[p.codigo.slice(0, 2)] ??= { hogares: 0, suma: 0 });
    a.hogares += p.hogares_total;
    a.suma += p.servicios_bajo_media * p.hogares_total;
  }
  return Object.fromEntries(Object.entries(resumen?.provincias || {}).map(([cpr, d]) => {
    const a = ponderados[cpr];
    return [cpr, { ...d,
      ...Object.fromEntries(Object.entries(SERVICIOS).map(([k, s]) => [s.campo, 100 * d[s.hogares] / d.hogares_total])),
      servicios_bajo_media_ponderado: a?.hogares ? a.suma / a.hogares : null,
      hogares_indice: a?.hogares || 0,
    }];
  }));
}
export function rangoColor(p, servicio) {
  if (p.sin_datos || ESPECIALES.has(p.codigo)) return null;
  const v = servicio === 'resumen' ? p.servicios_bajo_media : p[SERVICIOS[servicio].campo];
  return v == null ? null : servicio === 'resumen' ? v : Math.min(4, Math.floor(Math.max(0, 100 - v) / 20));
}
const collection = (features) => ({ type: 'FeatureCollection', features });
const vacio = () => ({ version: 8, glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {}, layers: [{ id: 'fondo', type: 'background', paint: { 'background-color': '#0B0D10' } }] });
const PRIORIDADES = ['02', '06', '14', '50', '66', '22', '58', '26', '78', '54'];
const puntoMedio = (features) => { const b = bounds(features); return [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2]; };

function simbolo(id, source, opciones = {}) {
  return { id, type: 'symbol', source, ...opciones, layout: {
    'text-field': ['get', 'nombre'], 'text-font': ['Open Sans Semibold'], 'text-size': 12,
    'text-anchor': 'left', 'text-offset': [0.65, 0], 'text-max-width': 10,
    'text-allow-overlap': false, 'icon-allow-overlap': false, 'icon-image': 'punto-etiqueta',
    'icon-size': 0.6, 'symbol-sort-key': ['get', 'prioridad'],
    'text-pitch-alignment': 'viewport', 'icon-pitch-alignment': 'viewport',
    'text-rotation-alignment': 'viewport', 'icon-rotation-alignment': 'viewport',
  }, paint: { 'text-color': '#fff', 'text-halo-color': '#0b0d10', 'text-halo-width': 1.8 } };
}
function puntoEtiqueta(map) {
  const data = new Uint8Array(12 * 12 * 4);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
    if ((x - 5.5) ** 2 + (y - 5.5) ** 2 < 22) data.set([255, 255, 255, 255], (y * 12 + x) * 4);
  }
  map.addImage('punto-etiqueta', { width: 12, height: 12, data });
}

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
    onHover = () => {}, onSeleccion = () => {}, onProvinciaHover = () => {}, onProvincia = () => {}, onFuera = () => {},
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
  const datosProvinciales = alturasProvinciales(geojson, resumen);
  const provs = (provincias?.features || []).filter((f) => datosProvinciales[f.properties.cpr])
    .map((f) => ({ ...f, properties: { ...f.properties, ...datosProvinciales[f.properties.cpr] } }));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = () => window.matchMedia('(max-width: 767px)').matches;
  const duration = reduced ? 0 : 650;
  let servicio = 'agua_red', provActual = null, seleccionado = null, listo = false, modo3D = conZoom, provinciaHover = null;
  let frame = 0, visuales = new Map();
  let dimensionFrame = 0, factorAltura = conZoom ? 1 : 0;
  const host = document.createElement('div');
  host.className = 'mapa-canvas'; container.append(host);
  const map = new maplibregl.Map({ container: host, style: vacio(), center: [-64, -39], zoom: 3,
    pitch: conZoom ? (mobile() ? 30 : 50) : 0, bearing: conZoom ? -20 : 0,
    attributionControl: false, renderWorldCopies: false,
    maxZoom: 13, minZoom: 1, dragPan: conZoom, scrollZoom: conZoom, boxZoom: conZoom,
    doubleClickZoom: conZoom, touchZoomRotate: conZoom, keyboard: conZoom, dragRotate: conZoom });
  const pitch = () => modo3D ? (mobile() ? 30 : 50) : 0;
  const leyenda = conLeyenda ? (contenedorLeyenda || container.appendChild(document.createElement('div'))) : null;
  if (leyenda) leyenda.classList.add('leyenda');
  const volver = document.createElement('button');
  volver.type = 'button'; volver.className = 'mapa-volver'; volver.textContent = '← Argentina'; volver.hidden = true;
  if (conZoom) {
    container.append(volver); volver.addEventListener('click', salir);
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.FullscreenControl({ container: document.querySelector('.pagina') }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: false, customAttribution: 'Fuente: INDEC, Censo 2022 · Cartografía: INDEC/IGN' }), 'bottom-right');
    const boton = document.createElement('button');
    boton.type = 'button'; boton.className = 'mapa-dimension'; boton.textContent = 'Vista plana';
    boton.setAttribute('aria-label', 'Cambiar a vista plana'); boton.setAttribute('aria-pressed', 'false');
    container.append(boton);
    boton.addEventListener('click', () => {
      modo3D = !modo3D; boton.textContent = modo3D ? 'Vista plana' : 'Vista 3D';
      boton.setAttribute('aria-label', `Cambiar a ${modo3D ? 'vista plana' : 'vista 3D'}`);
      boton.setAttribute('aria-pressed', String(!modo3D));
      animarDimension();
    });
  }
  function dibujarLeyenda() {
    if (!leyenda) return;
    const enProvincia = provActual != null || activo != null;
    const titulo = servicio === 'resumen'
      ? enProvincia ? 'Altura y color: servicios bajo la media nacional en cada departamento'
        : 'Altura: media provincial ponderada por hogares · Color: servicios bajo la media en cada departamento'
      : enProvincia ? `Altura y color: % de hogares sin ${SERVICIOS[servicio].nombre.toLowerCase()} en cada departamento`
        : `Altura: % de hogares sin ${SERVICIOS[servicio].nombre.toLowerCase()} en la provincia · Color: en cada departamento`;
    leyenda.innerHTML = `<b>${titulo}</b>` + (servicio === 'resumen'
      ? `<p class="leyenda-aclaracion">Clasifica territorios, no hogares sin los cuatro servicios.</p><div class="leyenda-categorias">${RAMPAS.resumen.map((c, i) => `<div><i style="background:${c}"></i>${i} ${i === 1 ? 'servicio' : 'servicios'} bajo la media</div>`).join('')}</div>`
      : `<div class="leyenda-gradiente" style="background:linear-gradient(to right,${INFERNO.join(',')})"></div><div class="leyenda-marcas">${[0, 20, 40, 60, 80, 100].map((v) => `<span>${v}</span>`).join('')}</div>`)
      + '<div><i class="sin-censo"></i>Sin datos censales</div>';
  }
  function destino(p) {
    const raw = servicio === 'resumen' ? p.servicios_bajo_media : p[SERVICIOS[servicio].campo];
    if (p.sin_datos || raw == null) return { altura: 0, valor: 0, color: '#b9b9b9' };
    const v = servicio === 'resumen' ? raw : Math.max(0, Math.min(100, 100 - raw));
    const provincia = datosProvinciales[p.cpr];
    const provincial = servicio === 'resumen' ? provincia?.servicios_bajo_media_ponderado
      : provincia ? 100 - provincia[SERVICIOS[servicio].campo] : null;
    const escala = MAX_ALTURA / (servicio === 'resumen' ? 4 : 100);
    const alturaDepartamental = v * escala;
    const alturaProvincial = provincial == null ? alturaDepartamental : Math.max(0, provincial) * escala;
    const enProvincia = activo ? activo({ properties: p }) : p.cpr === provActual;
    return { altura: enProvincia ? alturaDepartamental : alturaProvincial,
      alturaProvincial, alturaDepartamental,
      valor: servicio === 'resumen' ? v * 25 : v, color: servicio === 'resumen' ? RAMPAS.resumen[v] : INFERNO[0] };
  }
  function colorExtrusion() {
    const color = servicio === 'resumen' ? ['coalesce', ['feature-state', 'color'], RAMPAS.resumen[0]]
      : ['interpolate', ['linear'], ['coalesce', ['feature-state', 'valor'], 0], ...INFERNO.flatMap((c, i) => [i * 20, c])];
    return ['case', ['boolean', ['feature-state', 'seleccionado'], false], ACENTO,
      ['boolean', ['feature-state', 'provinciaHover'], false], '#ffb7d2', color];
  }
  function alturaExtrusion() {
    return ['*', factorAltura, ['coalesce', ['feature-state', 'altura'], 0],
      ['case', ['boolean', ['feature-state', 'seleccionado'], false], 1.15, 1]];
  }
  function aplicarFactor() {
    if (!listo) return;
    for (const id of ['resto-volumen', 'departamento-volumen', 'departamento-elegido']) {
      map.setPaintProperty(id, 'fill-extrusion-height', alturaExtrusion());
    }
    map.setPaintProperty('resto', 'fill-opacity', factorAltura === 0 ? 0.2 : 0);
    map.setPaintProperty('resto-volumen', 'fill-extrusion-opacity', factorAltura === 0 ? 0 : 0.2);
  }
  // Cámara y altura comparten duración y curva; no se limita el pitch antes de animar.
  function animarDimension() {
    cancelAnimationFrame(dimensionFrame);
    const inicio = factorAltura, fin = modo3D ? 1 : 0, start = performance.now();
    map.setMaxPitch(60);
    map.easeTo({ pitch: pitch(), bearing: modo3D ? -20 : 0, duration, easing: suavizar });
    function tick(now) {
      const t = reduced ? 1 : Math.min(1, (now - start) / duration);
      factorAltura = inicio + (fin - inicio) * suavizar(t); aplicarFactor();
      if (t < 1) dimensionFrame = requestAnimationFrame(tick);
      else if (!modo3D) map.setMaxPitch(0);
    }
    dimensionFrame = requestAnimationFrame(tick);
  }
  // Interpolación explícita: las expresiones por entidad no garantizan transiciones de paint.
  function actualizarValores(duracion = 450) {
    dibujarLeyenda(); if (!listo) return;
    cancelAnimationFrame(frame);
    map.setPaintProperty('resto', 'fill-color', colorExtrusion());
    map.setPaintProperty('departamento-base', 'fill-color', colorExtrusion());
    for (const id of ['resto-volumen', 'departamento-volumen', 'departamento-elegido']) map.setPaintProperty(id, 'fill-extrusion-color', colorExtrusion());
    const pasos = [['deptos', validos]].flatMap(([source, fs]) => fs.map((f) => {
      const id = source === 'deptos' ? f.properties.codigo : f.properties.cpr;
      const key = `${source}:${id}`, fin = destino(f.properties);
      return { source, id, key, fin, inicio: visuales.get(key) || fin };
    }));
    const rgb = (c) => c.match(/\w\w/g).map((x) => parseInt(x, 16));
    const start = performance.now();
    function tick(now) {
      const t = reduced ? 1 : Math.min(1, (now - start) / duracion);
      for (const paso of pasos) {
        const a = rgb(paso.inicio.color.slice(1)), b = rgb(paso.fin.color.slice(1));
        const color = '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
        const estado = { altura: paso.inicio.altura + (paso.fin.altura - paso.inicio.altura) * t,
          alturaProvincial: paso.fin.alturaProvincial, alturaDepartamental: paso.fin.alturaDepartamental,
          valor: paso.inicio.valor + (paso.fin.valor - paso.inicio.valor) * t, color };
        visuales.set(paso.key, estado); map.setFeatureState({ source: paso.source, id: paso.id }, estado);
      }
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  }
  function fit(fs, maxZoom = 7, animar = true) {
    if (!fs.length) return;
    const bloque = document.querySelector('.introduccion');
    const izquierda = conZoom && !mobile() ? Math.max((bloque?.offsetWidth || 330) + 40, reserva() + 25) : 20;
    map.fitBounds(bounds(fs), { padding: { top: conZoom ? (mobile() ? 55 : 90) : 10,
      bottom: conZoom ? 65 : 10, left: Math.min(izquierda, host.clientWidth * 0.42), right: conZoom ? 75 : 10 },
      maxZoom, pitch: pitch(), bearing: modo3D ? -20 : 0, duration: animar ? duration : 0 });
  }
  function actualizarNivel() {
    if (!listo) return;
    const nacional = conZoom && provActual == null;
    const activos = activo ? ['in', ['get', 'codigo'], ['literal', validos.filter(activo).map((f) => f.properties.codigo)]]
      : nacional ? ['has', 'codigo'] : ['==', ['get', 'cpr'], provActual || ''];
    for (const id of ['departamento-base', 'departamento-volumen', 'departamento-elegido']) {
      map.setLayoutProperty(id, 'visibility', 'visible');
      const seleccion = ['==', ['get', 'codigo'], seleccionado || ''];
      map.setFilter(id, id === 'departamento-elegido' ? ['all', activos, seleccion]
        : id === 'departamento-volumen' ? ['all', activos, ['!', seleccion]] : activos);
    }
    map.setPaintProperty('departamento-volumen', 'fill-extrusion-opacity', seleccionado ? 0.6 : 1);
    map.setPaintProperty('departamento-base', 'fill-opacity', ['case', ['boolean', ['feature-state', 'atenuado'], false], 0.6, 1]);
    for (const id of ['resto', 'resto-volumen']) {
      map.setLayoutProperty(id, 'visibility', !nacional ? 'visible' : 'none');
      map.setFilter(id, activo ? ['!', ['in', ['get', 'codigo'], ['literal', validos.filter(activo).map((f) => f.properties.codigo)]]] : ['!=', ['get', 'cpr'], provActual || '']);
    }
    if (conZoom) for (const id of ['etiquetas-principales', 'etiquetas-detalle']) map.setLayoutProperty(id, 'visibility', nacional ? 'visible' : 'none');
    volver.hidden = !provActual; dibujarLeyenda();
  }
  function abrir(cpr) {
    if (!provs.some((f) => f.properties.cpr === cpr)) return;
    marcar(null); resaltarProvincia(null); provActual = cpr; onProvinciaHover(null); onProvincia(cpr); actualizarNivel();
    if (listo) { actualizarValores(600); fit(validos.filter((f) => f.properties.cpr === cpr)); }
  }
  function salir() {
    if (!provActual) return;
    marcar(null); provActual = null; onProvinciaHover(null); onProvincia(null); actualizarNivel();
    if (listo) { actualizarValores(600); fit(validos); }
  }
  map.on('load', () => {
    rayado(map); puntoEtiqueta(map);
    map.setLight({ anchor: 'viewport', position: [1.5, 200, 30], intensity: 0.5 });
    map.addSource('deptos', { type: 'geojson', data: collection(validos), promoteId: 'codigo' });
    map.addSource('provs', { type: 'geojson', data: collection(provs), promoteId: 'cpr' });
    map.addSource('sin-datos', { type: 'geojson', data: collection(especiales) });
    map.addLayer({ id: 'resto', type: 'fill', source: 'deptos', paint: { 'fill-color': colorExtrusion(), 'fill-opacity': factorAltura === 0 ? 0.2 : 0 } });
    map.addLayer({ id: 'departamento-base', type: 'fill', source: 'deptos', paint: { 'fill-color': colorExtrusion() } });
    for (const id of ['resto-volumen', 'departamento-volumen', 'departamento-elegido']) map.addLayer({ id, type: 'fill-extrusion', source: 'deptos', paint: {
      'fill-extrusion-color': colorExtrusion(), 'fill-extrusion-height': alturaExtrusion(),
      'fill-extrusion-height-transition': { duration: 0 }, 'fill-extrusion-opacity': id === 'resto-volumen' ? (factorAltura === 0 ? 0 : 0.2) : 1, 'fill-extrusion-vertical-gradient': true } });
    map.addLayer({ id: 'sin-censo', type: 'fill', source: 'sin-datos', paint: { 'fill-pattern': 'sin-censo' } });
    if (conZoom) {
      const puntos = provs.map((f) => {
        const cpr = f.properties.cpr, prioridad = PRIORIDADES.indexOf(cpr);
        return { type: 'Feature', geometry: { type: 'Point', coordinates: puntoMedio(validos.filter((d) => d.properties.cpr === cpr)) },
          properties: { cpr, nombre: cpr === '94' ? 'Tierra del Fuego' : nombreProvincia(f.properties.nombre), principal: prioridad >= 0, prioridad: prioridad >= 0 ? prioridad : 20 + Number(cpr) } };
      });
      map.addSource('etiquetas', { type: 'geojson', data: collection(puntos) });
      map.addLayer(simbolo('etiquetas-principales', 'etiquetas', { minzoom: 0, filter: ['==', ['get', 'principal'], true] }));
      map.addLayer(simbolo('etiquetas-detalle', 'etiquetas', { minzoom: 5, filter: ['==', ['get', 'principal'], false] }));
      map.addSource('malvinas', { type: 'geojson', data: collection([{ type: 'Feature', properties: { nombre: 'Islas Malvinas', prioridad: 0 }, geometry: { type: 'Point', coordinates: [-59.5, -51.8] } }]) });
      map.addLayer(simbolo('etiqueta-malvinas', 'malvinas'));
    }
    listo = true; actualizarNivel(); actualizarValores();
    marcar(seleccionado);
    fit(activo ? validos.filter(activo) : provActual ? validos.filter((f) => f.properties.cpr === provActual) : validos, conZoom ? 7 : 10, false);
  });
  map.on('error', (e) => { const status = document.querySelector('#status'); if (status) status.textContent = `No se pudo dibujar el mapa: ${e.error.message}`; console.error(e.error); });
  function hit(e) {
    if (!listo) return null;
    const nacional = conZoom && !provActual;
    const layers = ['departamento-elegido', 'departamento-volumen', 'departamento-base'];
    if (nacional) layers.unshift('etiquetas-principales', 'etiquetas-detalle');
    return map.queryRenderedFeatures(e.point, { layers })[0];
  }
  map.on('click', (e) => {
    const f = hit(e); if (!f) { onFuera(); return; }
    if (conZoom && !provActual) abrir(f.properties.cpr);
    else {
      const departamento = feats.find((d) => d.properties.codigo === f.properties.codigo);
      onSeleccion(departamento.properties, anclaDe(departamento));
    }
  });
  map.on('mousemove', (e) => {
    if (e.originalEvent?.sourceCapabilities?.firesTouchEvents) return;
    const f = hit(e); map.getCanvas().style.cursor = f ? 'pointer' : '';
    if (conZoom && !provActual) {
      resaltarProvincia(f?.properties.cpr || null);
      onProvinciaHover(f?.properties.cpr || null, e.originalEvent);
    }
    else if (f) onHover(feats.find((d) => d.properties.codigo === f.properties.codigo).properties);
  });
  map.getCanvas().addEventListener('mouseleave', () => { resaltarProvincia(null); onProvinciaHover(null); });
  new ResizeObserver(() => {
    map.resize();
    if (listo && !conZoom && host.clientWidth) fit(activo ? validos.filter(activo) : validos, 10, false);
  }).observe(container);

  // Recuadro permanente: ambas geometrías siguen presentes en el mapa principal.
  if (conZoom && especiales.length) {
    const inset = document.createElement('div'); inset.className = 'territorios-sin-censo';
    const titulo = document.createElement('span'); titulo.textContent = 'Territorios sin datos censales'; inset.append(titulo);
    const miniHost = document.createElement('div'); miniHost.className = 'territorios-canvas'; inset.append(miniHost); container.append(inset);
    const mini = new maplibregl.Map({ container: miniHost, style: vacio(), interactive: false, attributionControl: false, renderWorldCopies: false });
    mini.on('load', () => {
      rayado(mini); puntoEtiqueta(mini); mini.addSource('territorios', { type: 'geojson', data: collection(especiales) });
      mini.addLayer({ id: 'territorios', type: 'fill', source: 'territorios', paint: { 'fill-pattern': 'sin-censo' } });
      mini.addSource('nombres-territorios', { type: 'geojson', data: collection([
        { type: 'Feature', geometry: { type: 'Point', coordinates: [-52, -74] }, properties: { nombre: 'Antártida', prioridad: 0 } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [-59.5, -51.8] }, properties: { nombre: 'Islas Malvinas', prioridad: 1 } },
      ]) });
      mini.addLayer(simbolo('etiquetas-territorios', 'nombres-territorios'));
      mini.fitBounds(bounds(especiales), { padding: { top: 20, bottom: 10, left: 5, right: 50 }, duration: 0 });
    });
    new ResizeObserver(() => mini.resize()).observe(miniHost);
  }
  dibujarLeyenda();
  function resaltarProvincia(cpr) {
    if (!listo || provinciaHover === cpr) return;
    for (const f of validos) if (f.properties.cpr === provinciaHover || f.properties.cpr === cpr) {
      map.setFeatureState({ source: 'deptos', id: f.properties.codigo }, { provinciaHover: f.properties.cpr === cpr });
    }
    provinciaHover = cpr;
  }
  function marcar(codigo) {
    seleccionado = validos.some((f) => f.properties.codigo === codigo) ? codigo : null;
    if (!listo) return;
    for (const f of validos) map.setFeatureState({ source: 'deptos', id: f.properties.codigo }, {
      seleccionado: f.properties.codigo === seleccionado,
      atenuado: !!seleccionado && f.properties.codigo !== seleccionado && f.properties.cpr === seleccionado.slice(0, 2),
    });
    actualizarNivel();
  }
  function anclaDe(f) {
    const b = bounds([f]); return { map, lngLat: [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2] };
  }
  return {
    salir, nivel: () => provActual == null ? 'pais' : 'provincia',
    reiniciar() {
      if (provActual) salir();
      else { marcar(null); resaltarProvincia(null); onProvinciaHover(null); onProvincia(null); if (listo) fit(validos); }
    },
    setServicio(s) { if (s !== 'resumen' && !SERVICIOS[s]) return; servicio = s; actualizarValores(); },
    marcar,
    ancla(codigo) {
      const f = validos.find((d) => d.properties.codigo === codigo); if (!f) return null;
      return anclaDe(f);
    },
    enfocar(codigo) {
      if (!conZoom) return;
      const f = validos.find((d) => d.properties.codigo === codigo); if (!f) return;
      if (provActual !== f.properties.cpr) abrir(f.properties.cpr);
      this.marcar(codigo); if (listo) fit([f], 11);
    },
    entrarProvincia(nombre) { const f = provs.find((d) => nombreProvincia(d.properties.nombre) === nombre); if (f) abrir(f.properties.cpr); else salir(); },
  };
}

const PARTIDOS_GBA = new Set([
  '06028', '06035', '06091', '06260', '06270', '06274', '06371', '06408', '06410', '06412', '06427', '06434',
  '06490', '06515', '06539', '06560', '06568', '06658', '06749', '06756', '06760', '06805', '06840', '06861',
]);
export const esPartidoGBA = (f) => PARTIDOS_GBA.has(f.properties.codigo);
export const esAMBA = (f) => f.properties.codigo.startsWith('02') || esPartidoGBA(f);
