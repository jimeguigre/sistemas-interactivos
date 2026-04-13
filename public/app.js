// REFERENCIAS A LA INTERFAZ


// Elemento donde se escriben mensajes generales de estado para el usuario.
const estadoGeneralEl = document.getElementById("estadoGeneral");
// Input donde el usuario introduce el destino al que quiere navegar.
const destinoInputEl = document.getElementById("destinoInput");
// Botón que lanza el cálculo de una nueva ruta.
const botonCrearRutaEl = document.getElementById("botonCrearRuta");
// Botón que activa el modo conducción una vez ya existe una ruta.
const botonEmpezarRutaEl = document.getElementById("botonEmpezarRuta");
// Botón para salir del modo conducción y volver al estado normal.
const botonSalirConduccionEl = document.getElementById("botonSalirConduccion");
// Barra grande con input y botones, visible fuera de conducción.
const barraHerramientasEl = document.getElementById("barraHerramientas");
// Barra reducida visible solo en conducción para dejar más mapa libre.
const barraCompactaEl = document.getElementById("barraCompacta");
// Línea de texto que resume el estado de micrófono, GPS y cámara.
const estadoSensoresEl = document.getElementById("estadoSensores");
// Botón de ayuda.
const botonAyudaEl = document.getElementById("botonAyuda");
// Panel flotante con instrucciones de uso.
const panelAyudaEl = document.getElementById("panelAyuda");
// Botón para cerrar el panel de ayuda.
const cerrarAyudaEl = document.getElementById("cerrarAyuda");
// Botón que abre el panel de privacidad y control.
const botonPrivacidadEl = document.getElementById("botonPrivacidad");
// Panel donde se gestionan permisos y somnolencia.
const panelPrivacidadEl = document.getElementById("panelPrivacidad");
// Botón para cerrar el panel de privacidad.
const cerrarPrivacidadEl = document.getElementById("cerrarPrivacidad");
// Casilla que controla si la app puede usar el micrófono.
const usarMicrofonoEl = document.getElementById("usarMicrofono");
// Casilla que controla si la app puede usar la ubicación.
const usarUbicacionEl = document.getElementById("usarUbicacion");
// Casilla que controla si la app puede usar la cámara.
const usarCamaraEl = document.getElementById("usarCamara");
// Botón que abre la ventana visual del detector.
const verSomnolenciaEl = document.getElementById("verSomnolencia");
// Botón que enciende realmente el detector de somnolencia.
const encenderSomnolenciaEl = document.getElementById("encenderSomnolencia");
// Botón que apaga completamente el detector de somnolencia.
const apagarSomnolenciaEl = document.getElementById("apagarSomnolencia");
// Botón que muestra los avisos creados por este cliente.
const botonMisAvisosEl = document.getElementById("botonMisAvisos");
// Botón que enciende el detector de frenazo.
const encenderFrenazoEl = document.getElementById("encenderFrenazo");
// Botón que apaga el detector de frenazo.
const apagarFrenazoEl = document.getElementById("apagarFrenazo");
// Panel desplegable con la lista de avisos propios.
const panelMisAvisosEl = document.getElementById("panelMisAvisos");
// Modal completo del detector de somnolencia.
const modalSomnolenciaEl = document.getElementById("modalSomnolencia");
// Botón que cierra la ventana del detector.
const cerrarModalSomnolenciaEl = document.getElementById("cerrarModalSomnolencia");
// Botón para poner el detector en pantalla completa.
const pantallaCompletaSomnolenciaEl = document.getElementById("pantallaCompletaSomnolencia");



// CONSTANTES DE CONFIGURACIÓN


// Clave de localStorage donde se guardan permisos y estado del usuario.
const CLAVE_PRIVACIDAD = "avisos_nav_privacidad_v10";
// Distancia máxima para considerar que un aviso pertenece a la ruta actual.
const DISTANCIA_AVISO_RUTA_METROS = 150;
// Distancia del primer anuncio por voz de un aviso.
const DISTANCIA_PRIMER_AVISO_METROS = 150;
// Distancia del segundo anuncio, más urgente, cuando el coche ya está muy cerca.
const DISTANCIA_SEGUNDO_AVISO_METROS = 50;
// Distancia máxima hacia atrás permitida para encontrar un aviso borrable por voz.
const DISTANCIA_MAX_BORRADO_ATRAS_METROS = 500;
// Si el coche se separa más de esto de la ruta, se intenta recalcular.
const UMBRAL_SALIDA_RUTA_METROS = 100;
// Tiempo máximo de espera al pedir una posición GPS.
const GPS_TIMEOUT_MS = 15000;
// Antigüedad máxima permitida para posiciones cacheadas del GPS.
const GPS_MAXIMUM_AGE_MS = 0;
// Zoom usado cuando el mapa sigue automáticamente al vehículo.
const ZOOM_CONDUCCION = 18;
// Tiempo mínimo entre dos anuncios de avisos para no saturar al usuario.
const COOLDOWN_AVISOS_MS = 6000;
// Tiempo mínimo entre dos comandos de voz reconocidos.
const COOLDOWN_COMANDOS_MS = 900;
// Tiempo tras el cual se recupera el texto normal de conducción.
const RETARDO_ESTADO_CONDUCCION_MS = 5000;


// CONEXIÓN EN TIEMPO REAL


// Conexión con el servidor usando Socket.IO para compartir avisos en tiempo real.
const socket = io();
window.socketPrincipal = socket;



// ESTADO DE PRIVACIDAD


const privacidad = {
  // Permite o bloquea reconocimiento de voz.
  microfono: false,

  // Permite o bloquea geolocalización real.
  ubicacion: false,

  // Permite o bloquea el uso de cámara.
  camara: false,

  // Indica si el detector de somnolencia debe estar encendido.
  somnolenciaEncendida: false,

  // Indica si el detector de frenazo debe estar encendido.
  frenazoEncendido: false,

  // Nombre del contacto de emergencia.
  contactoEmergenciaNombre: "",

  // Email del contacto de emergencia.
  contactoEmergenciaEmail: "",

  // Indica si ya se pidió la configuración inicial alguna vez.
  inicializado: false
};



// VARIABLES GLOBALES DE APP


// ID único del cliente actual en Socket.IO.
let idCliente = null;
// Instancia principal del mapa Leaflet.
let mapa;
// Control de rutas de Leaflet Routing Machine.
let controlRuta = null;
// Lista de puntos {lat,lng} que forman la ruta actual.
let coordenadasRuta = [];
// Última posición GPS conocida del usuario.
let posicionActual = null;
// Texto del destino actual, útil para UI y para recordar la navegación activa.
let textoDestinoActual = "";
// Coordenadas geográficas reales del destino actual.
let latLngDestinoActual = null;
// Marcador visual del usuario en el mapa.
let marcadorUsuario = null;
// Línea de la parte pendiente de la ruta.
let lineaRutaPendiente = null;
// Línea de la parte ya recorrida.
let lineaRutaRecorrida = null;
// Bandera para evitar varios recálculos de ruta simultáneos.
let recalculandoRuta = false;
// Indica si la app está en modo conducción.
let enConduccion = false;
// Si es true, el mapa se centra automáticamente en el vehículo.
let seguirVehiculo = false;
// Índice máximo de la ruta que se considera ya recorrido.
let indiceMaxRecorrido = 0;
// Lista completa de avisos que conoce el cliente.
let avisos = [];
// Lista reducida de avisos que están cerca de la ruta actual.
let avisosEnRuta = [];
// Marca temporal del último anuncio de aviso por voz.
let ultimoMomentoAviso = 0;
// Objeto del reconocimiento de voz del navegador.
let reconocimiento = null;
// Bandera que indica si el reconocimiento está escuchando ahora mismo.
let reconocimientoActivo = false;
// Evita guardar como "apagado" un fallo puntual del navegador al iniciar la voz.
let microfonoPausadoPorError = false;
// Bandera que indica si la app está hablando y, por tanto, no debe escuchar.
let hablando = false;
// Temporizador para reiniciar el micro con un pequeño retardo.
let temporizadorReinicioMicro = null;
// Marca temporal del último comando procesado para evitar duplicados.
let ultimoMomentoComando = 0;
// Estado del flujo de voz actual.
let estadoApp = "esperando_comando";
// Posición donde se va a crear el aviso pendiente.
let posicionPendienteAviso = null;
// Aviso pendiente de confirmar para borrado.
let avisoPendienteBorrado = null;
// Temporizador para restaurar el mensaje "En conducción...".
let temporizadorEstadoConduccion = null;
// ID devuelto por watchPosition para detener el GPS cuando haga falta.
let watchIdGPS = null;
// Indica si ya se obtuvo la primera posición GPS válida.
let primerFixGPS = false;
// Cola secuencial de locuciones pendientes para no pisar mensajes de voz.
let colaLocuciones = [];
// Bandera que indica si hay una locucion activa en este momento.
let locucionEnCurso = false;
// Bloquea la voz normal mientras el frenazo espera una respuesta de emergencia.
let vozPrincipalBloqueadaPorEmergencia = false;
// Gestor temporal que tiene prioridad sobre comandos normales como "aviso".
let gestorVozUrgente = null;



// FUNCIONES BÁSICAS DE ESTADO


// Escribe texto en el área de estado general.
function ponerEstado(texto) {
  estadoGeneralEl.textContent = texto;
}

// Escribe texto en el área de estado de sensores.
function ponerEstadoSensores(texto) {
  estadoSensoresEl.textContent = texto;
}

// Cambia el estado interno del flujo conversacional por voz.
function ponerEstadoApp(nuevoEstado) {
  estadoApp = nuevoEstado;
}

