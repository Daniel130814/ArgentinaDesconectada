// Comparación de acceso a servicios, ventanas y enlaces compartibles.
import { SERVICIOS, nombreProvincia } from './map.js';

const miles = new Intl.NumberFormat('es-AR');
const decimal = (n) => n.toFixed(1).replace('.', ',');
const pct = (n) => `${decimal(n)}%`;
const escapar = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const etiqueta = (p) => `${p.territorio} (${nombreProvincia(p.provincia)})`;
const codigoValido = (p) => /^\d{5}$/.test(p.codigo) && !p.sin_datos && !['94021', '94028'].includes(p.codigo);

export function sugerenciasComparacion(departamentos) {
  const elegibles = departamentos.filter((p) => codigoValido(p) && p.hogares_total >= 1000);
  const desempatar = (a, b) => b.hogares_total - a.hogares_total || a.codigo.localeCompare(b.codigo);
  return [
    { titulo: 'Internet: mayor y menor acceso', campo: 'pct_internet_vivienda' },
    { titulo: 'Cloacas: mayor y menor acceso', campo: 'pct_cloacas_red' },
    { titulo: 'Servicios bajo la media: mayor y menor índice', campo: 'servicios_bajo_media' },
  ].map((s) => {
    const validos = elegibles.filter((p) => Number.isFinite(p[s.campo]));
    return { ...s, a: [...validos].sort((a, b) => b[s.campo] - a[s.campo] || desempatar(a, b))[0],
      b: [...validos].sort((a, b) => a[s.campo] - b[s.campo] || desempatar(a, b))[0] };
  }).filter((s) => s.a && s.b);
}

export function fraseComparacion(a, b) {
  const mayor = Object.values(SERVICIOS).reduce((mejor, s) => Math.abs(a[s.campo] - b[s.campo]) > Math.abs(a[mejor.campo] - b[mejor.campo]) ? s : mejor);
  return `En ${mayor.nombre.toLowerCase()}, la diferencia es de ${decimal(Math.abs(a[mayor.campo] - b[mayor.campo]))} p.p.: ${decimal(a[mayor.campo])} de cada 100 hogares frente a ${decimal(b[mayor.campo])} de cada 100.`;
}

function ventanaModal(dialog, alCerrar = () => {}) {
  let focoAnterior = null;
  const cerrar = () => { if (dialog.open) dialog.close(); };
  dialog.querySelector('[data-cerrar-modal]').addEventListener('click', cerrar);
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); cerrar(); });
  dialog.addEventListener('click', (e) => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) cerrar();
  });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar(); return; }
    if (e.key !== 'Tab') return;
    const elementos = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select, a[href], [tabindex="0"]')].filter((el) => el.getClientRects().length);
    const primero = elementos[0], ultimo = elementos.at(-1);
    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  });
  dialog.addEventListener('close', () => {
    alCerrar();
    if (!document.querySelector('dialog[open]')) document.body.classList.remove('ventana-abierta');
    const destino = focoAnterior?.isConnected ? focoAnterior : document.querySelector(`[aria-controls="${dialog.id}"]`);
    destino?.focus({ preventScroll: true });
  });
  return {
    abrir(foco) {
      if (!dialog.open) { focoAnterior = document.activeElement; dialog.showModal(); }
      document.body.classList.add('ventana-abierta');
      (foco || dialog.querySelector('button')).focus({ preventScroll: true });
    }, cerrar,
  };
}

