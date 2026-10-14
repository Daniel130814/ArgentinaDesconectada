// Mapa coroplético en SVG con D3: proyección, capas, zoom, leyenda y resaltado.
// Requiere d3 v7 como global (se carga por CDN en index.html).
const RAMPAS = {
  agua_red: ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'],
  cloacas_red: ['#f2f0f7', '#cbc9e2', '#9e9ac8', '#756bb1', '#54278f'],
  gas_red: ['#feedde', '#fdbe85', '#fd8d3c', '#e6550d', '#a63603'],
  internet_vivienda: ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c'],
  resumen: ['#ffffd4', '#fed98e', '#fe9929', '#d95f0e', '#993404'],
};
const GRIS = '#c4c4c4';

export const SERVICIOS = {
  agua_red: { nombre: 'Agua de red', campo: 'pct_agua_red', hogares: 'hogares_agua_red' },
  cloacas_red: { nombre: 'Cloacas', campo: 'pct_cloacas_red', hogares: 'hogares_cloacas_red' },
  gas_red: { nombre: 'Gas de red', campo: 'pct_gas_red', hogares: 'hogares_gas_red' },
  internet_vivienda: { nombre: 'Internet', campo: 'pct_internet_vivienda', hogares: 'hogares_internet_vivienda' },
};

// Cortes fijos para todos los servicios: 0–20, 20–40, 40–60, 60–80 y 80–100 %.
const CORTES = [20, 40, 60, 80];

// Sector antártico (sin datos): queda fuera del encuadre y no se dibuja.
// Las islas del Atlántico Sur (94021, con Malvinas) sí se dibujan, en gris.
const ANTARTIDA = '94028';
const ZOOM_MAX = 40;
const DURACION = 750; // ms de la animación entre vista nacional y vista de provincia

function clase(valor, cortes) {
  let i = 0;
  while (i < cortes.length && valor >= cortes[i]) i++;
  return i;
}

// d3 espera anillos exteriores en sentido horario; si el GeoJSON viene al revés, el polígono
// "cubre" el resto de la esfera. Se invierte solo cuando hace falta (idempotente).
function orientar(geometria) {
  const poligonos = geometria.type === 'Polygon' ? [geometria.coordinates] : geometria.coordinates;
  for (const anillos of poligonos) {
    if (d3.geoArea({ type: 'Polygon', coordinates: anillos }) > 2 * Math.PI) anillos.forEach((a) => a.reverse());
  }
}