// Elimina el temporizador que iba a restaurar el texto de conducción.
function limpiarTemporizadorConduccion() {
  clearTimeout(temporizadorEstadoConduccion);
  temporizadorEstadoConduccion = null;
}

// Programa que el mensaje vuelva a "En conducción..." tras unos segundos.
function programarEstadoConduccion(retardo = RETARDO_ESTADO_CONDUCCION_MS) {
  // Antes de crear uno nuevo, se elimina el temporizador anterior para no acumular varios.
  limpiarTemporizadorConduccion();

  // Si no estamos conduciendo, no tiene sentido restaurar ese estado.
  if (!enConduccion) return;

  // Se espera un tiempo y luego se repone el mensaje de conducción.
  temporizadorEstadoConduccion = setTimeout(() => {
    if (enConduccion) ponerEstado("En conducción...");
  }, retardo);
}

// Limpia variables temporales del flujo por voz.
function resetearPendientes() {
  // Se borra la posición pendiente de aviso.
  posicionPendienteAviso = null;

  // Se borra el aviso pendiente de borrado.
  avisoPendienteBorrado = null;

  // Se vuelve al estado neutral esperando un nuevo comando.
  ponerEstadoApp("esperando_comando");
}

// Devuelve una copia segura del estado relevante para compartir la ruta.
function obtenerEstadoRutaCompartida() {
  return {
    posicionActual: posicionActual ? { ...posicionActual } : null,
    textoDestinoActual,
    latLngDestinoActual: latLngDestinoActual ? { lat: latLngDestinoActual.lat, lng: latLngDestinoActual.lng } : null,
    coordenadasRuta: coordenadasRuta.map(p => ({ lat: p.lat, lng: p.lng })),
    enConduccion,
    rutaDisponible: coordenadasRuta.length > 0
  };
}

// Emite un evento global para que otros scripts conozcan el estado de la ruta.
function notificarEstadoRutaCompartida(origen = "general") {
  window.dispatchEvent(new CustomEvent("ruta-compartida:estado", {
    detail: {
      origen,
      ...obtenerEstadoRutaCompartida()
    }
  }));
}

// Cierra todos los paneles flotantes.
function cerrarPaneles() {
  panelAyudaEl.style.display = "none";
  panelPrivacidadEl.style.display = "none";
  panelMisAvisosEl.classList.add("oculto");
}



// INTERFAZ DE CONDUCCIÓN


// Alterna entre barra normal y barra compacta según el estado de conducción.
function actualizarBarraCompacta() {
  if (!enConduccion) {
    // Fuera de conducción se oculta la barra compacta.
    barraCompactaEl.style.display = "none";

    // Y se vuelve a mostrar la barra completa con todos los botones.
    barraHerramientasEl.classList.remove("oculto");

    // El botón de salir de conducción no tiene sentido fuera de ese modo.
    botonSalirConduccionEl.classList.add("oculto");

    // También se actualiza el resumen de sensores por si hay cambios visibles.
    actualizarResumenSensores();
    return;
  }

  // En conducción se oculta la barra grande para ganar espacio en pantalla.
  barraHerramientasEl.classList.add("oculto");

  // Y se muestra una barra simple con información mínima.
  barraCompactaEl.style.display = "block";

  // El botón salir se hace visible porque ahora sí es relevante.
  botonSalirConduccionEl.classList.remove("oculto");

  // Si no hay destino, se muestra "Sin destino" como valor por defecto.
  const destino = textoDestinoActual || "Sin destino";

  // La barra compacta resume destino y número de avisos en ruta.
  barraCompactaEl.textContent = `Destino: ${destino} | Avisos en ruta: ${avisosEnRuta.length}`;

  // Se actualiza el resumen de sensores aunque en conducción normalmente esté oculto.
  actualizarResumenSensores();
}



// FUNCIONES AUXILIARES DE TEXTO


// Convierte un timestamp en una hora legible en formato español.
function formatearHora(ts) {
  return new Date(ts).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

// Normaliza texto para comparaciones robustas de voz.
function normalizarTexto(texto) {
  return texto
    // Pasa todo a minúsculas.
    .toLowerCase()
    // Elimina espacios al principio y al final.
    .trim()
    // Separa letras y tildes para poder eliminar acentos.
    .normalize("NFD")
    // Elimina marcas diacríticas para que "sí" y "si" cuenten igual.
    .replace(/[\u0300-\u036f]/g, "");
}

// Intenta convertir el texto del usuario en un motivo estándar de aviso.
function mapearMotivoAviso(texto) {
  const limpio = normalizarTexto(texto);

  // Se buscan palabras clave para clasificar el aviso en categorías comunes.
  if (limpio.includes("accidente")) return "Accidente";
  if (limpio.includes("bache")) return "Bache";
  if (limpio.includes("retencion") || limpio.includes("atasco")) return "Retención";
  if (limpio.includes("obras")) return "Obras";
  if (limpio.includes("niebla")) return "Niebla";
  if (limpio.includes("lluvia")) return "Lluvia";
  if (limpio.includes("radar")) return "Radar";
  if (limpio.includes("policia")) return "Policía";
  if (limpio.includes("peligro")) return "Peligro";

  // Si no entra en ninguna categoría, se conserva el texto original.
  return texto.trim() || "AVISO";
}

// Une varios mensajes en una sola frase natural para voz.
function unirMensajesParaVoz(mensajes) {
  if (mensajes.length === 0) return "";
  if (mensajes.length === 1) return mensajes[0];
  if (mensajes.length === 2) return `${mensajes[0]} y ${mensajes[1]}`;

  // Para 3 o más elementos, separa con comas y deja "y" antes del último.
  return `${mensajes.slice(0, -1).join(", ")} y ${mensajes[mensajes.length - 1]}`;
}

// Convierte una distancia en una frase más natural para ser leída por voz.
function formatearDistanciaVoz(distancia) {
  // Se redondea a decenas para evitar anunciar cifras demasiado específicas.
  const redondeada = Math.round(distancia / 10) * 10;

  // Si es extremadamente cerca, se usa una expresión más natural.
  if (redondeada < 20) return "muy cerca";

  return `a ${redondeada} metros`;
}

// Crea un icono Leaflet basado en HTML y CSS, no en imagen.
function crearIconoHTML(clase, texto) {
  return L.divIcon({
    // Se deja vacío porque el estilo real se aplica en el HTML interno.
    className: "",

    // Se genera un div con la clase y el texto indicados.
    html: `<div class="${clase}">${texto}</div>`,

    // Se deja null para que el tamaño lo determine el contenido HTML.
    iconSize: null
  });
}

// Comprueba si una frase hablada equivale a una confirmación.
function esConfirmacion(texto) {
  return /^(si|sí|vale|ok|de acuerdo|confirmo)$/.test(normalizarTexto(texto));
}

// Comprueba si una frase hablada equivale a una negación o cancelación.
function esNegacion(texto) {
  return /^(no|cancelar|cancela|olvida)$/.test(normalizarTexto(texto));
}



// PERSISTENCIA DE PRIVACIDAD


// Recupera desde localStorage los permisos y ajustes guardados anteriormente.
function cargarPrivacidad() {
  const guardado = localStorage.getItem(CLAVE_PRIVACIDAD);

  // Si nunca se guardó nada, simplemente no se hace nada.
  if (!guardado) return;

  try {
    const datos = JSON.parse(guardado);

    // Cada propiedad solo se aplica si realmente es booleana.
    if (typeof datos.microfono === "boolean") privacidad.microfono = datos.microfono;
    if (typeof datos.ubicacion === "boolean") privacidad.ubicacion = datos.ubicacion;
    if (typeof datos.camara === "boolean") privacidad.camara = datos.camara;
    if (typeof datos.somnolenciaEncendida === "boolean") privacidad.somnolenciaEncendida = datos.somnolenciaEncendida;
    if (typeof datos.inicializado === "boolean") privacidad.inicializado = datos.inicializado;
    if (typeof datos.frenazoEncendido === "boolean") privacidad.frenazoEncendido = datos.frenazoEncendido;
    if (typeof datos.contactoEmergenciaNombre === "string") privacidad.contactoEmergenciaNombre = datos.contactoEmergenciaNombre;
    if (typeof datos.contactoEmergenciaEmail === "string") privacidad.contactoEmergenciaEmail = datos.contactoEmergenciaEmail;
  } catch {
    // Si el contenido está dañado o no es JSON válido, se reinicia a valores seguros.
    privacidad.microfono = false;
    privacidad.ubicacion = false;
    privacidad.camara = false;
    privacidad.somnolenciaEncendida = false;
    privacidad.inicializado = false;
    privacidad.frenazoEncendido = false;
    privacidad.contactoEmergenciaNombre = "";
    privacidad.contactoEmergenciaEmail = "";
  }
}

// Guarda en localStorage la configuración actual del usuario.
function guardarPrivacidad() {
  localStorage.setItem(CLAVE_PRIVACIDAD, JSON.stringify(privacidad));
}

// Guarda solo algunos campos para no pisar permisos al hacer cambios puntuales.
function guardarPrivacidadParcial(parcial) {
  let actual = {};

  try {
    actual = JSON.parse(localStorage.getItem(CLAVE_PRIVACIDAD) || "{}");
  } catch {
    actual = {};
  }

  localStorage.setItem(CLAVE_PRIVACIDAD, JSON.stringify({
    ...actual,
    ...parcial
  }));
}

// Hace que la interfaz refleje el estado real del objeto privacidad.
function aplicarPrivacidadEnUI() {
  // Se marcan o desmarcan las casillas según los permisos guardados.
  usarMicrofonoEl.checked = privacidad.microfono;
  usarUbicacionEl.checked = privacidad.ubicacion;
  usarCamaraEl.checked = privacidad.camara;

  // Se actualiza el resumen de sensores para que coincida con esos permisos.
  actualizarResumenSensores();
}

// Construye una frase resumen del estado actual de permisos y sensores.
function actualizarResumenSensores() {
  // En conducción se oculta esta línea para dejar más espacio libre al mapa.
  if (enConduccion) {
    estadoSensoresEl.style.display = "none";
    return;
  }

  // Fuera de conducción se vuelve a mostrar.
  estadoSensoresEl.style.display = "block";

  const partes = [];

  // Se describe si el micrófono está activo o no.
  if (privacidad.microfono && microfonoPausadoPorError) {
    partes.push("Micrófono pendiente de reactivar");
  } else {
    partes.push(privacidad.microfono ? "Micrófono activo" : "Micrófono desactivado");
  }

  // Se describe si la ubicación está disponible o desactivada.
  partes.push(
    privacidad.ubicacion
      ? (enConduccion ? "GPS en uso" : "GPS disponible")
      : "Ubicación desactivada"
  );

  // Se resume el estado de la cámara y del detector.
  if (!privacidad.camara) {
    partes.push("Cámara desactivada");
  } else if (privacidad.somnolenciaEncendida) {
    partes.push("Somnolencia encendida");
  } else {
    partes.push("Somnolencia apagada");
  }

  // Se resume el estado del detector de frenazo.
  partes.push(privacidad.frenazoEncendido ? "Frenazo encendido" : "Frenazo apagado");

  // Se unen todos los fragmentos con separador visual.
  ponerEstadoSensores(partes.join(" | "));
}



// PETICIÓN DE PERMISOS


// Pide permiso de micrófono y devuelve true si se concedió.
async function pedirPermisoMicrofono() {
  // Si el navegador no soporta getUserMedia, no se puede pedir.
  if (!navigator.mediaDevices?.getUserMedia) return false;

  try {
    // Se solicita solo audio.
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Se cierran inmediatamente los tracks porque aquí solo interesa comprobar el permiso.
    stream.getTracks().forEach(track => track.stop());

    return true;
  } catch {
    // Si falla, se interpreta como permiso denegado o no disponible.
    return false;
  }
}

// Pide permiso de ubicación haciendo una consulta puntual.
function pedirPermisoUbicacion() {
  // Si el navegador no soporta geolocalización, se devuelve false.
  if (!("geolocation" in navigator)) return Promise.resolve(false);

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      // Si se consigue posición, la ubicación está permitida.
      () => resolve(true),

      // Si falla, se considera que no hay permiso o no está disponible.
      () => resolve(false),

      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}

// Pide permiso de cámara y lo libera justo después.
async function pedirPermisoCamara() {
  if (!navigator.mediaDevices?.getUserMedia) return false;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "user" } },
      audio: false
    });

    // Se cierra enseguida porque aquí solo se está validando permiso.
    stream.getTracks().forEach(track => track.stop());

    return true;
  } catch {
    return false;
  }
}



