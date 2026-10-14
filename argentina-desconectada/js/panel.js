// Panel fijo: datos del departamento bajo el cursor y comparación de dos departamentos lado a lado.
import { SERVICIOS } from './map.js';

const miles = new Intl.NumberFormat('es-AR');
const coma = (n, d = 1) => n.toFixed(d).replace('.', ',');
const pct = (v) => `${coma(v)}%`;
const pp = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${coma(Math.abs(v))} pp`;

// Media provincial = suma de hogares con el servicio / suma de hogares, nunca promedio de porcentajes.
function mediasProvinciales(geojson) {
  const acum = {};
  for (const { properties: p } of geojson.features) {
    if (p.sin_datos) continue;
    const a = (acum[p.provincia] ??= { total: 0 });
    a.total += p.hogares_total;
    for (const [k, s] of Object.entries(SERVICIOS)) a[k] = (a[k] ?? 0) + p[s.hogares];
  }
  const medias = {};
  for (const [prov, a] of Object.entries(acum)) {
    medias[prov] = Object.fromEntries(Object.keys(SERVICIOS).map((k) => [k, (100 * a[k]) / a.total]));
  }
  return medias;
}

// Una fila por servicio con el porcentaje y la cantidad de hogares de una provincia.
function filasProvincia(d, mediaNacional, activa = null) {
  return Object.entries(SERVICIOS)
    .map(([k, s]) => `<div class="fila${k === activa ? ' activa' : ''}">
      <dt>${s.nombre}</dt>
      <dd><strong>${pct(d[k])}</strong> <span class="hogares">${miles.format(d[s.hogares])} de ${miles.format(d.hogares_total)} hogares</span>
      ${mediaNacional ? `<span class="medias">Nación ${pct(mediaNacional[k])}</span>` : ''}</dd>
    </div>`)
    .join('');
}

// Tooltip con el resumen provincial al pasar el mouse por una provincia (vista nacional).
export function initTooltip(contenedor, provincias, mediaNacional) {
  const el = document.createElement('div');
  el.className = 'tooltip-prov';
  el.hidden = true;
  contenedor.append(el);
  let codigo = null;
  return {
    mostrar(cpr, evento) {
      const d = cpr && provincias[cpr];
      if (!d) {
        el.hidden = true;
        codigo = null;
        return;
      }
      if (codigo !== cpr) {
        el.innerHTML = `<strong>${d.nombre}</strong><dl>${filasProvincia(d, mediaNacional)}</dl><p>Clic para ver sus departamentos</p>`;
        codigo = cpr;
      }
      el.hidden = false;
      const r = contenedor.getBoundingClientRect();
      let x = evento.clientX - r.left + 16;
      let y = evento.clientY - r.top + 16;
      if (x + el.offsetWidth > r.width - 8) x = evento.clientX - r.left - el.offsetWidth - 16;
      if (y + el.offsetHeight > r.height - 8) y = r.height - el.offsetHeight - 8;
      el.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
    },
    ocultar() {
      el.hidden = true;
      codigo = null;
    },
  };
}

export function initPanel(container, geojson, mediaNacional, onSoltar = () => {}, onVolver = () => {}, resumenProvincias = {}) {
  if (!container) throw new Error('No se encontró el contenedor del panel.');
  const provinciales = mediasProvinciales(geojson);
  let servicio = 'agua_red';
  let actual = null;
  let provincia = null; // código de la provincia abierta en el mapa (null = vista nacional)
  let fijo = false; // el departamento mostrado está seleccionado y no cambia al mover el mouse
  let fijados = []; // hasta dos departamentos, el más antiguo primero

  container.innerHTML = '<div class="vivo"></div><div class="comparacion"></div>';
  const vivo = container.querySelector('.vivo');
  const comparacion = container.querySelector('.comparacion');

  const estaFijado = (p) => fijados.some((f) => f.codigo === p.codigo);

  function fila(clave, p) {
    const s = SERVICIOS[clave];
    const nacional = mediaNacional ? `Nación ${pct(mediaNacional[clave])}` : '';
    const prov = provinciales[p.provincia] ? `, provincia ${pct(provinciales[p.provincia][clave])}` : '';
    return `<div class="fila${clave === servicio ? ' activa' : ''}">
      <dt>${s.nombre}</dt>
      <dd><strong>${pct(p[s.campo])}</strong> <span class="hogares">${miles.format(p[s.hogares])} de ${miles.format(p.hogares_total)} hogares</span>
      <span class="medias">${nacional}${prov}</span></dd>
    </div>`;
  }

  function renderVivo() {
    if (!actual && provincia && resumenProvincias[provincia]) {
      const d = resumenProvincias[provincia];
      vivo.innerHTML = `<div class="encabezado"><div><h2>${d.nombre}</h2><p class="prov">Provincia, ${miles.format(d.hogares_total)} hogares</p></div>
        <div class="acciones"><button type="button" data-accion="volver">← Argentina</button></div></div>
        <dl>${filasProvincia(d, mediaNacional, servicio)}</dl>
        <p class="indice">Pasá el mouse por un departamento para ver sus datos. Hacé clic o tocá para dejarlo fijo.</p>`;
      return;
    }
    if (!actual) {
      vivo.innerHTML = '<p class="vacio">Pasá el mouse por una provincia para ver su resumen. Hacé clic o tocá para acercarte y ver sus departamentos.</p>';
      return;
    }
    if (actual.sin_datos) {
      vivo.innerHTML = '<p class="vacio"><strong>Sin datos.</strong> Este territorio no tiene información en el Censo 2022.</p>';
      return;
    }
    const p = actual;
    const fijado = estaFijado(p);
    vivo.innerHTML = `<div class="encabezado"><div><h2>${p.territorio}</h2><p class="prov">${p.provincia}</p></div>
      <div class="acciones"><button type="button" class="fijar" data-accion="fijar"${fijado ? ' disabled' : ''}>${fijado ? 'En la comparación' : 'Comparar'}</button>
      ${fijo ? '<button type="button" data-accion="soltar">Quitar selección</button>' : ''}</div></div>
      <dl>${Object.keys(SERVICIOS).map((k) => fila(k, p)).join('')}</dl>
      <p class="indice">Está bajo la media nacional en ${p.servicios_bajo_media} de 4 servicios (clasifica departamentos, no hogares).</p>`;
  }

  function renderComparacion() {
    if (!fijados.length) {
      comparacion.innerHTML = '';
      return;
    }
    const [a, b] = fijados;
    const quitar = (i) => `<button type="button" class="quitar" data-accion="quitar" data-i="${i}" aria-label="Quitar ${fijados[i].territorio} de la comparación">Quitar</button>`;
    if (!b) {
      comparacion.innerHTML = `<h3>Comparación</h3>
        <p class="vacio"><strong>${a.territorio}</strong> (${a.provincia}) ${quitar(0)}<br>Elegí otro departamento en el mapa y tocá Comparar.</p>`;
      return;
    }
    const filas = Object.entries(SERVICIOS)
      .map(([k, s]) => {
        const d = a[s.campo] - b[s.campo];
        return `<tr class="${k === servicio ? 'activa' : ''}">
          <th scope="row">${s.nombre}</th>
          <td><strong>${pct(a[s.campo])}</strong><span>${miles.format(a[s.hogares])} de ${miles.format(a.hogares_total)} hogares</span></td>
          <td><strong>${pct(b[s.campo])}</strong><span>${miles.format(b[s.hogares])} de ${miles.format(b.hogares_total)} hogares</span></td>
          <td class="dif">${pp(d)}</td></tr>`;
      })
      .join('');
    comparacion.innerHTML = `<h3>Comparación</h3>
      <table>
        <thead><tr><td></td>
          <th scope="col">${a.territorio}<span>${a.provincia}</span>${quitar(0)}</th>
          <th scope="col">${b.territorio}<span>${b.provincia}</span>${quitar(1)}</th>
          <th scope="col">Diferencia<span>primero menos segundo</span></th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <p class="indice">pp: puntos porcentuales. Cada porcentaje es de los hogares de ese departamento.</p>`;
  }

  function render() {
    renderVivo();
    renderComparacion();
  }

  container.addEventListener('click', (e) => {
    const boton = e.target.closest('button[data-accion]');
    if (!boton) return;
    if (boton.dataset.accion === 'soltar') {
      onSoltar();
      return;
    }
    if (boton.dataset.accion === 'volver') {
      onVolver();
      return;
    }
    if (boton.dataset.accion === 'fijar' && actual && !actual.sin_datos && !estaFijado(actual)) {
      fijados = [...fijados, actual].slice(-2);
    } else if (boton.dataset.accion === 'quitar') {
      fijados.splice(Number(boton.dataset.i), 1);
    }
    render();
  });

  render();
  return {
    mostrar(p, esFijo = false) {
      actual = p;
      fijo = esFijo;
      renderVivo();
    },
    // Provincia abierta en el mapa: con ningún departamento elegido, el panel muestra su resumen.
    mostrarProvincia(cpr) {
      provincia = cpr;
      renderVivo();
    },
    setServicio(s) {
      servicio = s;
      render();
    },
  };
}
