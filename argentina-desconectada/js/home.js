// Home de presentación: cinco pantallas antes del mapa. Todas las cifras salen de los datos procesados.
import { nombreProvincia } from './map.js';

const MIN_HOGARES = 1000; // los extremos se buscan entre departamentos con al menos 1.000 hogares
const fmt = (n, d = 1) => n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
const lugar = (p) => (nombreProvincia(p.provincia) === 'CABA' ? `la ${p.territorio} de CABA` : `${p.territorio}, ${p.provincia}`);
const etiqueta = (p) => `${p.territorio} (${nombreProvincia(p.provincia)})`;
const sinMovimiento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Cada fila con `corte` abre un grupo nuevo (separado por un eje amarillo).
function barras(contenedor, filas) {
  const fila = (f) => `<div class="hb-fila${f.bajo ? ' bajo' : ''}">
    <div class="hb-etiqueta"><span>${f.etiqueta}</span><strong>${fmt(f.valor)}%</strong></div>
    <div class="hb-pista" role="img" aria-label="${f.etiqueta}: ${fmt(f.valor)}%"><span class="hb-relleno" style="--pct:${f.valor}%"></span></div>
  </div>`;
  const grupos = [];
  for (const f of filas) { if (f.corte || !grupos.length) grupos.push([]); grupos.at(-1).push(f); }
  contenedor.innerHTML = grupos.map((g) => `<div class="hb-grupo">${g.map(fila).join('')}</div>`).join('');
}

function contar(el, final, decimales) {
  if (sinMovimiento()) { el.textContent = fmt(final, decimales); return; }
  const inicio = performance.now(), duracion = 1300;
  (function paso(ahora) {
    const t = Math.min(1, (ahora - inicio) / duracion);
    el.textContent = fmt(final * (1 - (1 - t) ** 3), decimales);
    if (t < 1) requestAnimationFrame(paso);
  })(inicio);
}

export function initHome(geojson, resumen) {
  const todos = geojson.features.map((f) => f.properties).filter((p) => !p.sin_datos);
  const comparables = todos.filter((p) => p.hogares_total >= MIN_HOGARES);
  const extremo = (campo, mayor) => comparables.reduce((a, b) => ((mayor ? b[campo] > a[campo] : b[campo] < a[campo]) ? b : a));
  const texto = (id, s) => { document.querySelector(id).textContent = s; };

  // 2. Internet: los dos extremos entre departamentos
  const netAlto = extremo('pct_internet_vivienda', true), netBajo = extremo('pct_internet_vivienda', false);
  texto('#home-internet', `En ${lugar(netAlto)}, ${Math.round(netAlto.pct_internet_vivienda)} de cada 100 hogares tienen internet en la vivienda. En ${lugar(netBajo)}, ${Math.round(netBajo.pct_internet_vivienda)} de cada 100.`);
  barras(document.querySelector('#home-internet-barras'), [
    { etiqueta: etiqueta(netAlto), valor: netAlto.pct_internet_vivienda },
    { etiqueta: etiqueta(netBajo), valor: netBajo.pct_internet_vivienda, bajo: true },
  ]);

  // 3. Cloacas: hogares sin red y el departamento con menor cobertura
  const sinCloacas = todos.reduce((s, p) => s + (p.hogares_total - p.hogares_cloacas_red), 0);
  const cloacaBajo = extremo('pct_cloacas_red', false);
  texto('#home-cloacas-total', `${fmt(sinCloacas / 1e6)} millones de hogares no están conectados a la red cloacal.`);
  texto('#home-cloacas-extremo', `En ${lugar(cloacaBajo)}, la cobertura es de ${fmt(cloacaBajo.pct_cloacas_red)}%.`);

  // 4. Gas de red: provincias del NEA frente a la Patagonia (porcentaje provincial = hogares con gas / hogares)
  const prov = Object.values(resumen.provincias);
  const gas = (nombre) => { const d = prov.find((x) => x.nombre === nombre); return 100 * d.hogares_gas_red / d.hogares_total; };
  barras(document.querySelector('#home-gas-barras'), [
    ...['Formosa', 'Corrientes', 'Chaco', 'Misiones'].map((n) => ({ etiqueta: n, valor: gas(n), bajo: true })),
    ...['Santa Cruz', 'La Pampa', 'Chubut'].map((n, i) => ({ etiqueta: n, valor: gas(n), corte: i === 0 })),
  ]);

  // 5. Departamentos bajo la media nacional en los cuatro servicios
  const cuatro = todos.filter((p) => p.servicios_bajo_media === 4);
  const hogaresCuatro = cuatro.reduce((s, p) => s + p.hogares_total, 0);
  texto('#home-cuatro', `${cuatro.length} departamentos están por debajo de la media nacional en los cuatro servicios. Ahí viven ${fmt(hogaresCuatro / 1e6)} millones de hogares.`);

  // Contadores de la primera pantalla
  const finales = { hogares: [todos.reduce((s, p) => s + p.hogares_total, 0) / 1e6, 1], departamentos: [todos.length, 0], servicios: [4, 0] };
  const contadores = [...document.querySelectorAll('[data-contador]')];
  contadores.forEach((el) => { el.textContent = fmt(...finales[el.dataset.contador]); });

  // Animaciones al entrar cada pantalla (una sola vez)
  const pantallas = [...document.querySelectorAll('.pantalla')];
  if (!('IntersectionObserver' in window) || sinMovimiento()) {
    pantallas.forEach((p) => p.classList.add('visible'));
  } else {
    contadores.forEach((el) => { el.textContent = fmt(0, finales[el.dataset.contador][1]); });
    const io = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('visible'); io.unobserve(e.target);
        e.target.querySelectorAll('[data-contador]').forEach((el) => contar(el, ...finales[el.dataset.contador]));
      }
    }, { threshold: 0.45 });
    pantallas.forEach((p) => io.observe(p));
  }

  // Botones de salto: llevan al mapa; "Saltar al mapa" solo se ve mientras se recorre la presentación
  const irAlMapa = () => document.querySelector('#mapa').scrollIntoView({ behavior: sinMovimiento() ? 'instant' : 'smooth', block: 'start' });
  document.querySelectorAll('[data-ir-mapa]').forEach((b) => b.addEventListener('click', irAlMapa));
  document.querySelector('#vista-inicio')?.addEventListener('click', () => document.querySelector('#home').scrollIntoView({ behavior: sinMovimiento() ? 'instant' : 'smooth', block: 'start' }));
  const saltar = document.querySelector('#saltar-mapa');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { saltar.hidden = e.isIntersecting; }, { threshold: 0.3 }).observe(document.querySelector('#mapa'));
  }
}