// APLICAR CAMBIOS DE PERMISOS


// Activa o desactiva el uso del micrófono.
function ponerPermisoMicrofono(valor) {
  // Se actualiza el estado interno.
  privacidad.microfono = valor;
  microfonoPausadoPorError = false;

  // Se refleja en la casilla visual.
  usarMicrofonoEl.checked = valor;

  // Se persiste el cambio.
  guardarPrivacidad();

  if (!valor) {
    // Si se desactiva, se detiene el reconocimiento.
    pararReconocimiento();
  } else {
    // Si se activa, se arranca con un pequeño retardo.
    iniciarReconocimientoConRetardo(150);
  }

  actualizarResumenSensores();
}

// Pausa la escucha por un error del navegador sin borrar la preferencia guardada.
function pausarMicrofonoPorError(textoEstado) {
  microfonoPausadoPorError = true;
  pararReconocimiento();
  usarMicrofonoEl.checked = privacidad.microfono;
  ponerEstadoSensores(textoEstado);
}

// Activa o desactiva la ubicación.
function ponerPermisoUbicacion(valor) {
  privacidad.ubicacion = valor;
  usarUbicacionEl.checked = valor;
  guardarPrivacidad();

  if (!valor) {
    // Sin ubicación ya no se puede seguir al usuario en tiempo real.
    pararWatchGPS();

    // Si la app estaba en conducción, se sale porque la navegación depende del GPS.
    if (enConduccion) salirModoConduccion();
  } else {
    // Si vuelve a activarse, se vuelve a iniciar el seguimiento GPS.
    iniciarWatchGPS();
  }

  actualizarResumenSensores();
}

// Activa o desactiva el permiso de cámara.
function ponerPermisoCamara(valor) {
  privacidad.camara = valor;
  usarCamaraEl.checked = valor;

  if (!valor) {
    // Si se pierde la cámara, se fuerza apagar el detector.
    privacidad.somnolenciaEncendida = false;

    // También se cierra la ventana visual por coherencia.
    modalSomnolenciaEl.classList.remove("abierto");

    // Se notifica al módulo de somnolencia para que se detenga de verdad.
    window.dispatchEvent(new CustomEvent("somnolencia:detener"));
  }

  guardarPrivacidad();
  actualizarResumenSensores();
}



// PERMISOS INICIALES


// Pide todos los permisos la primera vez que entra el usuario.
async function pedirPermisosInicialesSiHaceFalta() {
  // Si ya se había inicializado antes, no se vuelven a pedir aquí.
  if (privacidad.inicializado) return;

  // Se limpian primero las casillas visualmente.
  usarMicrofonoEl.checked = false;
  usarUbicacionEl.checked = false;
  usarCamaraEl.checked = false;

  ponerEstado("Solicitando permisos iniciales...");

  // Se pide permiso de micrófono y se guarda el resultado.
  const okMicro = await pedirPermisoMicrofono();
  privacidad.microfono = okMicro;
  usarMicrofonoEl.checked = okMicro;

  // Se pide permiso de ubicación y se guarda el resultado.
  const okUbicacion = await pedirPermisoUbicacion();
  privacidad.ubicacion = okUbicacion;
  usarUbicacionEl.checked = okUbicacion;

  // Se pide permiso de cámara y se guarda el resultado.
  const okCamara = await pedirPermisoCamara();
  privacidad.camara = okCamara;
  usarCamaraEl.checked = okCamara;

  // Aunque la cámara esté permitida, el detector empieza apagado por diseño.
  privacidad.somnolenciaEncendida = false;

  // El detector de frenazo siempre empieza apagado al entrar en la app.
  privacidad.frenazoEncendido = false;

  // A partir de ahora ya no se considera "primera vez".
  privacidad.inicializado = true;
  guardarPrivacidad();
  aplicarPrivacidadEnUI();

  // Si hay permiso de micro, se prepara el reconocimiento de voz.
  if (okMicro) iniciarReconocimientoConRetardo(150);

  // Si hay permiso de ubicación, se inicia el seguimiento GPS.
  if (okUbicacion) iniciarWatchGPS();

  ponerEstado("Permisos iniciales revisados. Puedes usar los detectores desde Privacidad");
}

// Prepara la solicitud automática de permisos sin mostrar botones específicos para ello.
function prepararSolicitudPermisosIniciales() {
  // No se obliga al usuario a pulsar un botón de permiso concreto.
  // Basta con la primera interacción normal con la app para lanzar la solicitud inicial.
  ponerEstado("Toca la pantalla para iniciar el sistema");

  const pedir = () => {
    window.removeEventListener("pointerdown", pedir);
    window.removeEventListener("keydown", pedir);
    pedirPermisosInicialesSiHaceFalta();
  };

  window.addEventListener("pointerdown", pedir, { once: true });
  window.addEventListener("keydown", pedir, { once: true });
}



// CONTROL DEL DETECTOR DE FRENADO

// Enciende el detector de frenazo.
// El contacto de emergencia se pide o se edita en el propio flujo del módulo frenazo.
function encenderDetectorFrenazo() {
  // Se envía un evento al módulo específico de frenazo.
  window.dispatchEvent(new CustomEvent("frenazo:activar"));

  ponerEstado("Configurando detector de frenazo...");
}

// Apaga completamente el detector de frenazo.
function apagarDetectorFrenazo() {
  // Se avisa al módulo de frenazo para parar escucha y flujo interno.
  window.dispatchEvent(new CustomEvent("frenazo:detener"));

}



// CONTROL DEL DETECTOR DE SOMNOLENCIA


// Enciende el detector de somnolencia si la cámara está disponible.
function encenderDetectorSomnolencia() {
  if (!privacidad.camara) {
    ponerEstado("Activa la cámara en Privacidad antes de encender somnolencia");
    return;
  }

  // Se marca como encendido en el estado persistente.
  privacidad.somnolenciaEncendida = true;
  guardarPrivacidad();

  // Se envía un evento al módulo específico de somnolencia.
  window.dispatchEvent(new CustomEvent("somnolencia:activar"));

  actualizarResumenSensores();
  ponerEstado("Detector de somnolencia encendido");
}

// Apaga completamente el detector.
function apagarDetectorSomnolencia() {
  // Se marca como apagado.
  privacidad.somnolenciaEncendida = false;
  guardarPrivacidad();

  // También se cierra la ventana visual, si estaba abierta.
  modalSomnolenciaEl.classList.remove("abierto");

  // Se avisa al módulo de somnolencia para parar cámara, canvas y alarma.
  window.dispatchEvent(new CustomEvent("somnolencia:detener"));

  actualizarResumenSensores();
  ponerEstado("Detector de somnolencia apagado");
}