export function initMap(container, geojson, opciones = {}) {
  const {
    filtro = null, activo = null, conLeyenda = true, conZoom = true, meridiano = 66, relleno = 8, reserva = () => 0,
    contenedorLeyenda = null, provincias = null, pais = null,
    onHover = () => {}, onSeleccion = () => {}, onProvinciaHover = () => {}, onProvincia = () => {},
  } = opciones;
  if (!container) throw new Error('No se encontró el contenedor del mapa.');

  const feats = geojson.features.filter((f) => f.properties.codigo !== ANTARTIDA && (!filtro || filtro(f)));
  feats.forEach((f) => orientar(f.geometry));
  // El encuadre es el territorio con datos: deja afuera las islas lejanas y la Antártida.
  // Con `activo` (recuadro del AMBA) solo cuentan para el encuadre los departamentos activos.
  const encuadre = { type: 'FeatureCollection', features: feats.filter((f) => !f.properties.sin_datos && (!activo || activo(f))) };
  const limites = provincias
    ? provincias.features.filter((f) => feats.some((d) => d.properties.codigo.startsWith(f.properties.cpr)))
    : [];
  limites.forEach((f) => orientar(f.geometry));
  const contorno = pais ? pais.features : [];
  contorno.forEach((f) => orientar(f.geometry));

  let servicio = 'agua_red';
  let seleccionado = null;
  let provActual = null; // código de la provincia abierta; null = vista nacional
  let ancho = 0;
  let alto = 0;
  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Transverse Mercator (conforme) centrada en el meridiano del territorio.
  const proyeccion = d3.geoTransverseMercator().rotate([meridiano, 0]);
  const ruta = d3.geoPath(proyeccion);

  const raiz = d3.select(container).classed('mapa-svg', true);
  const svg = raiz.append('svg').attr('class', 'mapa nivel-pais');
  const mapa = svg.append('g');

  const valorDe = (p) => {
    if (p.sin_datos) return null;
    return servicio === 'resumen' ? p.servicios_bajo_media : p[SERVICIOS[servicio].campo];
  };
  const colorDe = (p) => {
    const v = valorDe(p);
    if (v == null) return GRIS;
    const rampa = RAMPAS[servicio];
    return servicio === 'resumen' ? rampa[v] : rampa[clase(v, CORTES)];
  };

  // Capas, de abajo hacia arriba: departamentos, límites provinciales, resaltado.
  const deptos = mapa
    .append('g')
    .selectAll('path')
    .data(feats, (d) => d.properties.codigo)
    .join('path')
    .attr('class', 'depto')
    .attr('fill', (d) => colorDe(d.properties))
    .attr('stroke', (d) => colorDe(d.properties)); // borde del mismo color: tapa las costuras entre polígonos
  // En la vista nacional los departamentos no captan el mouse: lo captan estas áreas provinciales.
  const hits = conZoom ? mapa.append('g').selectAll('path').data(limites).join('path').attr('class', 'hit-prov') : null;
  const provs = mapa.append('g').attr('class', 'provincias').selectAll('path').data(limites).join('path').attr('class', 'provincia');
  const bordePais = mapa.append('g').selectAll('path').data(contorno).join('path').attr('class', 'pais');
  const resalte = mapa.append('g').attr('class', 'resalte');
  const marcaHover = resalte.append('path').attr('class', 'marca-hover');
  const marcaHalo = resalte.append('path').attr('class', 'marca-halo');
  const marcaSel = resalte.append('path').attr('class', 'marca-seleccion');

  const esActivo = (f) => (activo ? activo(f) : provActual != null && f.properties.codigo.startsWith(provActual));
  if (activo) svg.classed('nivel-provincia', true).classed('nivel-pais', false);
  deptos.classed('activa', esActivo);

  // Hover solo con mouse; en pantallas táctiles, un toque selecciona (el clic lo emite el toque).
  let hover = null;
  deptos
    .on('pointerenter', (e, d) => {
      if (e.pointerType !== 'mouse') return;
      hover = d;
      marcaHover.attr('d', ruta(d));
      onHover(d.properties);
    })
    .on('pointerleave', (e) => {
      if (e.pointerType !== 'mouse') return;
      hover = null;
      marcaHover.attr('d', null);
    })
    .on('click', (e, d) => onSeleccion(d.properties));

  if (hits) {
    hits
      .on('pointerenter', (e, d) => {
        if (e.pointerType !== 'mouse') return;
        hover = d;
        marcaHover.attr('d', ruta(d));
        onProvinciaHover(d.properties.cpr, e);
      })
      .on('pointermove', (e, d) => {
        if (e.pointerType === 'mouse') onProvinciaHover(d.properties.cpr, e);
      })
      .on('pointerleave', (e) => {
        if (e.pointerType !== 'mouse') return;
        hover = null;
        marcaHover.attr('d', null);
        onProvinciaHover(null);
      })
      .on('click', (e, d) => entrarProvincia(d.properties.cpr));
  }

  // Zoom y paneo
  const zoom = d3.zoom().scaleExtent([1, ZOOM_MAX]);
  let inicio = null;
  let volver = null;
  if (conZoom) {
    volver = raiz.append('button').attr('type', 'button').attr('class', 'mapa-volver').property('hidden', true).text('← Argentina');
    volver.on('click', () => salir());
    inicio = raiz.append('button').attr('type', 'button').attr('class', 'mapa-inicio').attr('disabled', true).text('Volver al inicio');
    zoom.on('zoom', (e) => {
      mapa.attr('transform', e.transform);
      inicio.property('disabled', e.transform.k === 1 && e.transform.x === 0 && e.transform.y === 0);
    });
    svg.call(zoom);
    inicio.on('click', () => svg.transition().duration(sinMovimiento ? 0 : 600).call(zoom.transform, d3.zoomIdentity));
  }

  function trazar() {
    deptos.attr('d', ruta);
    provs.attr('d', ruta);
    if (hits) hits.attr('d', ruta);
    bordePais.attr('d', ruta);
    marcaHover.attr('d', hover ? ruta(hover) : null);
    const d = seleccionado ? ruta(seleccionado) : null;
    marcaHalo.attr('d', d);
    marcaSel.attr('d', d);
  }

  // Se redibuja al cambiar el tamaño del contenedor (ventana, giro del celular, layout).
  function medir() {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height || (width === ancho && height === alto)) return;
    ancho = width;
    alto = height;
    svg.attr('width', ancho).attr('height', alto);
    proyeccion.fitExtent([[relleno, relleno], [ancho - relleno, alto - relleno]], encuadre);
    trazar();
    if (conZoom) {
      // Margen de media pantalla: permite encuadrar provincias que están pegadas al borde del mapa.
      zoom.extent([[0, 0], [ancho, alto]]).translateExtent([[-ancho / 2, -alto / 2], [1.5 * ancho, 1.5 * alto]]);
      svg.call(zoom.translateBy, 0, 0); // vuelve a encajar el paneo actual en los nuevos límites
    }
  }
  let pendiente = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(pendiente);
    pendiente = requestAnimationFrame(medir);
  }).observe(container);
  medir();

  function dibujarLeyenda() {
    if (!conLeyenda) return;
    const rampa = RAMPAS[servicio];
    let html;
    if (servicio === 'resumen') {
      html = '<b>Servicios bajo la media nacional<br>(departamentos, de 0 a 4)</b>';
      html += rampa.map((c, i) => `<div><i style="background:${c}"></i>${i}</div>`).join('');
    } else {
      html = `<b>Hogares con ${SERVICIOS[servicio].nombre.toLowerCase()} (%)</b>`;
      const lims = [0, ...CORTES, 100];
      html += rampa.map((c, i) => `<div><i style="background:${c}"></i>${lims[i].toFixed(0)}% – ${lims[i + 1].toFixed(0)}%</div>`).join('');
    }
    html += `<div><i style="background:${GRIS}"></i>Sin datos</div>`;
    leyenda.html(html);
  }
  const leyenda = conLeyenda ? (contenedorLeyenda ? d3.select(contenedorLeyenda) : raiz.append('div').attr('class', 'leyenda')) : null;
  dibujarLeyenda();

  // Acerca la vista a un conjunto de polígonos, con transición.
  // reserva() es el ancho tapado por el recuadro del AMBA (a la izquierda): la vista se centra en el resto.
  function encuadrar(fs, { maxZoom = 8, margen = 0.85 } = {}) {
    if (!conZoom || !fs.length || !ancho) return;
    const [[x0, y0], [x1, y1]] = ruta.bounds({ type: 'FeatureCollection', features: fs });
    const izq = reserva();
    const util = ancho - izq;
    const k = Math.max(1, Math.min(maxZoom, margen / Math.max((x1 - x0) / util, (y1 - y0) / alto)));
    const t = d3.zoomIdentity.translate(izq + util / 2, alto / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    svg.transition().duration(sinMovimiento ? 0 : DURACION).call(zoom.transform, t);
  }

  function actualizarNivel() {
    const enProvincia = provActual != null;
    svg.classed('nivel-provincia', enProvincia).classed('nivel-pais', !enProvincia);
    deptos.classed('activa', esActivo);
    if (inicio) inicio.property('hidden', enProvincia);
    if (volver) volver.property('hidden', !enProvincia);
    hover = null;
    marcaHover.attr('d', null);
  }

  // Abre una provincia: zoom animado, malla de sus departamentos y el resto atenuado.
  function abrir(cpr) {
    provActual = cpr;
    actualizarNivel();
    onProvincia(cpr); // el recuadro del AMBA se muestra o se oculta antes de calcular el encuadre
  }
  function entrarProvincia(cpr) {
    const fs = feats.filter((f) => f.properties.codigo.startsWith(cpr) && !f.properties.sin_datos);
    if (!conZoom || !fs.length) return;
    abrir(cpr);
    encuadrar(fs, { maxZoom: ZOOM_MAX, margen: 0.9 });
  }
  function salir() {
    if (provActual == null) return;
    provActual = null;
    actualizarNivel();
    onProvincia(null);
    svg.transition().duration(sinMovimiento ? 0 : DURACION).call(zoom.transform, d3.zoomIdentity);
  }
  const porCodigo = (codigo) => feats.find((f) => f.properties.codigo === codigo);

  return {
    salir,
    nivel: () => (provActual == null ? 'pais' : 'provincia'),
    setServicio(s) {
      servicio = s;
      deptos.interrupt().transition().duration(sinMovimiento ? 0 : 450).attr('fill', (d) => colorDe(d.properties)).attr('stroke', (d) => colorDe(d.properties));
      dibujarLeyenda();
    },
    // Resalta un departamento con borde oscuro (sin mover el mapa); null quita la marca.
    marcar(codigo) {
      seleccionado = (codigo && porCodigo(codigo)) || null;
      const d = seleccionado ? ruta(seleccionado) : null;
      marcaHalo.attr('d', d);
      marcaSel.attr('d', d);
    },
    // Abre la provincia del departamento (si no estaba abierta) y se acerca a él.
    enfocar(codigo) {
      if (!conZoom) return;
      const cpr = codigo.slice(0, 2);
      if (provActual !== cpr) abrir(cpr);
      this.marcar(codigo);
      if (seleccionado) encuadrar([seleccionado], { maxZoom: ZOOM_MAX, margen: 0.35 });
    },
    // Las islas del Atlántico Sur y la Antártida no tienen provincia: no se pueden abrir.
    entrarProvincia(nombre) {
      const f = limites.find((l) => l.properties.nombre === nombre);
      if (f) entrarProvincia(f.properties.cpr);
      else salir();
    },
  };
}

// Los 24 partidos del conurbano bonaerense (Gran Buenos Aires).
const PARTIDOS_GBA = new Set([
  '06028', '06035', '06091', '06260', '06270', '06274', '06371', '06408', '06410', '06412', '06427', '06434',
  '06490', '06515', '06539', '06560', '06568', '06658', '06749', '06756', '06760', '06805', '06840', '06861',
]);
export const esPartidoGBA = (f) => PARTIDOS_GBA.has(f.properties.codigo);
// Para el recuadro: los 24 partidos, más CABA como referencia (atenuada).
export const esAMBA = (f) => f.properties.codigo.startsWith('02') || esPartidoGBA(f);
