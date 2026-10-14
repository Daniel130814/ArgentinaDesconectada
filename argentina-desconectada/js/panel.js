// Tarjetas de territorio, fuentes y comparación sobre el mapa.
import { SERVICIOS, RAMPAS, rangoColor, nombreProvincia, alturasProvinciales } from './map.js';

const miles = new Intl.NumberFormat('es-AR');
const pct = (v) => `${v.toFixed(1).replace('.', ',')}%`;
const escapar = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const FUENTES = {
  agua_red: ['H14', 'Hogares con agua por red pública.'],
  cloacas_red: ['H18', 'Hogares con desagüe a red pública (cloacas).'],
  gas_red: ['H19', 'Hogares que cocinan principalmente con gas de red. No mide si la red existe en la zona.'],
  internet_vivienda: ['H24A', 'Hogares con conexión a internet en la vivienda (no celular). No mide velocidad ni calidad.'],
};

export function htmlDepartamento(p, servicio, resumen, comparar = null, fuenteAbierta = false) {
  const media = resumen.media_nacional;
  const prov = resumen.provincias[p.codigo.slice(0, 2)];
  const barras = Object.entries(SERVICIOS).map(([k, s]) => {
    const valor = p[s.campo];
    return `<div class="servicio-barra${k === servicio ? ' activa' : ''}">
      <div class="barra-titulo"><strong>${s.nombre}</strong><strong>${pct(valor)} con servicio</strong></div>
      <div class="barra-pista" role="img" aria-label="${s.nombre}: ${pct(valor)} con servicio; media nacional ${pct(media[k])}">
        <span class="barra-valor" style="width:${valor}%;background:${RAMPAS[k][3]}"></span>
        <span class="barra-media" style="left:${media[k]}%" title="Media nacional: ${pct(media[k])}"></span>
      </div>
      <span>${miles.format(p[s.hogares])} de ${miles.format(p.hogares_total)} hogares</span>
      <small>Nación ${pct(media[k])}${prov ? ` · Provincia ${pct(prov[k])}` : ''}</small>
    </div>`;
  }).join('');
  const comparacion = comparar && comparar.codigo !== p.codigo ? `<section class="comparacion"><h3>Comparación con ${escapar(comparar.territorio)}</h3><p>${escapar(nombreProvincia(comparar.provincia))}</p>
    <table><caption>Acceso al servicio; diferencia del departamento elegido respecto del anterior.</caption><thead><tr><th>Servicio</th><th>${escapar(p.territorio)}</th><th>${escapar(comparar.territorio)}</th><th>Dif.</th></tr></thead>
    <tbody>${Object.entries(SERVICIOS).map(([k, s]) => {
      const dif = p[s.campo] - comparar[s.campo];
      return `<tr class="${k === servicio ? 'activa' : ''}"><th>${s.nombre}</th><td>${pct(p[s.campo])}<small>${miles.format(p[s.hogares])} hogares</small></td><td>${pct(comparar[s.campo])}<small>${miles.format(comparar[s.hogares])} hogares</small></td><td>${dif > 0 ? '+' : ''}${dif.toFixed(1).replace('.', ',')} pp</td></tr>`;
    }).join('')}</tbody></table><p>pp: puntos porcentuales. Cada porcentaje corresponde a los hogares de su departamento.</p></section>` : '';
  return `<div class="tarjeta-encabezado"><div><h2>${escapar(p.territorio)}</h2><p>${escapar(nombreProvincia(p.provincia))}</p></div>
    <button type="button" class="tarjeta-cerrar" data-accion="cerrar" aria-label="Cerrar tarjeta">×</button></div>
    <p class="tarjeta-hogares"><strong>${miles.format(p.hogares_total)}</strong> hogares totales</p>
    <div class="barras-servicios">${barras}</div><p class="referencia-media"><i></i> Marca vertical: media nacional</p>
    <p class="indice">Bajo la media nacional en ${p.servicios_bajo_media} de 4 servicios. Clasifica departamentos, no hogares.</p>
    <div class="tarjeta-acciones"><button type="button" data-accion="fuente" aria-expanded="${fuenteAbierta}">Fuente</button><button type="button" data-accion="comparar">Comparar con otro</button></div>
    <div class="tarjeta-fuente"${fuenteAbierta ? '' : ' hidden'}><strong>INDEC · Censo 2022</strong><p>Hogares en viviendas particulares. Porcentaje = hogares con servicio / hogares totales × 100.</p>
      ${Object.entries(SERVICIOS).map(([k, s]) => `<p><b>${s.nombre} · ${FUENTES[k][0]}</b>: ${FUENTES[k][1]}</p>`).join('')}
      <p>Cartografía: INDEC/IGN.</p></div>${comparacion}`;
}