// SÍNTESIS DE VOZ

// Procesa de forma secuencial las locuciones pendientes.
function procesarColaLocuciones() {
  // Si ya hay una locucion en curso o la cola esta vaci­a, no se hace nada.
  if (locucionEnCurso || colaLocuciones.length === 0) return;

  // Se extrae el siguiente mensaje pendiente.
  const siguiente = colaLocuciones.shift();

  // Mientras la app habla, no debe escuchar.
  hablando = true;
  locucionEnCurso = true;

  // Se para el reconocimiento para evitar que escuche su propia voz.
  pararReconocimiento();

  const utterance = new SpeechSynthesisUtterance(siguiente.texto);
  utterance.lang = "es-ES";
  utterance.rate = 1;

  utterance.onend = () => {
    // Cuando termina, ya no hay una locución activa.
    hablando = false;
    locucionEnCurso = false;
    actualizarResumenSensores();
    iniciarReconocimientoConRetardo(120);
    if (siguiente.callback) siguiente.callback();
    procesarColaLocuciones();
  };

  utterance.onerror = () => {
    // Incluso si falla, se libera el bloqueo y se intenta seguir con la cola.
    hablando = false;
    locucionEnCurso = false;
    actualizarResumenSensores();
    iniciarReconocimientoConRetardo(120);
    if (siguiente.callback) siguiente.callback();
    procesarColaLocuciones();
  };

  // Se lanza la locucion actual.
  speechSynthesis.speak(utterance);
}

// Redefine la sintesis para que use una cola y no pise mensajes anteriores.
function hablar(texto, callback = null) {
  // Si no hay texto real, no se encola nada.
  if (!texto) return;

  // Se guarda el mensaje al final de la cola.
  colaLocuciones.push({ texto, callback });

  // Se intenta procesar la cola ahora mismo.
  procesarColaLocuciones();
}

// Corta de inmediato solo la locucion actual, pero NO vacia la cola pendiente.
function interrumpirLocucionActual() {
  // Si no estaba hablando, no hace falta cortar nada.
  if (!hablando && !locucionEnCurso) return false;

  // Se intenta cancelar la locucion activa del navegador.
  try {
    speechSynthesis.cancel();
  } catch {}

  // Se libera el estado interno para poder meter un mensaje urgente.
  hablando = false;
  locucionEnCurso = false;
  actualizarResumenSensores();

  return true;
}

// Interrumpe lo que suena ahora mismo y habla algo urgente sin borrar la cola.
function interrumpirYHablarUrgente(texto, callback = null) {
  // Se corta solo la locucion en curso.
  interrumpirLocucionActual();

  // Se detiene temporalmente el micro para evitar escucharse a si misma.
  pararReconocimiento();

  // Se inserta el mensaje urgente al principio de la cola.
  colaLocuciones.unshift({ texto, callback });

  // Se fuerza el procesamiento inmediato de la cola.
  procesarColaLocuciones();
}

// Reanuda las locuciones normales si habia mensajes pendientes.
function reanudarLocucionesNormales() {
  if (locucionEnCurso) return;
  procesarColaLocuciones();
}

// Permite escribir un estado urgente desde otros modulos.
function ponerEstadoUrgente(texto) {
  ponerEstado(texto);
}

// Devuelve si ahora mismo habia una locucion en curso.
function hayLocucionEnCurso() {
  return !!locucionEnCurso;
}
// Pausa el reconocimiento normal para que una emergencia no confirme avisos por error.
function bloquearVozPrincipalPorEmergencia() {
  vozPrincipalBloqueadaPorEmergencia = true;
  resetearPendientes();
  pararReconocimiento();
}

// Devuelve la voz normal a la app cuando termina el flujo urgente.
function desbloquearVozPrincipalPorEmergencia() {
  vozPrincipalBloqueadaPorEmergencia = false;
  gestorVozUrgente = null;
  if (privacidad.microfono) iniciarReconocimientoConRetardo(250);
}

// Registra una interpretacion urgente que se ejecuta antes que los comandos normales.
function registrarGestorVozUrgente(gestor) {
  gestorVozUrgente = typeof gestor === "function" ? gestor : null;
  if (privacidad.microfono) iniciarReconocimientoConRetardo(150);
}

// Quita la interpretacion urgente y vuelve al flujo normal.
function limpiarGestorVozUrgente(gestor = null) {
  if (!gestor || gestorVozUrgente === gestor) {
    gestorVozUrgente = null;
  }
}



// RECONOCIMIENTO DE VOZ


// Crea y configura el objeto de reconocimiento de voz.
function crearReconocimiento() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  // Si el navegador no soporta la API, se avisa y no se crea nada.
  if (!SR) {
    ponerEstadoSensores("Navegador sin reconocimiento de voz");
    return null;
  }

  const rec = new SR();

  // Se configura en español.
  rec.lang = "es-ES";

  // Se deja continuo para que siga escuchando sin reiniciar cada frase.
  rec.continuous = true;

  // No interesan resultados intermedios, solo finales.
  rec.interimResults = false;

  // Con una alternativa basta.
  rec.maxAlternatives = 1;

  rec.onstart = () => {
    // Se marca que el reconocimiento ya está activo.
    reconocimientoActivo = true;
    actualizarResumenSensores();
  };

  rec.onresult = (event) => {
    // Si la app está hablando o el micro no está permitido, se ignora el resultado.
    if (hablando || !privacidad.microfono) return;

    const ahora = Date.now();

    // Si el último comando fue hace muy poco, se ignora para evitar dobles disparos.
    if (ahora - ultimoMomentoComando < COOLDOWN_COMANDOS_MS) return;

    // Se toma el último resultado reconocido.
    const ultimo = event.results[event.results.length - 1];

    // Se normaliza el texto para compararlo mejor.
    const texto = normalizarTexto(ultimo[0].transcript);

    ultimoMomentoComando = ahora;

    // Se delega la interpretación al gestor del flujo de voz.
    if (gestorVozUrgente) {
      const consumido = gestorVozUrgente(texto);
      if (consumido !== false) return;
    }

    if (vozPrincipalBloqueadaPorEmergencia) return;

    gestionarComandoVoz(texto);
  };

  rec.onerror = (event) => {
    if (event.error === "not-allowed") {
      // Se pausa sin borrar la preferencia guardada; a veces ocurre al recargar.
      pausarMicrofonoPorError("Toca la pantalla para reactivar el micrófono");
      return;
    }

    if (event.error === "audio-capture") {
      // Se pausa sin desactivar el ajuste, por si el dispositivo libera el micro despues.
      pausarMicrofonoPorError("No se detecta micrófono. Reintentará al tocar la pantalla");
      return;
    }

    if (event.error === "network") {
      // En algunos navegadores el reconocimiento puede fallar por red y se reintenta.
      ponerEstadoSensores("Reintentando micrófono...");
      iniciarReconocimientoConRetardo(300);
      return;
    }

    // Estos errores son normales y no requieren acción especial.
    if (event.error === "no-speech" || event.error === "aborted") return;

    // Para otros errores, se muestra estado y se intenta reiniciar.
    ponerEstadoSensores("Error de micrófono");
    iniciarReconocimientoConRetardo(400);
  };

  rec.onend = () => {
    // Cuando termina de escuchar, se marca como inactivo.
    reconocimientoActivo = false;

    // Si no está hablando y el permiso sigue activo, se relanza automáticamente.
    if (!hablando && privacidad.microfono && (!vozPrincipalBloqueadaPorEmergencia || gestorVozUrgente) && !microfonoPausadoPorError) iniciarReconocimientoConRetardo(150);
  };

  return rec;
}

// Intenta arrancar el reconocimiento si se cumplen todas las condiciones.
function iniciarReconocimiento() {
  if (!privacidad.microfono) {
    actualizarResumenSensores();
    return;
  }

  // Si no existe, ya está activo o la app está hablando, no se inicia.
  if (!reconocimiento || reconocimientoActivo || hablando || microfonoPausadoPorError) return;
  if (vozPrincipalBloqueadaPorEmergencia && !gestorVozUrgente) return;

  try {
    reconocimiento.start();
  } catch {}
}

// Detiene el reconocimiento si estaba activo.
function pararReconocimiento() {
  // También se borra un posible reinicio pendiente.
  clearTimeout(temporizadorReinicioMicro);

  if (reconocimiento && reconocimientoActivo) {
    try {
      reconocimiento.stop();
    } catch {}
  }
}

// Programa el inicio del reconocimiento tras un pequeño retraso.
function iniciarReconocimientoConRetardo(ms = 150) {
  clearTimeout(temporizadorReinicioMicro);
  temporizadorReinicioMicro = setTimeout(iniciarReconocimiento, ms);
}



// Si el navegador bloquea la voz al arrancar, una nueva pulsacion permite reintentarlo.
function reintentarMicrofonoPausado() {
  if (!microfonoPausadoPorError || !privacidad.microfono) return;

  microfonoPausadoPorError = false;
  ponerEstadoSensores("Reactivando micrófono...");
  iniciarReconocimientoConRetardo(150);
}

window.addEventListener("pointerdown", reintentarMicrofonoPausado);
window.addEventListener("keydown", reintentarMicrofonoPausado);



// GPS Y POSICIÓN


// Detiene el seguimiento GPS continuo.
function pararWatchGPS() {
  if (watchIdGPS !== null) {
    navigator.geolocation.clearWatch(watchIdGPS);
    watchIdGPS = null;
  }

  // Al parar el watch, la próxima posición válida volverá a ser considerada primer fix.
  primerFixGPS = false;
}

