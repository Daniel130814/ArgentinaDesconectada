// Portada: una moneda con dos caras (los dos extremos de internet). Los valores salen de los datos procesados.
import { nombreProvincia } from './map.js';

const CARAS = {
  a: { fondo: '#23272E', alto: '#3C434D', bajo: '#14171B', texto: '#F5F5F0' },
  b: { fondo: '#F7D046', alto: '#FFE488', bajo: '#C9A226', texto: '#0B0D10' },
};
const ESTRIAS = 120;
const sinMovimiento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const deCadaCien = (pct) => `${Math.round(pct)} de cada 100`;
const rotulo = (p) => `${p.territorio}, ${nombreProvincia(p.provincia)}`;
const enLugar = (p) => (nombreProvincia(p.provincia) === 'CABA' ? `la ${p.territorio} de CABA` : rotulo(p));

// Disco de 280 con canto estriado (trazos radiales finos) y relieve de dos tonos: un aro claro y su sombra.
function cara(clase, c, cifra, lugar) {
  const estrias = Array.from({ length: ESTRIAS }, (_, i) => {
    const a = (i / ESTRIAS) * 2 * Math.PI, x = Math.cos(a), y = Math.sin(a);
    return `M${(140 + 130 * x).toFixed(2)} ${(140 + 130 * y).toFixed(2)}L${(140 + 139 * x).toFixed(2)} ${(140 + 139 * y).toFixed(2)}`;
  }).join('');
  const coma = lugar.indexOf(', ');
  const lineas = lugar.length > 20 && coma > 0 ? [lugar.slice(0, coma + 1), lugar.slice(coma + 2)] : [lugar];
  return `<svg class="cara ${clase}" viewBox="0 0 280 280" aria-hidden="true" focusable="false">
    <circle cx="140" cy="140" r="140" fill="${c.fondo}"/>
    <path d="${estrias}" stroke="${c.bajo}" stroke-width="1.2" fill="none"/>
    <circle cx="140" cy="140" r="127" fill="none" stroke="${c.bajo}" stroke-width="3"/>
    <circle cx="140" cy="140" r="125" fill="none" stroke="${c.alto}" stroke-width="2"/>
    <circle cx="140" cy="140" r="113" fill="none" stroke="${c.bajo}" stroke-width="1"/>
    <g fill="${c.texto}">
      <text class="cifra" x="140" y="124">${cifra}</text>
      <text class="detalle" x="140" y="154">hogares con internet</text>
      <text class="lugar" x="140" y="181">${lineas.map((l, i) => `<tspan x="140" dy="${i ? 17 : 0}">${l}</tspan>`).join('')}</text>
    </g>
  </svg>`;
}

export function initPortada(alto, bajo) {
  const moneda = document.querySelector('#moneda'), giro = document.querySelector('#moneda-giro');
  if (!moneda || !giro) return;
  giro.innerHTML = cara('cara-a', CARAS.a, deCadaCien(alto.pct_internet_vivienda), rotulo(alto))
    + cara('cara-b', CARAS.b, deCadaCien(bajo.pct_internet_vivienda), rotulo(bajo));
  const descripcion = `Cara A: en ${enLugar(alto)}, ${deCadaCien(alto.pct_internet_vivienda)} hogares tienen internet en la vivienda. `
    + `Cara B: en ${enLugar(bajo)}, ${deCadaCien(bajo.pct_internet_vivienda)}.`;
  if (sinMovimiento()) {
    // Sin movimiento: las dos caras una al lado de la otra, sin giro ni botón.
    moneda.classList.add('lado-a-lado');
    for (const a of ['tabindex', 'aria-pressed']) moneda.removeAttribute(a);
    moneda.setAttribute('role', 'group');
    moneda.setAttribute('aria-label', `Moneda de dos caras. ${descripcion}`);
    return;
  }
  moneda.setAttribute('aria-label', `Moneda de dos caras. ${descripcion} Activala para darla vuelta.`);
  let girada = false, tocada = false;
  const girar = () => {
    girada = !girada;
    moneda.classList.toggle('girada', girada);
    moneda.setAttribute('aria-pressed', String(girada)); // true = se ve la cara B
  };
  moneda.addEventListener('click', () => { tocada = true; girar(); });
  moneda.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault(); tocada = true; girar();
  });
  // Un único giro al cargar (~800 ms): queda mostrando la cara B.
  setTimeout(() => { if (!tocada) girar(); }, 800);
}
