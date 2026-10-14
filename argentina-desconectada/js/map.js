// Capa coroplética por departamento: colores, cortes y leyenda.
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

function clase(valor, cortes) {
  let i = 0;
  while (i < cortes.length && valor >= cortes[i]) i++;
  return i;
}

export function initMap(container, geojson, opciones = {}) {
  const { filtro = null, encuadre = null, conLeyenda = true, provincias = null, zoomSnap = 1, onHover = () => {}, onSeleccion = () => {} } = opciones;
  if (!container) throw new Error('No se encontró el contenedor del mapa.');
  const map = L.map(container, { zoomSnap, zoomDelta: zoomSnap < 1 ? 0.5 : 1 });
  map.attributionControl.addAttribution('Datos: INDEC, Censo 2022');

  let servicio = 'agua_red';
  const cortes = CORTES;
  let capa;
  const leyenda = L.control({ position: 'bottomright' });
  leyenda.onAdd = () => L.DomUtil.create('div', 'leyenda');
  if (conLeyenda) leyenda.addTo(map);

  const feats = geojson.features;

  function valorDe(p) {
    if (p.sin_datos) return null;
    return servicio === 'resumen' ? p.servicios_bajo_media : p[SERVICIOS[servicio].campo];
  }

  function colorDe(p) {
    const v = valorDe(p);
    if (v == null) return GRIS;
    const rampa = RAMPAS[servicio];
    return servicio === 'resumen' ? rampa[v] : rampa[clase(v, cortes)];
  }

  function dibujarLeyenda() {
    if (!conLeyenda) return;
    const div = leyenda.getContainer();
    const rampa = RAMPAS[servicio];
    let html;
    if (servicio === 'resumen') {
      html = '<b>Servicios bajo la media nacional<br>(departamentos, de 0 a 4)</b>';
      html += rampa.map((c, i) => `<div><i style="background:${c}"></i>${i}</div>`).join('');
    } else {
      html = `<b>Hogares con ${SERVICIOS[servicio].nombre.toLowerCase()} (%)</b>`;
      const lims = [0, ...cortes, 100];
      html += rampa
        .map((c, i) => `<div><i style="background:${c}"></i>${lims[i].toFixed(0)}% – ${lims[i + 1].toFixed(0)}%</div>`)
        .join('');
    }
    html += `<div><i style="background:${GRIS}"></i>Sin datos</div>`;
    div.innerHTML = html;
  }

  // Capas por encima de los departamentos (y de su resaltado al pasar el mouse), sin captar el mouse.
  map.createPane('limites').style.zIndex = 450;
  map.createPane('seleccion').style.zIndex = 460;
  map.getPane('limites').style.pointerEvents = 'none';
  map.getPane('seleccion').style.pointerEvents = 'none';
  if (provincias) {
    L.geoJSON(provincias, {
      pane: 'limites',
      interactive: false,
      style: { fill: false, color: '#000000', weight: 1.4, opacity: 1 },
    }).addTo(map);
  }
  let contorno = null; // línea roja del departamento seleccionado
  function estilo(f) {
    return { fillColor: colorDe(f.properties), fillOpacity: 0.9, color: '#ffffff', weight: 0.4 };
  }

  function capaDe(codigo) {
    let hallada = null;
    capa.eachLayer((l) => {
      if (l.feature.properties.codigo === codigo) hallada = l;
    });
    return hallada;
  }

  function dibujar() {
    if (capa) capa.remove();
    capa = L.geoJSON(filtro ? { ...geojson, features: feats.filter(filtro) } : geojson, {
      style: estilo,
      onEachFeature: (f, layer) => {
        layer.on('mouseover', () => {
          layer.setStyle({ weight: 1.5, color: '#172635' });
          layer.bringToFront();
          onHover(f.properties);
        });
        layer.on('click', () => onSeleccion(f.properties));
        layer.on('mouseout', () => capa.resetStyle(layer));
      },
    }).addTo(map);
    dibujarLeyenda();
  }

  dibujar();
  if (encuadre) {
    // Encuadre fijo en el territorio continental: getBounds() incluiría el sector antártico.
    map.fitBounds(encuadre);
    map.setMinZoom(map.getZoom() - 1);
    map.setMaxBounds(encuadre.pad(0.6));
  } else {
    map.fitBounds(capa.getBounds(), { padding: [4, 4] });
  }

  return {
    map,
    setServicio(s) {
      servicio = s;
      dibujar();
    },
    // Resalta un departamento (sin mover el mapa); null quita la marca.
    marcar(codigo) {
      if (contorno) contorno.remove();
      contorno = null;
      const l = codigo && capaDe(codigo);
      if (!l) return;
      contorno = L.geoJSON(l.feature, {
        pane: 'seleccion',
        interactive: false,
        style: { fill: false, color: '#e00000', weight: 3, opacity: 1 },
      }).addTo(map);
    },
    enfocar(codigo) {
      this.marcar(codigo);
      const l = capaDe(codigo);
      if (l) map.fitBounds(l.getBounds(), { maxZoom: 9, padding: [30, 30] });
    },
    // Los polígonos sin provincia (islas del Atlántico Sur, Antártida) quedan afuera del encuadre.
    enfocarProvincia(nombre) {
      if (!nombre) {
        map.fitBounds(encuadre || capa.getBounds());
        return;
      }
      const b = L.latLngBounds([]);
      capa.eachLayer((l) => {
        if (l.feature.properties.provincia === nombre) b.extend(l.getBounds());
      });
      if (b.isValid()) map.fitBounds(b, { padding: [20, 20] });
    },
  };
}

// Departamentos del AMBA: CABA (comunas, provincia 02) y los 24 partidos del Gran Buenos Aires.
const PARTIDOS_GBA = new Set([
  '06028', '06035', '06091', '06260', '06270', '06274', '06371', '06408', '06410', '06412', '06427', '06434',
  '06490', '06515', '06539', '06560', '06568', '06658', '06749', '06756', '06760', '06805', '06840', '06861',
]);
export const esAMBA = (f) => f.properties.codigo.startsWith('02') || PARTIDOS_GBA.has(f.properties.codigo);
export const ENCUADRE_PAIS = [[-55.3, -74], [-21.6, -53]];