// Inicia el seguimiento GPS continuo con alta precisión.
function iniciarWatchGPS() {
  if (!privacidad.ubicacion) {
    actualizarResumenSensores();
    return;
  }

  if (!("geolocation" in navigator)) {
    ponerEstadoSensores("El navegador no soporta ubicación");
    return;
  }

  // Antes de crear uno nuevo, se detiene el seguimiento anterior si existía.
  pararWatchGPS();
  ponerEstadoSensores("Buscando señal GPS...");

  watchIdGPS = navigator.geolocation.watchPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const accuracy = position.coords.accuracy;

      // Se guarda la posición actual completa.
      posicionActual = { lat, lng, accuracy };
      notificarEstadoRutaCompartida("gps");

      // Se actualiza el marcador del usuario en el mapa.
      actualizarPosicionUsuario(lat, lng);

      // Solo en la primera posición válida se muestra un mensaje inicial.
      if (!primerFixGPS) {
        primerFixGPS = true;

        ponerEstado(
          accuracy <= 100
            ? "GPS activo. Puedes crear la ruta o empezar a conducir"
            : `GPS activo, pero precisión limitada (${Math.round(accuracy)} m)`
        );
      }

      actualizarResumenSensores();

      // Si se está conduciendo, la nueva posición afecta a muchas partes de la app.
      if (enConduccion) {
        // Se actualiza qué parte de la ruta está hecha.
        actualizarProgresoRutaGPS();

        // Se revisa si hay avisos cercanos que anunciar.
        anunciarAvisosProximos();

        // Se comprueba si el coche se salió de la ruta y hay que recalcular.
        comprobarSalidaDeRutaYRecalcular();
      }
    },
    (error) => {
      switch (error.code) {
        case error.PERMISSION_DENIED:
          // Si se niega el permiso, se refleja inmediatamente.
          ponerPermisoUbicacion(false);
          ponerEstadoSensores("Activa permisos de ubicación");
          break;

        case error.POSITION_UNAVAILABLE:
          ponerEstadoSensores("Ubicación no disponible");
          break;

        case error.TIMEOUT:
          ponerEstadoSensores("GPS tardó demasiado; reintentando...");
          break;

        default:
          ponerEstadoSensores("Error de ubicación");
      }
    },
    {
      enableHighAccuracy: true,
      maximumAge: GPS_MAXIMUM_AGE_MS,
      timeout: GPS_TIMEOUT_MS
    }
  );
}



// MAPA Y RUTA


// Inicializa el mapa Leaflet y sus capas principales.
function iniciarMapa() {
  // Se crea el mapa centrado inicialmente en Madrid como posición por defecto.
  mapa = L.map("mapa").setView([40.4168, -3.7038], 14);

  // Se añade la capa base de OpenStreetMap.
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(mapa);

  // Línea azul para la parte pendiente de la ruta.
  lineaRutaPendiente = L.polyline([], {
    color: "#2563eb",
    weight: 7,
    opacity: 0.95
  }).addTo(mapa);

  // Línea naranja para la parte ya recorrida.
  lineaRutaRecorrida = L.polyline([], {
    color: "#f97316",
    weight: 7,
    opacity: 1
  }).addTo(mapa);

  // Se crea una posición inicial visual hasta que llegue el GPS real.
  actualizarPosicionUsuario(40.4168, -3.7038);
}

// Coloca o mueve el marcador del usuario.
function actualizarPosicionUsuario(lat, lng) {
  const latlng = L.latLng(lat, lng);

  if (!marcadorUsuario) {
    // Si no existe, se crea por primera vez.
    marcadorUsuario = L.marker(latlng, {
      icon: crearIconoHTML("marcador-usuario", "TÚ")
    }).addTo(mapa).bindPopup("Tu posición");
  } else {
    // Si ya existe, solo se actualiza su posición.
    marcadorUsuario.setLatLng(latlng);
  }

  // Si el mapa debe seguir el coche, se recentra automáticamente.
  if (seguirVehiculo) mapa.setView(latlng, ZOOM_CONDUCCION, { animate: true });
}

// Borra visualmente las líneas de ruta.
function resetearLineasRuta() {
  indiceMaxRecorrido = 0;
  lineaRutaPendiente.setLatLngs([]);
  lineaRutaRecorrida.setLatLngs([]);
}

// Elimina la ruta actual y limpia variables asociadas.
function limpiarRuta() {
  coordenadasRuta = [];
  textoDestinoActual = "";
  latLngDestinoActual = null;

  // Si había un control de ruta activo, se quita del mapa.
  if (controlRuta) {
    mapa.removeControl(controlRuta);
    controlRuta = null;
  }

  resetearLineasRuta();
  refrescarVisibilidadAvisos();
  actualizarBarraCompacta();
  notificarEstadoRutaCompartida("ruta_limpiada");
}



// CÁLCULOS GEOGRÁFICOS


// Calcula la distancia geográfica aproximada entre dos puntos usando Haversine.
function distanciaHaversineMetros(a, b) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) *
    Math.cos(toRad(b.lat)) *
    Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// Calcula la distancia mínima entre un punto y un segmento de recta de la ruta.
function distanciaPuntoASegmentoMetros(p, a, b) {
  const ax = a.lng;
  const ay = a.lat;
  const bx = b.lng;
  const by = b.lat;
  const px = p.lng;
  const py = p.lat;

  const dx = bx - ax;
  const dy = by - ay;

  // Si el segmento es en realidad un punto, se mide distancia directa.
  if (dx === 0 && dy === 0) return distanciaHaversineMetros(p, a);

  // Proyección del punto p sobre el segmento ab.
  let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);

  // Se fuerza a que la proyección quede dentro del segmento.
  t = Math.max(0, Math.min(1, t));

  const proj = { lat: ay + t * dy, lng: ax + t * dx };
  return distanciaHaversineMetros(p, proj);
}

// Calcula la distancia mínima entre un punto y toda la ruta.
function distanciaARutaMetros(point, path) {
  if (path.length < 2) return Infinity;

  let min = Infinity;

  // Se revisa cada segmento de la polilínea y se toma la menor distancia.
  for (let i = 0; i < path.length - 1; i++) {
    const d = distanciaPuntoASegmentoMetros(point, path[i], path[i + 1]);
    if (d < min) min = d;
  }

  return min;
}

// Devuelve el índice del punto de ruta más cercano a una posición dada.
function buscarIndiceRutaMasCercano(point) {
  let minDist = Infinity;
  let indice = 0;

  for (let i = 0; i < coordenadasRuta.length; i++) {
    const d = distanciaHaversineMetros(point, coordenadasRuta[i]);
    if (d < minDist) {
      minDist = d;
      indice = i;
    }
  }

  return indice;
}

// Actualiza visualmente la parte recorrida y la parte pendiente de la ruta.
function actualizarProgresoRutaGPS() {
  if (!coordenadasRuta.length || !posicionActual) return;

  const puntoActual = L.latLng(posicionActual.lat, posicionActual.lng);
  const indiceMasCercano = buscarIndiceRutaMasCercano(puntoActual);

  // Solo se avanza hacia delante en la ruta; nunca se reduce el progreso ya hecho.
  if (indiceMasCercano > indiceMaxRecorrido) indiceMaxRecorrido = indiceMasCercano;

  // Parte recorrida: desde el inicio hasta el último punto alcanzado.
  const recorrida = coordenadasRuta
    .slice(0, indiceMaxRecorrido + 1)
    .map(p => [p.lat, p.lng]);

  // Se añade la posición actual para que la línea llegue exactamente al coche.
  recorrida.push([posicionActual.lat, posicionActual.lng]);

  // Parte pendiente: desde la posición actual hasta el resto de la ruta.
  const pendiente = [[posicionActual.lat, posicionActual.lng]]
    .concat(coordenadasRuta.slice(indiceMaxRecorrido + 1).map(p => [p.lat, p.lng]));

  lineaRutaRecorrida.setLatLngs(recorrida);
  lineaRutaPendiente.setLatLngs(pendiente);
}



// GEOCODIFICACIÓN Y CONSTRUCCIÓN DE RUTA