export function htmlProvincia(cpr, servicio, geojson, resumen) {
  const d = resumen.provincias[cpr];
  if (!d) return '';
  const departamentos = geojson.features.filter((f) => !f.properties.sin_datos && !['94021', '94028'].includes(f.properties.codigo) && f.properties.codigo.startsWith(cpr));
  const rangos = [0, 0, 0, 0, 0];
  departamentos.forEach((f) => { const r = rangoColor(f.properties, servicio); if (r != null) rangos[r]++; });
  const valor = servicio === 'resumen'
    ? `<p><strong>${alturasProvinciales(geojson, resumen)[cpr].servicios_bajo_media_ponderado.toFixed(2).replace('.', ',')} de 4</strong> servicios bajo la media nacional.<br>Altura: media ponderada por hogares de los índices departamentales; clasifica territorios.</p>`
    : `<p><strong>${pct(d[servicio])}</strong> con ${SERVICIOS[servicio].nombre.toLowerCase()}<br>${miles.format(d[SERVICIOS[servicio].hogares])} de ${miles.format(d.hogares_total)} hogares</p>`;
  return `<strong class="tooltip-nombre">${escapar(nombreProvincia(d.nombre))}</strong><p>${departamentos.length} departamentos con datos censales</p>${valor}
    <p class="distribucion-titulo">Departamentos por ${servicio === 'resumen' ? 'servicios bajo la media (0–4)' : '% de hogares sin servicio'}</p>
    <div class="distribucion">${rangos.map((n, i) => `<div><i style="background:${RAMPAS[servicio][i]}"></i><span>${servicio === 'resumen' ? i : `${i * 20}–${(i + 1) * 20}%`}</span><strong>${n}</strong></div>`).join('')}</div>
    <p class="tooltip-entrar">TOCÁ PARA ENTRAR</p>`;
}

export function initTooltip(contenedor, geojson, resumen) {
  const el = document.createElement('div'); el.className = 'tooltip-prov'; el.hidden = true;
  contenedor.append(el);
  let codigo = null, servicio = 'agua_red';
  return {
    mostrar(cpr, evento) {
      if (!cpr || !resumen.provincias[cpr] || !evento || evento.pointerType === 'touch') { el.hidden = true; codigo = null; return; }
      if (codigo !== cpr) { el.innerHTML = htmlProvincia(cpr, servicio, geojson, resumen); codigo = cpr; }
      el.hidden = false;
      const r = contenedor.getBoundingClientRect();
      let x = evento.clientX - r.left + 18, y = evento.clientY - r.top + 18;
      if (x + el.offsetWidth > r.width - 8) x = evento.clientX - r.left - el.offsetWidth - 18;
      if (y + el.offsetHeight > r.height - 8) y = r.height - el.offsetHeight - 8;
      el.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
    },
    ocultar() { el.hidden = true; codigo = null; },
    setServicio(s) { servicio = s; if (codigo) el.innerHTML = htmlProvincia(codigo, servicio, geojson, resumen); },
  };
}

