// Ayuda de lectura: un aviso chico la primera vez que el usuario llega al mapa. No oscurece ni bloquea nada.
const CLAVE = 'ayudaMapaVista';
const DURACION = 12000; // ms hasta que se cierra solo
const TEXTO = 'La altura y el brillo muestran el porcentaje de hogares sin el servicio: cuanto más alto y claro, más desconectado. '
  + 'Elegí un servicio arriba y tocá una provincia para entrar.';

// Si localStorage no está disponible (modo privado, bloqueado), el aviso se muestra igual y simplemente no se recuerda.
const yaVista = () => { try { return localStorage.getItem(CLAVE) === '1'; } catch { return false; } };
const recordar = () => { try { localStorage.setItem(CLAVE, '1'); } catch { /* sin almacenamiento: no se recuerda */ } };

export function initAyudaMapa(contenedor) {
  // Con un enlace de comparación (#comparar=...) no se muestra.
  if (!contenedor || location.hash.startsWith('#comparar=') || yaVista()) return;
  let aviso = null, temporizador = 0;

  function cerrar() {
    clearTimeout(temporizador);
    document.removeEventListener('keydown', alEscape, true);
    aviso?.remove(); aviso = null;
  }
  // En captura, antes que el Esc de la navegación del mapa (que respeta defaultPrevented).
  function alEscape(e) {
    if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
    e.preventDefault(); cerrar();
  }
  function mostrar() {
    if (aviso) return;
    recordar();
    aviso = document.createElement('div');
    aviso.className = 'ayuda-mapa'; aviso.setAttribute('role', 'status');
    const texto = document.createElement('p');
    const boton = document.createElement('button'); boton.type = 'button'; boton.textContent = 'Entendido';
    boton.addEventListener('click', cerrar);
    aviso.append(texto, boton); contenedor.append(aviso);
    // El texto se agrega después de insertar la región, para que los lectores de pantalla lo anuncien.
    requestAnimationFrame(() => { if (!aviso) return; texto.textContent = TEXTO; aviso.classList.add('visible'); });
    document.addEventListener('keydown', alEscape, true);
    temporizador = setTimeout(cerrar, DURACION);
  }

  if (!('IntersectionObserver' in window)) { mostrar(); return; }
  // Se espera a que el propio mapa se vea (al menos el 60%): la sección entera es muy alta en celular y el aviso queda al pie del mapa.
  const io = new IntersectionObserver(([e]) => { if (e.intersectionRatio >= 0.6) { io.disconnect(); mostrar(); } }, { threshold: [0.6] });
  io.observe(contenedor);
}