// Convierte un texto de destino en coordenadas reales usando Nominatim.
async function geocodificarDestino(query) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`
  );
  const data = await response.json();

  // Si no hay resultados, se lanza un error que luego mostrará un mensaje al usuario.
  if (!data?.length) throw new Error("Destino no encontrado");

  return L.latLng(parseFloat(data[0].lat), parseFloat(data[0].lon));
}

// Construye una ruta entre origen y destino usando Leaflet Routing Machine + OSRM.
function construirRuta(inicioLatLng, destinoLatLng) {
  return new Promise((resolve, reject) => {
    // Si ya había un control de ruta previo, se elimina para no duplicar rutas.
    if (controlRuta) {
      mapa.removeControl(controlRuta);
      controlRuta = null;
    }

    resetearLineasRuta();
    coordenadasRuta = [];
    indiceMaxRecorrido = 0;

    controlRuta = L.Routing.control({
      // Se fijan origen y destino.
      waypoints: [inicioLatLng, destinoLatLng],

      // Se usa el servicio OSRM público.
      router: L.Routing.osrmv1({
        serviceUrl: "https://router.project-osrm.org/route/v1"
      }),

      // Se bloquea la edición manual de waypoints porque aquí no interesa.
      routeWhileDragging: false,
      addWaypoints: false,
      draggableWaypoints: false,

      // Se ajusta el mapa automáticamente a la ruta.
      fitSelectedRoutes: true,

      // Se oculta el panel textual del plugin.
      show: false,
      collapsible: true,

      // Se oculta la línea por defecto del plugin porque usamos nuestras propias polilíneas.
      lineOptions: { styles: [{ color: "transparent", opacity: 0, weight: 0 }] },

      // Se desactivan los marcadores automáticos de inicio y fin.
      createMarker: () => null
    }).addTo(mapa);

    controlRuta.on("routesfound", (e) => {
      const route = e.routes[0];

      // Se transforma la ruta a una lista simple de puntos lat/lng.
      coordenadasRuta = route.coordinates.map(c => ({ lat: c.lat, lng: c.lng }));

      // Inicialmente toda la ruta es pendiente.
      lineaRutaPendiente.setLatLngs(coordenadasRuta.map(p => [p.lat, p.lng]));
      lineaRutaRecorrida.setLatLngs([]);

      // Se actualizan avisos visibles para la nueva ruta.
      refrescarVisibilidadAvisos();
      actualizarBarraCompacta();

      resolve(route);
    });

    controlRuta.on("routingerror", () => {
      reject(new Error("No se pudo calcular la ruta"));
    });
  });
}

// Crea una nueva ruta a partir del texto escrito en el input.
async function crearRutaDesdeInput() {
  const destino = destinoInputEl.value.trim();

  if (!destino) {
    ponerEstado("Escribe un destino");
    return;
  }

  if (!privacidad.ubicacion) {
    ponerEstado("Activa la ubicación para usar GPS real");
    return;
  }

  if (!posicionActual) {
    ponerEstado("Esperando una posición GPS válida...");
    return;
  }

  // Se limpian estados temporales y paneles antes de empezar un nuevo cálculo.
  limpiarTemporizadorConduccion();
  detenerConduccion(false);
  cerrarPaneles();

  textoDestinoActual = destino;
  ponerEstado("Calculando ruta...");

  try {
    const inicio = L.latLng(posicionActual.lat, posicionActual.lng);
    const destinoLatLng = await geocodificarDestino(destino);

    latLngDestinoActual = destinoLatLng;
    await construirRuta(inicio, destinoLatLng);

    // Al crear una ruta nueva, todos los avisos vuelven a ser anunciables.
    avisos.forEach(a => {
      a.anunciado150 = false;
      a.anunciado50 = false;
    });

    refrescarVisibilidadAvisos();
    ponerEstado(`Ruta creada hacia ${destino}. Avisos en ruta: ${avisosEnRuta.length}`);
    notificarEstadoRutaCompartida("ruta_creada");
    anunciarNumeroAvisosRuta("Ruta creada");
  } catch (error) {
    ponerEstado(error.message || "No se pudo crear la ruta");
  }
}



// CONDUCCIÓN Y RECÁLCULO


// Activa el modo conducción si existe ruta y GPS válido.
function empezarConduccion() {
  if (!coordenadasRuta.length) {
    ponerEstado("Primero crea una ruta");
    return;
  }

  if (!privacidad.ubicacion) {
    ponerEstado("Activa la ubicación para empezar la ruta");
    return;
  }

  if (!posicionActual) {
    ponerEstado("Esperando una posición GPS válida...");
    return;
  }

  limpiarTemporizadorConduccion();
  enConduccion = true;
  seguirVehiculo = true;
  actualizarBarraCompacta();
  cerrarPaneles();

  // Al iniciar conducción, todos los avisos pueden volver a anunciarse.
  avisos.forEach(a => {
    a.anunciado150 = false;
    a.anunciado50 = false;
  });

  ponerEstado("En conducción...");
  notificarEstadoRutaCompartida("conduccion_iniciada");
  actualizarProgresoRutaGPS();
}

// Desactiva el modo conducción y opcionalmente limpia la ruta.
function detenerConduccion(limpiarRutaTambien = true) {
  limpiarTemporizadorConduccion();
  enConduccion = false;
  seguirVehiculo = false;
  actualizarBarraCompacta();
  resetearPendientes();

  if (limpiarRutaTambien) limpiarRuta();
  notificarEstadoRutaCompartida("conduccion_detenida");
}

// Comprueba si el coche se salió de la ruta y recalcula si hace falta.
async function comprobarSalidaDeRutaYRecalcular() {
  // Si falta cualquier dato clave, no se puede recalcular.
  if (!posicionActual || !coordenadasRuta.length || !textoDestinoActual || !latLngDestinoActual) return;

  // Si ya se está recalculando o no se está conduciendo, se sale.
  if (recalculandoRuta || !enConduccion) return;

  const distancia = distanciaARutaMetros(posicionActual, coordenadasRuta);

  if (distancia > UMBRAL_SALIDA_RUTA_METROS) {
    recalculandoRuta = true;
    ponerEstado("Te has salido de la ruta. Recalculando...");
    hablar("Te has salido de la ruta. Recalculando");

    try {
      const inicio = L.latLng(posicionActual.lat, posicionActual.lng);

      // Se reconstruye una nueva ruta desde la posición actual hasta el destino guardado.
      await construirRuta(inicio, latLngDestinoActual);

      // Tras recalcular, los avisos vuelven a ser anunciables.
      avisos.forEach(a => {
        a.anunciado150 = false;
        a.anunciado50 = false;
      });

      refrescarVisibilidadAvisos();
      ponerEstado(`Ruta recalculada. Avisos en ruta: ${avisosEnRuta.length}`);
      notificarEstadoRutaCompartida("ruta_recalculada");
      anunciarNumeroAvisosRuta("Ruta recalculada");
      actualizarProgresoRutaGPS();
    } catch {
      ponerEstado("No se pudo recalcular la ruta");
    } finally {
      // Pase lo que pase, se libera el bloqueo de recálculo.
      recalculandoRuta = false;
    }
  }
}



// GESTIÓN DE AVISOS


// Añade un aviso recibido del servidor al mapa y a la lista local.
function agregarAvisoServidor(aviso) {
  // Si ya existe un aviso con el mismo ID, no se duplica.
  if (avisos.some(a => a.id === aviso.id)) return;

  const marker = L.marker([aviso.lat, aviso.lng], {
    icon: crearIconoHTML("marcador-aviso", "AVISO")
  });

  // Se configura un popup sencillo con mensaje y hora.
  marker.bindPopup(`
    <b>AVISO</b><br>
    ${aviso.message}<br>
    <small>${formatearHora(aviso.timestamp)}</small>
  `);

  // Se guarda el aviso localmente junto con datos auxiliares para anuncios.
  avisos.push({
    ...aviso,
    marker,
    anunciado150: false,
    anunciado50: false
  });

  refrescarVisibilidadAvisos();
  refrescarPanelMisAvisos();
  actualizarBarraCompacta();
}

// Elimina un aviso de la interfaz usando su ID.
function quitarAvisoUI(id) {
  const index = avisos.findIndex(a => a.id === id);

  // Si no se encuentra, no hay nada que quitar.
  if (index === -1) return false;

  const aviso = avisos[index];

  // Si su marcador estaba visible, se quita del mapa.
  if (mapa.hasLayer(aviso.marker)) mapa.removeLayer(aviso.marker);

  // Se elimina de la lista local.
  avisos.splice(index, 1);

  refrescarVisibilidadAvisos();
  refrescarPanelMisAvisos();
  actualizarBarraCompacta();
  return true;
}

// Envía al servidor un nuevo aviso creado por este cliente.
function enviarCreacionAviso(lat, lng, message) {
  socket.emit("warning:create", {
    lat,
    lng,
    // Se limita la longitud y se intenta estandarizar el motivo.
    message: mapearMotivoAviso(message).slice(0, 80)
  });
}

// Envía al servidor una petición de borrado de aviso.
function enviarBorradoAviso(id) {
  socket.emit("warning:delete", { id });
}

// Reconstruye el panel visual de "mis avisos".
function refrescarPanelMisAvisos() {
  // Primero se vacía el contenido actual.
  panelMisAvisosEl.innerHTML = "";

  // Se filtran solo los avisos creados por este cliente.
  const mios = avisos.filter(a => a.creatorClientId === idCliente);

  if (mios.length === 0) {
    panelMisAvisosEl.innerHTML = `<div class="sin-avisos">No tienes avisos guardados.</div>`;
    return;
  }

  mios.forEach(a => {
    const item = document.createElement("div");
    item.className = "item-aviso";

    const info = document.createElement("div");
    info.className = "info-aviso";
    info.innerHTML = `
      <div><b>${a.message}</b></div>
      <div>Ubicación: ${a.lat.toFixed(5)}, ${a.lng.toFixed(5)}</div>
      <div>Hora: ${formatearHora(a.timestamp)}</div>
    `;

    const borrar = document.createElement("button");
    borrar.className = "boton-borrar-aviso";
    borrar.textContent = "×";

    borrar.addEventListener("click", () => {
      enviarBorradoAviso(a.id);
      ponerEstado(`Solicitud de borrado enviada: ${a.message}`);
      programarEstadoConduccion();
    });

    item.appendChild(info);
    item.appendChild(borrar);
    panelMisAvisosEl.appendChild(item);
  });
}

// Devuelve solo los avisos que están suficientemente cerca de la ruta actual.
function obtenerAvisosEnRuta() {
  if (!coordenadasRuta.length) return [];

  return avisos.filter(a => {
    const d = distanciaARutaMetros({ lat: a.lat, lng: a.lng }, coordenadasRuta);
    return d <= DISTANCIA_AVISO_RUTA_METROS;
  });
}

// Muestra u oculta marcadores según si pertenecen a la ruta actual.
function refrescarVisibilidadAvisos() {
  const visibles = obtenerAvisosEnRuta();
  avisosEnRuta = visibles;

  avisos.forEach(a => {
    const enRuta = visibles.includes(a);

    if (enRuta) {
      if (!mapa.hasLayer(a.marker)) a.marker.addTo(mapa);
    } else {
      if (mapa.hasLayer(a.marker)) mapa.removeLayer(a.marker);
    }
  });

  actualizarBarraCompacta();
}

// Anuncia cuántos avisos hay en la ruta.
function anunciarNumeroAvisosRuta(prefijo = "Ruta creada") {
  const count = avisosEnRuta.length;

  if (count === 0) return hablar(`${prefijo}. No hay avisos en la ruta`);
  if (count === 1) return hablar(`${prefijo}. Hay 1 aviso en la ruta`);

  hablar(`${prefijo}. Hay ${count} avisos en la ruta`);
}

// Busca el aviso más razonable para borrar por voz.
function obtenerAvisoPasadoMasCercanoEnRuta() {
  if (!posicionActual || !avisosEnRuta.length || !coordenadasRuta.length) return null;

  const indiceCoche = buscarIndiceRutaMasCercano(posicionActual);
  let mejorAviso = null;
  let mejorScore = Infinity;

  for (const aviso of avisosEnRuta) {
    const puntoAviso = { lat: aviso.lat, lng: aviso.lng };
    const indiceAviso = buscarIndiceRutaMasCercano(puntoAviso);
    const distanciaCoche = distanciaHaversineMetros(posicionActual, puntoAviso);

    // Se considera aceptable si no está muy adelantado y no queda demasiado lejos.
    const detras = indiceAviso <= indiceCoche + 5;
    if (!detras) continue;
    if (distanciaCoche > DISTANCIA_MAX_BORRADO_ATRAS_METROS) continue;

    // Se penaliza si está algo adelantado respecto al coche.
    const penalizacion = Math.max(0, indiceAviso - indiceCoche) * 5;
    const score = distanciaCoche + penalizacion;

    if (score < mejorScore) {
      mejorScore = score;
      mejorAviso = aviso;
    }
  }

  return mejorAviso;
}

// Anuncia por voz avisos próximos al vehículo.
function anunciarAvisosProximos() {
  // Si falta posición, avisos o la app está hablando, no se anuncia nada.
  if (!posicionActual || !avisosEnRuta.length || hablando) return;

  const ahora = Date.now();

  // Se respeta un tiempo de enfriamiento entre anuncios.
  if (ahora - ultimoMomentoAviso < COOLDOWN_AVISOS_MS) return;

  const banda150 = [];
  const banda50 = [];

  for (const aviso of avisosEnRuta) {
    // No se anuncian los avisos creados por el propio usuario.
    if (aviso.creatorClientId === idCliente) continue;

    const distancia = distanciaHaversineMetros(posicionActual, { lat: aviso.lat, lng: aviso.lng });

    if (distancia <= DISTANCIA_SEGUNDO_AVISO_METROS && !aviso.anunciado50) {
      banda50.push({ aviso, distancia });
    } else if (distancia <= DISTANCIA_PRIMER_AVISO_METROS && !aviso.anunciado150) {
      banda150.push({ aviso, distancia });
    }
  }

  // Primero se da prioridad a los avisos de 50 metros.
  if (banda50.length > 0) {
    banda50.forEach(item => {
      // Al anunciar a 50, también se da por anunciado a 150.
      item.aviso.anunciado50 = true;
      item.aviso.anunciado150 = true;
    });

    const mensajes = banda50.map(item => item.aviso.message);
    ultimoMomentoAviso = ahora;

    if (banda50.length === 1) {
      hablar(`Atención. Aviso ${formatearDistanciaVoz(banda50[0].distancia)}. ${unirMensajesParaVoz(mensajes)}`);
    } else {
      hablar(`Atención. Hay ${banda50.length} avisos muy próximos en la ruta: ${unirMensajesParaVoz(mensajes)}`);
    }
    return;
  }

  // Si no hay avisos de 50 metros, se revisan los de 150.
  if (banda150.length > 0) {
    banda150.forEach(item => {
      item.aviso.anunciado150 = true;
    });

    const mensajes = banda150.map(item => item.aviso.message);
    ultimoMomentoAviso = ahora;

    if (banda150.length === 1) {
      hablar(`Atención. Aviso ${formatearDistanciaVoz(banda150[0].distancia)}. ${unirMensajesParaVoz(mensajes)}`);
    } else {
      hablar(`Atención. Hay ${banda150.length} avisos próximos en la ruta: ${unirMensajesParaVoz(mensajes)}`);
    }
  }
}



// FLUJOS DE VOZ DE AVISOS


// Inicia el flujo para crear un aviso por voz.
function iniciarFlujoAviso() {
  limpiarTemporizadorConduccion();

  // Sin posición actual no tiene sentido crear aviso geolocalizado.
  if (!posicionActual) {
    hablar("Todavía no tengo posición");
    return;
  }

  // Se guarda la posición exacta del momento en que se inicia el flujo.
  posicionPendienteAviso = { lat: posicionActual.lat, lng: posicionActual.lng };

  // Se pasa al estado donde se espera confirmación del usuario.
  ponerEstadoApp("confirmando_aviso");
  ponerEstado("Confirmando aviso...");
  hablar("¿Quieres poner un aviso? Responde sí o no");
}

// Pasa a la fase de pedir el motivo del aviso.
function pedirMotivoAviso() {
  limpiarTemporizadorConduccion();
  ponerEstadoApp("esperando_motivo");
  ponerEstado("Esperando motivo...");
  hablar("Di el motivo del aviso");
}

// Inicia el flujo de borrado por voz.
function iniciarFlujoBorrado() {
  limpiarTemporizadorConduccion();

  const avisoMasCercano = obtenerAvisoPasadoMasCercanoEnRuta();

  if (!avisoMasCercano) {
    hablar("No hay avisos recientes de tu ruta para borrar");
    return;
  }

  // Se guarda temporalmente el aviso candidato al borrado.
  avisoPendienteBorrado = avisoMasCercano;

  ponerEstadoApp("confirmando_borrado");
  ponerEstado(`Confirmando borrado de: ${avisoMasCercano.message}`);
  hablar(`¿Quieres borrar el aviso de ${avisoMasCercano.message}? Responde sí o no`);
}

// Interpreta el texto de voz según el estado actual del flujo.
function gestionarComandoVoz(texto) {
  // Si la app está hablando o el micro está desactivado, no se procesa.
  if (hablando || !privacidad.microfono || vozPrincipalBloqueadaPorEmergencia) return;

  // "cancelar" funciona como comando global desde cualquier estado.
  if (texto === "cancelar" || texto.includes("cancelar")) {
    resetearPendientes();
    hablar("Acción cancelada");
    programarEstadoConduccion();
    return;
  }

  // Estado normal, esperando un comando general.
  if (estadoApp === "esperando_comando") {
    if (texto === "borrar aviso" || texto.includes("borrar aviso")) {
      iniciarFlujoBorrado();
      return;
    }

    if (texto === "aviso" || texto.includes(" aviso")) {
      iniciarFlujoAviso();
    }
    return;
  }

  // Estado esperando confirmación para crear aviso.
  if (estadoApp === "confirmando_aviso") {
    if (esConfirmacion(texto)) return pedirMotivoAviso();

    if (esNegacion(texto)) {
      resetearPendientes();
      ponerEstado("Aviso cancelado");
      hablar("Vale, no añado ningún aviso", programarEstadoConduccion);
      return;
    }

    hablar("No te he entendido. Responde sí o no");
    return;
  }

  // Estado esperando el motivo del aviso.
  if (estadoApp === "esperando_motivo") {
    const motivo = texto.trim();

    if (motivo.length > 0) {
      enviarCreacionAviso(posicionPendienteAviso.lat, posicionPendienteAviso.lng, motivo);
      resetearPendientes();
      ponerEstado("Aviso enviado al servidor");
      hablar("He enviado el aviso", programarEstadoConduccion);
    } else {
      hablar("No he entendido el motivo");
    }
    return;
  }

  // Estado esperando confirmación de borrado.
  if (estadoApp === "confirmando_borrado") {
    if (esConfirmacion(texto)) {
      const mensaje = avisoPendienteBorrado.message;
      enviarBorradoAviso(avisoPendienteBorrado.id);
      resetearPendientes();
      ponerEstado(`Solicitud de borrado enviada: ${mensaje}`);
      hablar(`He pedido borrar el aviso de ${mensaje}`, programarEstadoConduccion);
      return;
    }

    if (esNegacion(texto)) {
      resetearPendientes();
      ponerEstado("Borrado cancelado");
      hablar("Vale, no borro ningún aviso", programarEstadoConduccion);
      return;
    }

    hablar("No te he entendido. Responde sí o no");
  }
}



// EVENTOS DE SOCKET.IO


// Al conectarse al servidor, se guarda el id del cliente.
socket.on("connect", () => {
  idCliente = socket.id;
  refrescarPanelMisAvisos();
});

// El servidor envía todos los avisos existentes al iniciar un cliente.
socket.on("warnings:init", (serverWarnings) => {
  // Primero se limpian marcadores viejos si los hubiera.
  avisos.forEach(a => {
    if (mapa.hasLayer(a.marker)) mapa.removeLayer(a.marker);
  });

  avisos = [];

  // Luego se reconstruyen los avisos locales con la lista enviada por servidor.
  serverWarnings.forEach(agregarAvisoServidor);
});

// Cuando otro cliente o este mismo crea un aviso, el servidor lo reenvía aquí.
socket.on("warning:created", (warning) => {
  agregarAvisoServidor(warning);

  // Si el creador fui yo, se muestra confirmación al usuario.
  if (warning.creatorClientId === idCliente) {
    ponerEstado(`Aviso compartido: ${warning.message}`);
    programarEstadoConduccion();
  }
});

// Cuando el servidor avisa de un borrado, se quita de la interfaz.
socket.on("warning:deleted", ({ id }) => {
  quitarAvisoUI(id);
});



// SINCRONIZACIÓN DE ESTADO CON EL MÓDULO DE FRENAZO

// El módulo de frenazo avisa aquí cuando cambia su estado real.
window.addEventListener("frenazo:estado", (evento) => {
  const detalle = evento.detail || {};

  if (typeof detalle.encendido === "boolean") {
    privacidad.frenazoEncendido = detalle.encendido;
  }

  if (typeof detalle.contactoEmergenciaNombre === "string") {
    privacidad.contactoEmergenciaNombre = detalle.contactoEmergenciaNombre;
  }

  if (typeof detalle.contactoEmergenciaEmail === "string") {
    privacidad.contactoEmergenciaEmail = detalle.contactoEmergenciaEmail;
  }

  guardarPrivacidad();
  aplicarPrivacidadEnUI();

  if (detalle.mensaje) ponerEstado(detalle.mensaje);
});



// EVENTOS DE INTERFAZ


// Abrir ayuda.
botonAyudaEl.addEventListener("click", () => {
  panelAyudaEl.style.display = "block";
});

// Cerrar ayuda.
cerrarAyudaEl.addEventListener("click", () => {
  panelAyudaEl.style.display = "none";
});

// Abrir privacidad.
botonPrivacidadEl.addEventListener("click", () => {
  panelPrivacidadEl.style.display = "block";
});

// Cerrar privacidad.
cerrarPrivacidadEl.addEventListener("click", () => {
  panelPrivacidadEl.style.display = "none";
});

// Abrir el visor del detector solo si está permitido y encendido.
verSomnolenciaEl.addEventListener("click", () => {
  if (!privacidad.camara) {
    ponerEstado("Activa la cámara en Privacidad para usar somnolencia");
    panelPrivacidadEl.style.display = "none";
    return;
  }

  if (!privacidad.somnolenciaEncendida) {
    ponerEstado("Primero enciende el detector");
    panelPrivacidadEl.style.display = "none";
    return;
  }

  modalSomnolenciaEl.classList.add("abierto");
  panelPrivacidadEl.style.display = "none";

  // Se lanza evento al módulo de somnolencia para que reajuste canvas y visor.
  window.dispatchEvent(new CustomEvent("somnolencia:mostrar"));
});

// Encender detector.
encenderSomnolenciaEl.addEventListener("click", () => {
  encenderDetectorSomnolencia();
  panelPrivacidadEl.style.display = "none";
});

// Apagar detector.
apagarSomnolenciaEl.addEventListener("click", () => {
  apagarDetectorSomnolencia();
  panelPrivacidadEl.style.display = "none";
});

// Encender detector de frenazo.
encenderFrenazoEl.addEventListener("click", () => {
  encenderDetectorFrenazo();
  panelPrivacidadEl.style.display = "none";
});

// Apagar detector de frenazo.
apagarFrenazoEl.addEventListener("click", () => {
  apagarDetectorFrenazo();
  panelPrivacidadEl.style.display = "none";
});

// Cerrar solo la ventana visual del detector.
cerrarModalSomnolenciaEl.addEventListener("click", () => {
  modalSomnolenciaEl.classList.remove("abierto");
  window.dispatchEvent(new CustomEvent("somnolencia:ocultar"));
});

// Alternar pantalla completa dentro del detector.
pantallaCompletaSomnolenciaEl.addEventListener("click", async () => {
  try {
    const ventana = modalSomnolenciaEl.querySelector(".ventanaSomnolencia");
    if (!ventana) return;

    if (!document.fullscreenElement) {
      await ventana.requestFullscreen();
      pantallaCompletaSomnolenciaEl.textContent = "⛶";
    } else {
      await document.exitFullscreen();
      pantallaCompletaSomnolenciaEl.textContent = "⛶";
    }
  } catch (error) {
    console.warn("No se pudo activar el fullscreen del detector:", error);
  }
});

// Si se sale de fullscreen por cualquier motivo, se restaura el icono del detector.
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) pantallaCompletaSomnolenciaEl.textContent = "⛶";
});

// Cambio manual del permiso de micrófono.
usarMicrofonoEl.addEventListener("change", async () => {
  if (usarMicrofonoEl.checked) {
    const granted = await pedirPermisoMicrofono();
    ponerPermisoMicrofono(granted);
    if (!granted) ponerEstadoSensores("Micrófono denegado o desactivado");
  } else {
    ponerPermisoMicrofono(false);
  }
});

// Cambio manual del permiso de ubicación.
usarUbicacionEl.addEventListener("change", async () => {
  if (usarUbicacionEl.checked) {
    const granted = await pedirPermisoUbicacion();
    ponerPermisoUbicacion(granted);
    if (!granted) ponerEstadoSensores("Ubicación denegada o desactivada");
  } else {
    ponerPermisoUbicacion(false);
  }
});

// Cambio manual del permiso de cámara.
usarCamaraEl.addEventListener("change", async () => {
  if (usarCamaraEl.checked) {
    const granted = await pedirPermisoCamara();
    ponerPermisoCamara(granted);
    if (!granted) ponerEstadoSensores("Cámara denegada o desactivada");
  } else {
    ponerPermisoCamara(false);
  }
});

// Botones principales de navegación.
botonCrearRutaEl.addEventListener("click", crearRutaDesdeInput);
botonEmpezarRutaEl.addEventListener("click", empezarConduccion);
botonSalirConduccionEl.addEventListener("click", salirModoConduccion);

// Abrir o cerrar el panel de avisos propios.
botonMisAvisosEl.addEventListener("click", () => {
  panelMisAvisosEl.classList.toggle("oculto");
  refrescarPanelMisAvisos();
});



// SALIR DE CONDUCCIÓN


// Finaliza el modo conducción y restablece la vista normal.
function salirModoConduccion() {
  detenerConduccion(true);
  destinoInputEl.value = "";
  cerrarPaneles();

  // Si hay posición actual, se recentra el mapa con un zoom más general.
  if (posicionActual) {
    mapa.setView([posicionActual.lat, posicionActual.lng], 14, { animate: true });
  }

  ponerEstado("Modo conducción finalizado. Puedes crear otra ruta");
}



// INICIALIZACIÓN GENERAL


// Función principal de arranque de toda la aplicación.
function iniciarApp() {
  // Se carga configuración previa del usuario.
  cargarPrivacidad();

  // El detector de frenazo siempre arranca apagado al entrar en la app.
  privacidad.frenazoEncendido = false;
  guardarPrivacidadParcial({ frenazoEncendido: false });

  // Se crea el mapa y sus capas base.
  iniciarMapa();

  // Se sincronizan las casillas con la configuración guardada.
  aplicarPrivacidadEnUI();

  // Se crea una sola vez el reconocimiento de voz.
  reconocimiento = crearReconocimiento();

  if (privacidad.inicializado) {
    // Si ya hubo configuración previa, se restauran automáticamente servicios permitidos.
    if (privacidad.microfono) iniciarReconocimientoConRetardo(150);
    if (privacidad.ubicacion) iniciarWatchGPS();

    // Si cámara y detector estaban activos, se vuelve a encender la somnolencia.
    if (privacidad.camara && privacidad.somnolenciaEncendida) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("somnolencia:activar"));
      }, 0);
    }

    // Mensaje inicial según el estado de permisos.
    if (!privacidad.ubicacion && !privacidad.microfono && !privacidad.camara) {
      ponerEstado("Activa permisos desde Privacidad para usar el sistema");
    } else if (!privacidad.ubicacion) {
      ponerEstado("Activa la ubicación para crear una ruta");
    } else {
      ponerEstado("Sistema listo. Escribe un destino para crear una ruta");
    }

  } else {
    // Si es la primera vez, se inicia el flujo inicial de permisos.
    prepararSolicitudPermisosIniciales();
  }

  actualizarBarraCompacta();
  notificarEstadoRutaCompartida("inicio_app");
}

// API minima expuesta para la funcionalidad de compartir ruta.
window.apiRutaCompartida = {
  // Devuelve una instantánea del estado actual de la ruta principal.
  obtenerEstadoActual: obtenerEstadoRutaCompartida,
  // Permite reutilizar la voz principal de la app sin duplicar sintetizadores.
  hablarTexto: hablar,
  // Permite cortar solo la locucion actual y meter una alerta urgente.
  interrumpirYHablarUrgente,
  // Permite reanudar la cola normal despues de una interrupcion.
  reanudarLocucionesNormales,
  // Permite escribir un mensaje urgente visible.
  ponerEstadoUrgente,
  // Informa de si habia una locucion activa.
  hayLocucionEnCurso,
  // Pausa la voz normal cuando el frenazo necesita escuchar un si/no propio.
  bloquearVozPrincipalPorEmergencia,
  // Reactiva la voz normal cuando termina la emergencia.
  desbloquearVozPrincipalPorEmergencia,
  // Permite que una emergencia use el reconocimiento principal sin crear otro micro.
  registrarGestorVozUrgente,
  // Quita el gestor urgente cuando termina la emergencia.
  limpiarGestorVozUrgente
};

// Arranca la app al cargar el script.
iniciarApp();