export function initTarjetas(contenedor, resumen, onCerrar) {
  const card = document.createElement('article'); card.className = 'tarjeta-depto'; card.hidden = true;
  card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', 'Datos del departamento'); card.tabIndex = -1;
  const aviso = document.createElement('div'); aviso.className = 'aviso-comparacion'; aviso.hidden = true; aviso.setAttribute('role', 'status');
  contenedor.append(card, aviso);
  const media = window.matchMedia('(max-width: 767px)');
  let actual = null, servicio = 'agua_red', ancla = null, popup = null, comparar = null, esperando = false, fuenteAbierta = false;
  let mapaAncla = null, posicionPopup = null;
  function ajustar() {
    if (!popup || !ancla) return;
    const punto = ancla.map.project(ancla.lngLat);
    const alto = ancla.map.getContainer().clientHeight;
    const disponible = posicionPopup === 'left' || posicionPopup === 'right'
      ? 2 * Math.min(punto.y - 85, alto - punto.y - 35)
      : Math.max(punto.y - 90, alto - punto.y - 45);
    card.style.maxHeight = `${Math.max(120, Math.min(640, disponible - 20))}px`;
    popup.setLngLat(ancla.lngLat);
  }
  function desmontar() {
    if (mapaAncla) { mapaAncla.off('move', ajustar); mapaAncla.off('resize', ajustar); mapaAncla = null; }
    popup?.remove(); popup = null;
  }
  function colocar() {
    if (!actual || !ancla) return;
    desmontar(); card.style.maxHeight = '';
    card.classList.toggle('bottom-sheet', media.matches);
    if (media.matches) contenedor.append(card);
    else {
      const punto = ancla.map.project(ancla.lngLat), ancho = ancla.map.getContainer().clientWidth;
      posicionPopup = ancho - punto.x > 414 ? 'left' : punto.x > 414 ? 'right' : undefined;
      popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, focusAfterOpen: false, maxWidth: '390px', className: 'popup-depto', offset: 14, anchor: posicionPopup })
        .setLngLat(ancla.lngLat).setDOMContent(card).addTo(ancla.map);
      mapaAncla = ancla.map; mapaAncla.on('move', ajustar); mapaAncla.on('resize', ajustar); ajustar();
    }
  }
  function render() { if (actual) { card.innerHTML = htmlDepartamento(actual, servicio, resumen, comparar, fuenteAbierta); ajustar(); } }
  function cerrar(cancelarComparacion = true) {
    actual = null; card.hidden = true; desmontar();
    if (cancelarComparacion) { comparar = null; esperando = false; aviso.hidden = true; }
    onCerrar();
  }
  card.addEventListener('click', (e) => {
    e.stopPropagation();
    const b = e.target.closest('button[data-accion]'); if (!b) return;
    if (b.dataset.accion === 'cerrar') cerrar();
    if (b.dataset.accion === 'fuente') { fuenteAbierta = !fuenteAbierta; render(); }
    if (b.dataset.accion === 'comparar') {
      comparar = actual; esperando = true; fuenteAbierta = false;
      aviso.innerHTML = `<span>Elegí otro departamento para comparar con ${escapar(actual.territorio)}. Podés cambiar de provincia o usar el buscador.</span><button type="button">Cancelar</button>`;
      aviso.hidden = false; cerrar(false);
    }
  });
  aviso.addEventListener('click', (e) => { if (e.target.closest('button')) cerrar(); });
  document.addEventListener('click', (e) => {
    if (!actual || card.contains(e.target) || e.target.closest('.mapa-canvas, .etiqueta-prov, #buscador, #lista-deptos, #selector, .mapa-dimension')) return;
    cerrar();
  });
  media.addEventListener('change', colocar);
  return {
    mostrar(p, ubicacion) {
      if (p.sin_datos || ['94021', '94028'].includes(p.codigo)) return;
      if (!esperando) comparar = null;
      else if (comparar?.codigo === p.codigo) return false;
      esperando = false; aviso.hidden = true; actual = p; ancla = ubicacion; fuenteAbierta = false;
      render(); card.hidden = false; colocar(); card.focus({ preventScroll: true });
    },
    cerrar,
    cerrarPorMapa() { if (actual) cerrar(); },
    cambiarProvincia() { cerrar(!esperando); },
    escape() { if (!actual && !esperando) return false; cerrar(); return true; },
    setServicio(s) { servicio = s; render(); },
  };
}