export function initComparador(geojson, resumen, antesDeAbrir = () => {}) {
  const dialog = document.querySelector('#modal-comparar');
  const departamentos = geojson.features.map((f) => f.properties).filter(codigoValido);
  const porCodigo = new Map(departamentos.map((p) => [p.codigo, p]));
  const porEtiqueta = new Map(departamentos.map((p) => [etiqueta(p), p]));
  const inputs = [document.querySelector('#comparar-a'), document.querySelector('#comparar-b')];
  const detalles = [document.querySelector('#detalle-comparar-a'), document.querySelector('#detalle-comparar-b')];
  const errores = [document.querySelector('#error-comparar-a'), document.querySelector('#error-comparar-b')];
  const resultado = document.querySelector('#resultado-comparar'), vacio = document.querySelector('#comparar-vacio');
  const copiar = document.querySelector('#copiar-comparacion'), estado = document.querySelector('#estado-enlace');
  const lista = document.querySelector('#lista-comparar');
  for (const nombre of [...porEtiqueta.keys()].sort((a, b) => a.localeCompare(b, 'es'))) {
    const option = document.createElement('option'); option.value = nombre; lista.append(option);
  }
  let seleccion = [null, null], frame = 0, posiciones = null;
  const movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function escribirHash() {
    const url = new URL(window.location.href);
    if (seleccion.every(Boolean)) url.hash = `comparar=${seleccion[0].codigo},${seleccion[1].codigo}`;
    else if (url.hash.startsWith('#comparar=')) url.hash = '';
    window.history.replaceState(null, '', url);
  }
  const modal = ventanaModal(dialog, () => {
    cancelAnimationFrame(frame);
    if (window.location.hash.startsWith('#comparar=')) {
      const url = new URL(window.location.href); url.hash = ''; window.history.replaceState(null, '', url);
    }
  });
  const graph = document.querySelector('#grafico-dumbbell');
  graph.innerHTML = `<svg class="dumbbell" viewBox="0 0 620 280" role="img" aria-labelledby="titulo-dumbbell descripcion-dumbbell"><title id="titulo-dumbbell">Acceso a cuatro servicios: departamentos A y B</title><desc id="descripcion-dumbbell"></desc>
    ${[0, 20, 40, 60, 80, 100].map((n) => `<line class="guia-dumbbell" x1="${130 + n * 4.6}" x2="${130 + n * 4.6}" y1="20" y2="248"/><text class="eje-dumbbell" x="${130 + n * 4.6}" y="274" text-anchor="middle">${n}%</text>`).join('')}
    ${Object.entries(SERVICIOS).map(([k, s], i) => `<g data-servicio="${k}"><text class="nombre-dumbbell" x="0" y="${47 + i * 60}">${s.nombre}</text><line class="media-dumbbell" x1="${130 + resumen.media_nacional[k] * 4.6}" x2="${130 + resumen.media_nacional[k] * 4.6}" y1="${25 + i * 60}" y2="${57 + i * 60}"/><line class="union-dumbbell" y1="${41 + i * 60}" y2="${41 + i * 60}"/><circle class="circulo-a" cy="${41 + i * 60}" r="7"/><g class="rombo-b"><rect x="-4.5" y="-4.5" width="9" height="9"/></g></g>`).join('')}</svg>`;
  const nodos = [...graph.querySelectorAll('[data-servicio]')];
  function animar(a, b) {
    cancelAnimationFrame(frame);
    const valores = Object.values(SERVICIOS).map((s) => [130 + a[s.campo] * 4.6, 130 + b[s.campo] * 4.6]);
    const inicio = posiciones || Object.keys(SERVICIOS).map((k) => [130 + resumen.media_nacional[k] * 4.6, 130 + resumen.media_nacional[k] * 4.6]);
    const start = performance.now();
    function tick(now) {
      const t = movimientoReducido ? 1 : Math.min(1, (now - start) / 500), e = t * t * (3 - 2 * t);
      posiciones = valores.map((v, i) => v.map((x, j) => inicio[i][j] + (x - inicio[i][j]) * e));
      nodos.forEach((n, i) => {
        const [xA, xB] = posiciones[i]; n.querySelector('.circulo-a').setAttribute('cx', xA);
        n.querySelector('.rombo-b').setAttribute('transform', `translate(${xB},${41 + i * 60}) rotate(45)`);
        n.querySelector('.union-dumbbell').setAttribute('x1', xA); n.querySelector('.union-dumbbell').setAttribute('x2', xB);
      });
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    if (movimientoReducido) tick(start); else frame = requestAnimationFrame(tick);
  }
  function render() {
    seleccion.forEach((p, i) => {
      detalles[i].innerHTML = p ? `<h3>${escapar(p.territorio)}</h3><p>${escapar(nombreProvincia(p.provincia))}</p><p><strong>${miles.format(p.hogares_total)}</strong> hogares · <strong>${p.servicios_bajo_media} de 4</strong> servicios bajo la media nacional</p>` : '<p>Elegí un departamento.</p>';
    });
    document.querySelector('#aviso-pocos-hogares').hidden = !seleccion.some((p) => p && p.hogares_total < 1000);
    const completa = seleccion.every(Boolean); resultado.hidden = !completa; vacio.hidden = completa; copiar.disabled = !completa;
    estado.textContent = ''; document.querySelector('#enlace-comparacion').hidden = true;
    if (!completa) { cancelAnimationFrame(frame); return; }
    const [a, b] = seleccion;
    document.querySelector('#cifras-comparar').innerHTML = Object.entries(SERVICIOS).map(([k, s]) => {
      const dif = a[s.campo] - b[s.campo];
      return `<section class="cifra-servicio"><h4>${s.nombre}</h4><div><span class="cifra-a">A <strong>${pct(a[s.campo])}</strong></span><small>${miles.format(a[s.hogares])} hogares</small></div><div><span class="cifra-b">B <strong>${pct(b[s.campo])}</strong></span><small>${miles.format(b[s.hogares])} hogares</small></div><strong class="diferencia-pp">${dif > 0 ? '+' : ''}${decimal(dif)} p.p.</strong></section>`;
    }).join('');
    document.querySelector('#frase-comparar').textContent = fraseComparacion(a, b);
    document.querySelector('#descripcion-dumbbell').textContent = `A: ${etiqueta(a)}. B: ${etiqueta(b)}. ` + Object.entries(SERVICIOS).map(([k, s]) => `${s.nombre}: A ${pct(a[s.campo])}, ${miles.format(a[s.hogares])} hogares; B ${pct(b[s.campo])}, ${miles.format(b[s.hogares])} hogares; media nacional ${pct(resumen.media_nacional[k])}.`).join(' ');
    animar(a, b);
  }
  function elegir(i, p) { seleccion[i] = p; if (p) inputs[i].value = etiqueta(p); render(); escribirHash(); }
  inputs.forEach((input, i) => {
    input.addEventListener('input', () => {
      const p = porEtiqueta.get(input.value.trim()); errores[i].textContent = ''; input.removeAttribute('aria-invalid'); elegir(i, p || null);
    });
    input.addEventListener('change', () => {
      const invalido = input.value.trim() && !porEtiqueta.has(input.value.trim());
      errores[i].textContent = invalido ? 'Elegí un departamento de la lista, con la provincia entre paréntesis.' : '';
      input.setAttribute('aria-invalid', String(!!invalido));
    });
  });
  for (const s of sugerenciasComparacion(departamentos)) {
    const boton = document.createElement('button'); boton.type = 'button'; boton.className = 'sugerencia-comparar';
    boton.innerHTML = `<strong>${s.titulo}</strong><span>${escapar(etiqueta(s.a))} <span aria-hidden="true">↔</span> ${escapar(etiqueta(s.b))}</span>`;
    boton.dataset.codigos = `${s.a.codigo},${s.b.codigo}`;
    boton.addEventListener('click', () => { seleccion = [s.a, s.b]; inputs.forEach((input, i) => { input.value = etiqueta(seleccion[i]); errores[i].textContent = ''; input.removeAttribute('aria-invalid'); }); render(); escribirHash(); });
    document.querySelector('#sugerencias-comparar').append(boton);
  }
  copiar.addEventListener('click', async () => {
    if (!seleccion.every(Boolean)) return;
    const url = new URL(window.location.href); url.hash = `comparar=${seleccion[0].codigo},${seleccion[1].codigo}`;
    try { await navigator.clipboard.writeText(url.href); estado.textContent = 'Enlace copiado.'; }
    catch {
      const campo = document.querySelector('#enlace-comparacion'); campo.value = url.href; campo.hidden = false; campo.focus(); campo.select();
      estado.textContent = 'Copiá el enlace seleccionado con Ctrl+C o desde el menú del dispositivo.';
    }
  });
  function abrir(codigoA = null) {
    antesDeAbrir();
    if (codigoA && porCodigo.has(codigoA)) { seleccion = [porCodigo.get(codigoA), null]; inputs[0].value = etiqueta(seleccion[0]); inputs[1].value = ''; }
    errores.forEach((el) => { el.textContent = ''; }); inputs.forEach((input) => input.removeAttribute('aria-invalid'));
    render(); modal.abrir(codigoA ? inputs[1] : inputs[0]); escribirHash();
  }
  function leerHash() {
    const hash = window.location.hash;
    if (!hash.startsWith('#comparar=')) { if (dialog.open) modal.cerrar(); return; }
    const codigos = /^#comparar=(\d{5}),(\d{5})$/.exec(hash);
    if (!codigos || !porCodigo.has(codigos[1]) || !porCodigo.has(codigos[2])) {
      seleccion = [null, null]; inputs.forEach((input) => { input.value = ''; });
      abrir(); estado.textContent = 'El enlace no contiene dos departamentos con datos censales válidos.'; return;
    }
    seleccion = [porCodigo.get(codigos[1]), porCodigo.get(codigos[2])];
    inputs.forEach((input, i) => { input.value = etiqueta(seleccion[i]); }); abrir();
  }
  window.addEventListener('hashchange', leerHash); render(); leerHash();
  return { abrir, cerrar: modal.cerrar };
}

export function initMetodologia(antesDeAbrir = () => {}) {
  const dialog = document.querySelector('#modal-metodologia'), modal = ventanaModal(dialog);
  let cargada = false;
  return { cerrar: modal.cerrar, async abrir() {
    antesDeAbrir(); modal.abrir();
    if (cargada) return;
    const contenido = document.querySelector('#contenido-metodologia'); contenido.textContent = 'Cargando metodología…';
    try {
      const r = await fetch('METODOLOGIA.md'); if (!r.ok) throw new Error('No se pudo cargar la metodología.');
      const texto = await r.text(); contenido.replaceChildren();
      for (const bloque of texto.split(/\r?\n\s*\r?\n/)) {
        if (bloque.startsWith('# ')) continue;
        if (bloque.startsWith('## ')) { const h = document.createElement('h3'); h.textContent = bloque.slice(3); contenido.append(h); }
        else if (bloque.startsWith('- ')) {
          const ul = document.createElement('ul'); for (const linea of bloque.split(/\r?\n/)) { const li = document.createElement('li'); li.textContent = linea.replace(/^- /, '').replace(/\*\*|`/g, ''); ul.append(li); } contenido.append(ul);
        } else { const p = document.createElement('p'); p.textContent = bloque.replace(/\r?\n/g, ' ').replace(/\*\*|`/g, ''); contenido.append(p); }
      }
      cargada = true;
    } catch(e) { contenido.textContent = `${e.message} Volvé a abrir esta ventana para reintentar.`; }
  } };
}
