// Cartografía local sobre un estilo vacío, sin mapas base ni tiles externos.
// Rampa secuencial propia, de asfalto a amarillo señal: el % de hogares sin servicio (0–100), igual en los 4 servicios.
export const PARADAS = [[0, '#23272E'], [25, '#4A3F2C'], [50, '#8C5A1E'], [75, '#E07A14'], [100, '#F7D046']];
export const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export const mezclar = (a, b, t) => {
  const x = rgb(a), y = rgb(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
export function colorEnRampa(v) {
  const x = Math.max(0, Math.min(100, v));
  for (let i = 1; i < PARADAS.length; i++) {
    if (x <= PARADAS[i][0]) return mezclar(PARADAS[i - 1][1], PARADAS[i][1], (x - PARADAS[i - 1][0]) / (PARADAS[i][0] - PARADAS[i - 1][0]));
  }
  return PARADAS[PARADAS.length - 1][1];
}
// Servicios: un color por tramo de 20 puntos (el del punto medio). Resumen (0–4): cinco pasos de la misma rampa.
export const RAMPAS = {
  ...Object.fromEntries(['agua_red', 'cloacas_red', 'gas_red', 'internet_vivienda'].map((k) => [k, [10, 30, 50, 70, 90].map(colorEnRampa)])),
  resumen: PARADAS.map(([, c]) => c),
};
const colorDe = (servicio, v) => (servicio === 'resumen' ? RAMPAS.resumen[v] : colorEnRampa(v));
export const SERVICIOS = {
  agua_red: { nombre: 'Agua de red', campo: 'pct_agua_red', hogares: 'hogares_agua_red' },
  cloacas_red: { nombre: 'Cloacas', campo: 'pct_cloacas_red', hogares: 'hogares_cloacas_red' },
  gas_red: { nombre: 'Gas de red', campo: 'pct_gas_red', hogares: 'hogares_gas_red' },
  internet_vivienda: { nombre: 'Internet', campo: 'pct_internet_vivienda', hogares: 'hogares_internet_vivienda' },
};
const ESPECIALES = new Set(['94021', '94028']);
const MAX_ALTURA = 20000; // altura máxima de extrusión, escala lineal; unidades visuales, sin significado geográfico.
const PITCH_ESCRITORIO = 40, PITCH_MOVIL = 30;
const FONDO = '#0B0D10', HUESO = '#F5F5F0';
const LINEA_DEPARTAMENTO = 0.4, LINEA_PROVINCIA = 0.9; // opacidad de las líneas de la vista plana
const DIM_OTRAS = 0.7, DIM_VECINOS = 0.3, BORDE_NACIONAL = 0.4; // mezclas con el fondo, por color (sin transparencia)
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
// Tipografías del mapa alojadas en el repo (fonts/): la ruta es relativa a la página, así funciona en cualquier subcarpeta.
const GLIFOS = `${new URL('.', document.baseURI).href}fonts/{fontstack}/{range}.pbf`;
const vacio = () => ({ version: 8, glyphs: GLIFOS,
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
    reserva = () => 0, contenedorLeyenda = null, provincias = null, resumen = null, bordes = null,
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
  let servicio = 'agua_red', provActual = null, seleccionado = null, listo = false, provinciaHover = null;
  let modo3D = false; // la vista plana es la predeterminada; el botón agrega altura y perspectiva
  let frame = 0, visuales = new Map();
  let dimensionFrame = 0, factorAltura = 0; // 0 = plano (sin altura); 1 = altura completa
  const host = document.createElement('div');
  host.className = 'mapa-canvas'; container.append(host);
  const pitch = () => modo3D ? (mobile() ? PITCH_MOVIL : PITCH_ESCRITORIO) : 0;
  const map = new maplibregl.Map({ container: host, style: vacio(), center: [-64, -39], zoom: 3,
    pitch: pitch(), bearing: modo3D ? -20 : 0, maxPitch: modo3D ? 60 : 0,
    attributionControl: false, renderWorldCopies: false,
    maxZoom: 14, minZoom: 1, dragPan: conZoom, scrollZoom: conZoom, boxZoom: conZoom,
    doubleClickZoom: conZoom, touchZoomRotate: conZoom, keyboard: conZoom, dragRotate: conZoom });
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
    boton.type = 'button'; boton.className = 'mapa-dimension'; boton.textContent = 'Vista 3D';
    boton.setAttribute('aria-label', 'Cambiar a vista 3D'); boton.setAttribute('aria-pressed', 'true');
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
      : `<div class="leyenda-gradiente" style="background:linear-gradient(to right,${PARADAS.map(([v, c]) => `${c} ${v}%`).join(',')})"></div><div class="leyenda-marcas">${[0, 20, 40, 60, 80, 100].map((v) => `<span>${v}</span>`).join('')}</div>`)
      + '<div><i class="sin-censo"></i>Sin datos censales</div>';
  }
  const modoProvincia = () => activo != null || provActual != null;
  const esActiva = (p) => (activo ? activo({ properties: p }) : p.cpr === provActual);
  // Altura (escala lineal, máximo MAX_ALTURA) y color base de cada entidad; `dim` es cuánto se mezcla con el fondo.
  function destino(p) {
    const raw = servicio === 'resumen' ? p.servicios_bajo_media : p[SERVICIOS[servicio].campo];
    if (p.sin_datos || raw == null) return { altura: 0, valor: 0, color: '#b9b9b9', dim: 0 };
    const v = servicio === 'resumen' ? raw : Math.max(0, Math.min(100, 100 - raw));
    const provincial = alturaProvincialDe(p.cpr);
    const escala = MAX_ALTURA / (servicio === 'resumen' ? 4 : 100);
    const alturaDepartamental = v * escala;
    const alturaProvincial = provincial == null ? alturaDepartamental : provincial;
    const activa = esActiva(p);
    // Al entrar a una provincia, las demás bajan a altura 0 y se atenúan por color.
    return { altura: !modoProvincia() ? alturaProvincial : activa ? alturaDepartamental : 0,
      valor: v, color: colorDe(servicio, v), dim: modoProvincia() && !activa ? DIM_OTRAS : 0 };
  }
  function alturaProvincialDe(cpr) {
    const d = datosProvinciales[cpr];
    if (!d) return null;
    const escala = MAX_ALTURA / (servicio === 'resumen' ? 4 : 100);
    const v = servicio === 'resumen' ? d.servicios_bajo_media_ponderado : 100 - d[SERVICIOS[servicio].campo];
    return v == null ? null : Math.max(0, v) * escala;
  }
  // Nada de transparencia: la selección y el atenuado se resuelven con el color final de cada departamento.
  function colorFinal(p, v) {
    if (p.codigo === seleccionado) return HUESO;
    const vecino = seleccionado && p.cpr === seleccionado.slice(0, 2) ? DIM_VECINOS : 0;
    let c = v.color;
    const dim = Math.max(v.dim, vecino);
    if (dim) c = mezclar(c, FONDO, dim);
    if (provinciaHover === p.cpr) c = mezclar(c, HUESO, 0.35);
    return c;
  }
  function aplicar(f, v) {
    const p = f.properties, color = colorFinal(p, v), sel = p.codigo === seleccionado;
    map.setFeatureState({ source: 'deptos', id: p.codigo }, { altura: v.altura, color, seleccionado: sel });
    if (bordes?.departamentos) {
      // Franjas de departamento: nítidas dentro de la provincia abierta; en la vista nacional, mezcla al 40% con el color.
      const nitida = modoProvincia() && esActiva(p);
      map.setFeatureState({ source: 'bordes-deptos', id: p.codigo }, { altura: v.altura, seleccionado: sel, colorBorde: mezclar(color, FONDO, nitida ? 1 : BORDE_NACIONAL) });
    }
  }
  function reaplicar(cond) {
    if (!listo) return;
    for (const f of validos) if (cond(f)) { const v = visuales.get(`deptos:${f.properties.codigo}`); if (v) aplicar(f, v); }
  }
  const expresionColor = () => ['coalesce', ['feature-state', 'color'], PARADAS[0][1]];
  function alturaExtrusion(extra = 0) {
    const base = ['*', factorAltura, ['coalesce', ['feature-state', 'altura'], 0],
      ['case', ['boolean', ['feature-state', 'seleccionado'], false], 1.15, 1]];
    return extra ? ['+', base, extra] : base;
  }
  const CAPAS_ALTURA = () => [['departamento-volumen', 0], ['borde-departamento', 1], ['borde-provincia', 1]];
  function aplicarFactor() {
    if (!listo) return;
    for (const [id, extra] of CAPAS_ALTURA()) if (map.getLayer(id)) map.setPaintProperty(id, 'fill-extrusion-height', alturaExtrusion(extra));
    const plano = factorAltura === 0;
    // En vista plana las franjas se reemplazan por líneas comunes. Se alternan por opacidad (sin reconstruir mosaicos).
    for (const id of ['borde-departamento', 'borde-provincia']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', plano ? 'none' : 'visible');
    map.setPaintProperty('linea-departamento', 'line-opacity', plano ? LINEA_DEPARTAMENTO : 0);
    map.setPaintProperty('linea-provincia', 'line-opacity', plano ? LINEA_PROVINCIA : 0);
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
    const pasos = validos.map((f) => {
      const key = `deptos:${f.properties.codigo}`, fin = destino(f.properties);
      return { f, key, fin, inicio: visuales.get(key) || fin };
    });
    const pasosProv = bordes?.provincias ? provs.map((f) => {
      const key = `provs:${f.properties.cpr}`, fin = { altura: modoProvincia() ? 0 : (alturaProvincialDe(f.properties.cpr) ?? 0) };
      return { id: f.properties.cpr, key, fin, inicio: visuales.get(key) || fin };
    }) : [];
    const start = performance.now();
    function tick(now) {
      const t = reduced ? 1 : Math.min(1, (now - start) / duracion);
      for (const paso of pasos) {
        const a = rgb(paso.inicio.color), b = rgb(paso.fin.color);
        const estado = { altura: paso.inicio.altura + (paso.fin.altura - paso.inicio.altura) * t,
          valor: paso.inicio.valor + (paso.fin.valor - paso.inicio.valor) * t,
          dim: paso.inicio.dim + (paso.fin.dim - paso.inicio.dim) * t,
          color: '#' + a.map((x, i) => Math.round(x + (b[i] - x) * t).toString(16).padStart(2, '0')).join('') };
        visuales.set(paso.key, estado); aplicar(paso.f, estado);
      }
      for (const paso of pasosProv) {
        const estado = { altura: paso.inicio.altura + (paso.fin.altura - paso.inicio.altura) * t };
        visuales.set(paso.key, estado); map.setFeatureState({ source: 'bordes-provs', id: paso.id }, estado);
      }
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  }
  function fit(fs, maxZoom = 14, animar = true, extra = {}) { // sin tope que impida acercarse a provincias chicas (CABA llega a ~11,5)
    if (!fs.length) return;
    const bloque = document.querySelector('.introduccion');
    const izquierda = conZoom && !mobile() ? Math.max((bloque?.offsetWidth || 330) + 40, reserva() + 25) : 20;
    map.fitBounds(bounds(fs), { padding: { top: conZoom ? (mobile() ? 55 : 90) : 10,
      bottom: (conZoom ? 65 : 10) + (extra.abajo || 0), left: Math.min(izquierda, host.clientWidth * 0.42), right: (conZoom ? 75 : 10) + (extra.derecha || 0) },
      maxZoom, pitch: pitch(), bearing: modo3D ? -20 : 0, duration: animar ? duration : 0 });
  }
  // Dónde queda en pantalla el departamento seleccionado: lejos de la tarjeta, que se abre a su lado.
  function destinoPx() {
    const ancho = host.clientWidth, alto = host.clientHeight;
    if (mobile()) return { x: ancho / 2, y: alto * 0.28 };
    const bloque = document.querySelector('.introduccion');
    const izquierda = Math.min(Math.max((bloque?.offsetWidth || 330) + 40, reserva() + 25), ancho * 0.42);
    return { x: izquierda + (ancho - izquierda) * 0.3, y: alto / 2 };
  }
  // Al buscar un departamento se deja lugar para la tarjeta: a un costado en escritorio, abajo en celular.
  const lugarTarjeta = () => (mobile() ? { abajo: host.clientHeight * 0.55 } : { derecha: 440 });
  function destinoBusqueda() {
    const ancho = host.clientWidth, alto = host.clientHeight, e = lugarTarjeta();
    if (e.abajo) return { x: ancho / 2, y: (55 + alto - 65 - e.abajo) / 2 + 20 };
    const bloque = document.querySelector('.introduccion');
    const izquierda = Math.min(Math.max((bloque?.offsetWidth || 330) + 40, reserva() + 25), ancho * 0.42);
    return { x: (izquierda + ancho - 75 - e.derecha) / 2, y: alto / 2 };
  }
  // easeTo al centroide manteniendo zoom, pitch y bearing.
  function centrarEn(f) {
    const b = bounds([f]), d = destinoPx();
    map.easeTo({ center: [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2],
      offset: [d.x - host.clientWidth / 2, d.y - host.clientHeight / 2], duration, easing: suavizar });
  }
  function actualizarNivel() {
    if (!listo) return;
    const nacional = conZoom && provActual == null;
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
    map.addLayer({ id: 'departamento-base', type: 'fill', source: 'deptos', paint: { 'fill-color': expresionColor(), 'fill-opacity': 1 } });
    map.addLayer({ id: 'departamento-volumen', type: 'fill-extrusion', source: 'deptos', paint: {
      'fill-extrusion-color': expresionColor(), 'fill-extrusion-height': alturaExtrusion(), 'fill-extrusion-base': 0,
      'fill-extrusion-height-transition': { duration: 0 }, 'fill-extrusion-opacity': 1, 'fill-extrusion-vertical-gradient': true } });
    // Límites como franjas internas extruidas, con la misma altura (+1) y las mismas transiciones que su polígono.
    const franja = (id, source, color) => map.addLayer({ id, type: 'fill-extrusion', source, paint: {
      'fill-extrusion-color': color, 'fill-extrusion-height': alturaExtrusion(1), 'fill-extrusion-base': 0,
      'fill-extrusion-height-transition': { duration: 0 }, 'fill-extrusion-opacity': 1, 'fill-extrusion-vertical-gradient': false } });
    if (bordes?.departamentos) {
      map.addSource('bordes-deptos', { type: 'geojson', data: bordes.departamentos, promoteId: 'codigo' });
      franja('borde-departamento', 'bordes-deptos', ['coalesce', ['feature-state', 'colorBorde'], FONDO]);
    }
    if (bordes?.provincias) {
      map.addSource('bordes-provs', { type: 'geojson', data: bordes.provincias, promoteId: 'cpr' });
      franja('borde-provincia', 'bordes-provs', FONDO);
    }
    map.addLayer({ id: 'linea-departamento', type: 'line', source: 'deptos', paint: { 'line-color': HUESO, 'line-width': 0.4, 'line-opacity': 0 } });
    map.addLayer({ id: 'linea-provincia', type: 'line', source: 'provs', paint: { 'line-color': HUESO, 'line-width': 1.2, 'line-opacity': 0 } });
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
    listo = true; aplicarFactor(); actualizarNivel(); actualizarValores();
    marcar(seleccionado);
    fit(activo ? validos.filter(activo) : provActual ? validos.filter((f) => f.properties.cpr === provActual) : validos, conZoom ? 14 : 10, false);
  });
  map.on('error', (e) => { const status = document.querySelector('#status'); if (status) status.textContent = `No se pudo dibujar el mapa: ${e.error.message}`; console.error(e.error); });
  // Dentro de una provincia solo responden sus departamentos; las demás no son interactivas.
  const interactivo = (p) => (activo ? activo({ properties: p }) : !conZoom || provActual == null || p.cpr === provActual);
  function hit(e) {
    if (!listo) return null;
    const nacional = conZoom && !provActual;
    const layers = ['departamento-volumen', 'departamento-base'];
    if (nacional) layers.unshift('etiquetas-principales', 'etiquetas-detalle');
    const f = map.queryRenderedFeatures(e.point, { layers }).find((x) => !x.properties.codigo || interactivo(x.properties));
    return f || null;
  }
  map.on('click', (e) => {
    const f = hit(e); if (!f) { onFuera(); return; }
    if (conZoom && !provActual) abrir(f.properties.cpr);
    else {
      const departamento = feats.find((d) => d.properties.codigo === f.properties.codigo);
      if (conZoom) centrarEn(departamento);
      onSeleccion(departamento.properties, anclaDe(departamento, conZoom));
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
    const antes = provinciaHover;
    provinciaHover = cpr;
    reaplicar((f) => f.properties.cpr === antes || f.properties.cpr === cpr);
  }
  function marcar(codigo) {
    const antes = seleccionado;
    seleccionado = validos.some((f) => f.properties.codigo === codigo) ? codigo : null;
    if (!listo) return;
    const afectadas = new Set([antes, seleccionado].filter(Boolean).map((c) => c.slice(0, 2)));
    reaplicar((f) => afectadas.has(f.properties.cpr));
    actualizarNivel();
  }
  function anclaDe(f, conDestino = false) {
    const b = bounds([f]), centro = [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2];
    // mitadAncho: cuánto mide hoy, en pantalla, la mitad del departamento; la tarjeta se corre ese tanto para no taparlo.
    return { map, lngLat: centro, destino: conDestino ? destinoPx() : null,
      mitadAncho: () => Math.abs(map.project([b[1][0], centro[1]]).x - map.project(centro).x) };
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
      const a = anclaDe(f);
      return conZoom ? { ...a, destino: destinoBusqueda() } : a;
    },
    enfocar(codigo) {
      if (!conZoom) return;
      const f = validos.find((d) => d.properties.codigo === codigo); if (!f) return;
      if (provActual !== f.properties.cpr) abrir(f.properties.cpr);
      this.marcar(codigo); if (listo) fit([f], 13, true, lugarTarjeta());
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
