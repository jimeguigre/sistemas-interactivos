// Referencia al elemento donde se muestra el estado general de la app
const estadoGeneralEl = document.getElementById("estadoGeneral");

// Referencia al input donde el usuario escribe el destino
const destinoInputEl = document.getElementById("destinoInput");

// Botón para calcular una nueva ruta hacia el destino escrito
const botonCrearRutaEl = document.getElementById("botonCrearRuta");

// Botón para entrar en modo conducción una vez creada la ruta
const botonEmpezarRutaEl = document.getElementById("botonEmpezarRuta");

// Botón para salir del modo conducción y volver al estado normal
const botonSalirConduccionEl = document.getElementById("botonSalirConduccion");

// Barra principal con input y botones de navegación
const barraHerramientasEl = document.getElementById("barraHerramientas");

// Barra compacta que sustituye a la barra normal durante la conducción
const barraCompactaEl = document.getElementById("barraCompacta");

// Zona donde se informa del estado de micrófono, GPS y cámara
const estadoSensoresEl = document.getElementById("estadoSensores");

// Botón para abrir el panel de ayuda
const botonAyudaEl = document.getElementById("botonAyuda");

// Panel flotante con instrucciones de uso
const panelAyudaEl = document.getElementById("panelAyuda");

// Botón para cerrar el panel de ayuda
const cerrarAyudaEl = document.getElementById("cerrarAyuda");

// Botón para abrir el panel de privacidad y control
const botonPrivacidadEl = document.getElementById("botonPrivacidad");

// Panel donde se configuran permisos y somnolencia
const panelPrivacidadEl = document.getElementById("panelPrivacidad");

// Botón para cerrar el panel de privacidad
const cerrarPrivacidadEl = document.getElementById("cerrarPrivacidad");

// Casilla para activar o desactivar el uso del micrófono
const usarMicrofonoEl = document.getElementById("usarMicrofono");

// Casilla para activar o desactivar el uso de la ubicación
const usarUbicacionEl = document.getElementById("usarUbicacion");

// Casilla para activar o desactivar el permiso de cámara
const usarCamaraEl = document.getElementById("usarCamara");

// Botón para abrir la ventana del detector de somnolencia
const verSomnolenciaEl = document.getElementById("verSomnolencia");

// Botón para encender realmente el detector de somnolencia
const encenderSomnolenciaEl = document.getElementById("encenderSomnolencia");

// Botón para apagar completamente el detector de somnolencia
const apagarSomnolenciaEl = document.getElementById("apagarSomnolencia");

// Botón que abre el panel con los avisos creados por el usuario
const botonMisAvisosEl = document.getElementById("botonMisAvisos");

// Panel donde se listan los avisos propios del usuario
const panelMisAvisosEl = document.getElementById("panelMisAvisos");

// Modal principal del detector de somnolencia
const modalSomnolenciaEl = document.getElementById("modalSomnolencia");

// Botón para cerrar solo la ventana visual del detector
const cerrarModalSomnolenciaEl = document.getElementById("cerrarModalSomnolencia");

// Botón para poner la ventana del detector a pantalla completa
const pantallaCompletaSomnolenciaEl = document.getElementById("pantallaCompletaSomnolencia");

// Clave usada para guardar la configuración en localStorage
const CLAVE_PRIVACIDAD = "avisos_nav_privacidad_v10";

// Distancia máxima para considerar que un aviso pertenece a la ruta actual
const DISTANCIA_AVISO_RUTA_METROS = 150;

// Distancia a la que se hace el primer aviso por voz
const DISTANCIA_PRIMER_AVISO_METROS = 150;

// Distancia a la que se hace un segundo aviso más urgente
const DISTANCIA_SEGUNDO_AVISO_METROS = 50;

// Distancia máxima hacia atrás para permitir borrar un aviso cercano ya pasado
const DISTANCIA_MAX_BORRADO_ATRAS_METROS = 500;

// Distancia máxima de separación respecto a la ruta antes de recalcular
const UMBRAL_SALIDA_RUTA_METROS = 80;

// Tiempo máximo de espera para obtener una posición GPS
const GPS_TIMEOUT_MS = 15000;

// Edad máxima permitida de una posición GPS almacenada en caché
const GPS_MAXIMUM_AGE_MS = 0;

// Nivel de zoom usado al seguir el vehículo durante conducción
const ZOOM_CONDUCCION = 18;

// Tiempo mínimo entre anuncios consecutivos de avisos
const COOLDOWN_AVISOS_MS = 6000;

// Tiempo mínimo entre comandos de voz para evitar repeticiones
const COOLDOWN_COMANDOS_MS = 900;

// Tiempo tras el cual se vuelve a mostrar el estado normal de conducción
const RETARDO_ESTADO_CONDUCCION_MS = 5000;

// Conexión en tiempo real con el servidor mediante Socket.IO
const socket = io();

// Objeto que representa el estado de permisos y ajustes del usuario
const privacidad = {
  // Indica si el usuario permite usar el micrófono
  microfono: false,
  // Indica si el usuario permite usar la ubicación
  ubicacion: false,
  // Indica si el usuario permite usar la cámara
  camara: false,
  // Indica si el detector de somnolencia está encendido
  somnolenciaEncendida: false,
  // Indica si ya se hizo la petición inicial de permisos
  inicializado: false
};

// ID del cliente asignado por Socket.IO
let idCliente = null;

// Instancia principal del mapa Leaflet
let mapa;

// Control de rutas de Leaflet Routing Machine
let controlRuta = null;

// Array con todos los puntos de la ruta calculada
let coordenadasRuta = [];

// Última posición GPS conocida del usuario
let posicionActual = null;

// Texto del destino actual escrito por el usuario
let textoDestinoActual = "";

// Coordenadas reales del destino una vez geocodificado
let latLngDestinoActual = null;

// Marcador del usuario en el mapa
let marcadorUsuario = null;

// Línea azul de la parte de ruta pendiente
let lineaRutaPendiente = null;

// Línea naranja de la parte de ruta ya recorrida
let lineaRutaRecorrida = null;

// Bandera que evita recalcular varias veces a la vez
let recalculandoRuta = false;

// Indica si la app está actualmente en modo conducción
let enConduccion = false;

// Indica si el mapa debe seguir automáticamente al vehículo
let seguirVehiculo = false;

// Último índice de la ruta que el usuario ya ha sobrepasado
let indiceMaxRecorrido = 0;

// Lista completa de avisos existentes en el cliente
let avisos = [];

// Lista filtrada de avisos que pertenecen a la ruta actual
let avisosEnRuta = [];

// Marca temporal del último aviso hablado
let ultimoMomentoAviso = 0;

// Objeto del reconocimiento de voz del navegador
let reconocimiento = null;

// Indica si el reconocimiento de voz está activo en este momento
let reconocimientoActivo = false;

// Indica si la app está hablando con síntesis de voz
let hablando = false;

// Temporizador para reiniciar el reconocimiento de voz
let temporizadorReinicioMicro = null;

// Marca temporal del último comando de voz procesado
let ultimoMomentoComando = 0;

// Estado interno del flujo de voz de la aplicación
let estadoApp = "esperando_comando";

// Posición guardada temporalmente cuando el usuario va a crear un aviso
let posicionPendienteAviso = null;

// Aviso que está pendiente de confirmar para borrado
let avisoPendienteBorrado = null;

// Temporizador para restaurar el texto de estado de conducción
let temporizadorEstadoConduccion = null;

// ID devuelto por geolocation.watchPosition
let watchIdGPS = null;

// Indica si ya se obtuvo la primera posición GPS válida
let primerFixGPS = false;

// Escribe un mensaje en la zona de estado general
function ponerEstado(texto) {
  estadoGeneralEl.textContent = texto;
}

// Escribe un mensaje en la zona de estado de sensores
function ponerEstadoSensores(texto) {
  estadoSensoresEl.textContent = texto;
}

// Actualiza el estado lógico del flujo conversacional de la app
function ponerEstadoApp(nuevoEstado) {
  estadoApp = nuevoEstado;
}

// Borra el temporizador que restaura el estado de conducción
function limpiarTemporizadorConduccion() {
  clearTimeout(temporizadorEstadoConduccion);
  temporizadorEstadoConduccion = null;
}

// Programa que el estado vuelva a "En conducción..." tras unos segundos
function programarEstadoConduccion(retardo = RETARDO_ESTADO_CONDUCCION_MS) {
  limpiarTemporizadorConduccion();

  // Si no estamos conduciendo no hace falta restaurar ese estado
  if (!enConduccion) return;

  temporizadorEstadoConduccion = setTimeout(() => {
    if (enConduccion) ponerEstado("En conducción...");
  }, retardo);
}

// Limpia variables temporales usadas en los flujos de crear o borrar avisos
function resetearPendientes() {
  posicionPendienteAviso = null;
  avisoPendienteBorrado = null;
  ponerEstadoApp("esperando_comando");
}

// Cierra todos los paneles flotantes abiertos en la interfaz
function cerrarPaneles() {
  panelAyudaEl.style.display = "none";
  panelPrivacidadEl.style.display = "none";
  panelMisAvisosEl.classList.add("oculto");
}

// Cambia entre barra normal y barra compacta según si estamos conduciendo
function actualizarBarraCompacta() {
  if (!enConduccion) {
    // Fuera de conducción se muestra la barra normal
    barraCompactaEl.style.display = "none";
    barraHerramientasEl.classList.remove("oculto");
    botonSalirConduccionEl.classList.add("oculto");
    actualizarResumenSensores();
    return;
  }

  // En conducción se oculta la barra grande y se muestra una más compacta
  barraHerramientasEl.classList.add("oculto");
  barraCompactaEl.style.display = "block";
  botonSalirConduccionEl.classList.remove("oculto");

  // Se informa del destino actual y del número de avisos en ruta
  const destino = textoDestinoActual || "Sin destino";
  barraCompactaEl.textContent = `Destino: ${destino} | Avisos en ruta: ${avisosEnRuta.length}`;
  actualizarResumenSensores();
}

// Convierte una marca temporal en una hora legible para mostrar en la interfaz
function formatearHora(ts) {
  return new Date(ts).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

// Normaliza texto para comparaciones de voz ignorando mayúsculas y tildes
function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Intenta mapear el texto hablado a categorías de aviso conocidas
function mapearMotivoAviso(texto) {
  const limpio = normalizarTexto(texto);

  if (limpio.includes("accidente")) return "Accidente";
  if (limpio.includes("bache")) return "Bache";
  if (limpio.includes("retencion") || limpio.includes("atasco")) return "Retención";
  if (limpio.includes("obras")) return "Obras";
  if (limpio.includes("niebla")) return "Niebla";
  if (limpio.includes("lluvia")) return "Lluvia";
  if (limpio.includes("radar")) return "Radar";
  if (limpio.includes("policia")) return "Policía";
  if (limpio.includes("peligro")) return "Peligro";

  // Si no encaja en ninguna categoría, se usa el texto tal cual
  return texto.trim() || "AVISO";
}

// Une varios mensajes en una frase natural para síntesis de voz
function unirMensajesParaVoz(mensajes) {
  if (mensajes.length === 0) return "";
  if (mensajes.length === 1) return mensajes[0];
  if (mensajes.length === 2) return `${mensajes[0]} y ${mensajes[1]}`;
  return `${mensajes.slice(0, -1).join(", ")} y ${mensajes[mensajes.length - 1]}`;
}

// Convierte una distancia numérica en una frase más natural para voz
function formatearDistanciaVoz(distancia) {
  const redondeada = Math.round(distancia / 10) * 10;
  if (redondeada < 20) return "muy cerca";
  return `a ${redondeada} metros`;
}

// Crea un icono HTML personalizado para usarlo como marcador Leaflet
function crearIconoHTML(clase, texto) {
  return L.divIcon({
    className: "",
    html: `<div class="${clase}">${texto}</div>`,
    iconSize: null
  });
}

// Comprueba si un texto hablado equivale a una confirmación
function esConfirmacion(texto) {
  return /^(si|sí|vale|ok|de acuerdo|confirmo)$/.test(normalizarTexto(texto));
}

// Comprueba si un texto hablado equivale a una negación o cancelación
function esNegacion(texto) {
  return /^(no|cancelar|cancela|olvida)$/.test(normalizarTexto(texto));
}

// Carga desde localStorage la configuración de privacidad guardada anteriormente
function cargarPrivacidad() {
  const guardado = localStorage.getItem(CLAVE_PRIVACIDAD);
  if (!guardado) return;

  try {
    const datos = JSON.parse(guardado);
    if (typeof datos.microfono === "boolean") privacidad.microfono = datos.microfono;
    if (typeof datos.ubicacion === "boolean") privacidad.ubicacion = datos.ubicacion;
    if (typeof datos.camara === "boolean") privacidad.camara = datos.camara;
    if (typeof datos.somnolenciaEncendida === "boolean") privacidad.somnolenciaEncendida = datos.somnolenciaEncendida;
    if (typeof datos.inicializado === "boolean") privacidad.inicializado = datos.inicializado;
  } catch {
    // Si el JSON estuviera corrupto, se restablecen valores seguros por defecto
    privacidad.microfono = false;
    privacidad.ubicacion = false;
    privacidad.camara = false;
    privacidad.somnolenciaEncendida = false;
    privacidad.inicializado = false;
  }
}

// Guarda la configuración actual de privacidad en localStorage
function guardarPrivacidad() {
  localStorage.setItem(CLAVE_PRIVACIDAD, JSON.stringify(privacidad));
}

// Sincroniza las casillas del panel con el estado guardado en memoria
function aplicarPrivacidadEnUI() {
  usarMicrofonoEl.checked = privacidad.microfono;
  usarUbicacionEl.checked = privacidad.ubicacion;
  usarCamaraEl.checked = privacidad.camara;
  actualizarResumenSensores();
}

// Muestra un resumen textual de permisos y sensores activos
function actualizarResumenSensores() {
  // En conducción se oculta para dejar más espacio al mapa
  if (enConduccion) {
    estadoSensoresEl.style.display = "none";
    return;
  }

  // Fuera de conducción sí se vuelve a mostrar
  estadoSensoresEl.style.display = "block";

  const partes = [];
  partes.push(privacidad.microfono ? "Micrófono activo" : "Micrófono desactivado");
  partes.push(
    privacidad.ubicacion
      ? (enConduccion ? "GPS en uso" : "GPS disponible")
      : "Ubicación desactivada"
  );

  if (!privacidad.camara) {
    partes.push("Cámara desactivada");
  } else if (privacidad.somnolenciaEncendida) {
    partes.push("Somnolencia encendida");
  } else {
    partes.push("Somnolencia apagada");
  }

  ponerEstadoSensores(partes.join(" | "));
}

// Pide permiso de micrófono y devuelve true o false según el resultado
async function pedirPermisoMicrofono() {
  if (!navigator.mediaDevices?.getUserMedia) return false;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch {
    return false;
  }
}

// Pide permiso de ubicación usando una posición puntual
function pedirPermisoUbicacion() {
  if (!("geolocation" in navigator)) return Promise.resolve(false);

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve(true),
      () => resolve(false),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}

// Pide permiso de cámara y lo libera inmediatamente tras comprobarlo
async function pedirPermisoCamara() {
  if (!navigator.mediaDevices?.getUserMedia) return false;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "user" } },
      audio: false
    });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch {
    return false;
  }
}

// Activa o desactiva el micrófono y actualiza estado, guardado e interfaz
function ponerPermisoMicrofono(valor) {
  privacidad.microfono = valor;
  usarMicrofonoEl.checked = valor;
  guardarPrivacidad();

  if (!valor) {
    pararReconocimiento();
  } else {
    iniciarReconocimientoConRetardo(150);
  }

  actualizarResumenSensores();
}

// Activa o desactiva ubicación y reacciona según el nuevo estado
function ponerPermisoUbicacion(valor) {
  privacidad.ubicacion = valor;
  usarUbicacionEl.checked = valor;
  guardarPrivacidad();

  if (!valor) {
    // Si se quita ubicación se deja de escuchar el GPS
    pararWatchGPS();
    // Si estaba conduciendo, la conducción se termina porque depende del GPS
    if (enConduccion) salirModoConduccion();
  } else {
    iniciarWatchGPS();
  }

  actualizarResumenSensores();
}

// Activa o desactiva cámara y detiene somnolencia si se pierde el permiso
function ponerPermisoCamara(valor) {
  privacidad.camara = valor;
  usarCamaraEl.checked = valor;

  if (!valor) {
    // Sin cámara no puede seguir activo el detector
    privacidad.somnolenciaEncendida = false;
    modalSomnolenciaEl.classList.remove("abierto");
    window.dispatchEvent(new CustomEvent("somnolencia:detener"));
  }

  guardarPrivacidad();
  actualizarResumenSensores();
}

// Pide todos los permisos la primera vez que entra el usuario en la app
async function pedirPermisosInicialesSiHaceFalta() {
  if (privacidad.inicializado) return;

  // Se limpian visualmente las casillas antes de pedir permisos
  usarMicrofonoEl.checked = false;
  usarUbicacionEl.checked = false;
  usarCamaraEl.checked = false;

  ponerEstado("Solicitando permisos iniciales...");

  // Se pide micrófono y se guarda el resultado
  const okMicro = await pedirPermisoMicrofono();
  privacidad.microfono = okMicro;
  usarMicrofonoEl.checked = okMicro;

  // Se pide ubicación y se guarda el resultado
  const okUbicacion = await pedirPermisoUbicacion();
  privacidad.ubicacion = okUbicacion;
  usarUbicacionEl.checked = okUbicacion;

  // Se pide cámara y se guarda el resultado
  const okCamara = await pedirPermisoCamara();
  privacidad.camara = okCamara;
  usarCamaraEl.checked = okCamara;

  // El detector empieza apagado aunque la cámara esté permitida
  privacidad.somnolenciaEncendida = false;

  // Marcamos que la configuración inicial ya fue realizada
  privacidad.inicializado = true;
  guardarPrivacidad();
  aplicarPrivacidadEnUI();

  // Si hay permisos, se activan los servicios correspondientes
  if (okMicro) iniciarReconocimientoConRetardo(150);
  if (okUbicacion) iniciarWatchGPS();

  ponerEstado("Permisos iniciales revisados. Puedes cambiarlos en Privacidad");
}

// Enciende el detector de somnolencia si la cámara está permitida
function encenderDetectorSomnolencia() {
  if (!privacidad.camara) {
    ponerEstado("Activa la cámara en Privacidad antes de encender somnolencia");
    return;
  }

  privacidad.somnolenciaEncendida = true;
  guardarPrivacidad();
  window.dispatchEvent(new CustomEvent("somnolencia:activar"));
  actualizarResumenSensores();
  ponerEstado("Detector de somnolencia encendido");
}

// Apaga completamente el detector y cierra su ventana si estaba abierta
function apagarDetectorSomnolencia() {
  privacidad.somnolenciaEncendida = false;
  guardarPrivacidad();
  modalSomnolenciaEl.classList.remove("abierto");
  window.dispatchEvent(new CustomEvent("somnolencia:detener"));
  actualizarResumenSensores();
  ponerEstado("Detector de somnolencia apagado");
}

// Hace que la aplicación hable usando síntesis de voz y pause el reconocimiento mientras habla
function hablar(texto, callback = null) {
  hablando = true;
  pararReconocimiento();
  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(texto);
  utterance.lang = "es-ES";
  utterance.rate = 1;

  utterance.onend = () => {
    // Al terminar de hablar se reactiva el reconocimiento si sigue permitido
    hablando = false;
    actualizarResumenSensores();
    iniciarReconocimientoConRetardo(120);
    if (callback) callback();
  };

  utterance.onerror = () => {
    // Si hay error al hablar, se intenta volver al estado normal igualmente
    hablando = false;
    actualizarResumenSensores();
    iniciarReconocimientoConRetardo(120);
    if (callback) callback();
  };

  speechSynthesis.speak(utterance);
}

// Crea y configura el reconocimiento de voz del navegador
function crearReconocimiento() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  // Si el navegador no soporta la API, se informa al usuario
  if (!SR) {
    ponerEstadoSensores("Navegador sin reconocimiento de voz");
    return null;
  }

  const rec = new SR();
  rec.lang = "es-ES";
  rec.continuous = true;
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  rec.onstart = () => {
    reconocimientoActivo = true;
    actualizarResumenSensores();
  };

  rec.onresult = (event) => {
    // No se procesa voz si la app está hablando o si el micro está desactivado
    if (hablando || !privacidad.microfono) return;

    const ahora = Date.now();
    // Evita procesar varios comandos casi simultáneos
    if (ahora - ultimoMomentoComando < COOLDOWN_COMANDOS_MS) return;

    const ultimo = event.results[event.results.length - 1];
    const texto = normalizarTexto(ultimo[0].transcript);

    ultimoMomentoComando = ahora;
    gestionarComandoVoz(texto);
  };

  rec.onerror = (event) => {
    if (event.error === "not-allowed") {
      ponerPermisoMicrofono(false);
      ponerEstadoSensores("Activa permisos de micrófono");
      return;
    }

    if (event.error === "audio-capture") {
      ponerPermisoMicrofono(false);
      ponerEstadoSensores("No se detecta micrófono");
      return;
    }

    if (event.error === "network") {
      ponerEstadoSensores("Reintentando micrófono...");
      iniciarReconocimientoConRetardo(300);
      return;
    }

    if (event.error === "no-speech" || event.error === "aborted") return;

    ponerEstadoSensores("Error de micrófono");
    iniciarReconocimientoConRetardo(400);
  };

  rec.onend = () => {
    reconocimientoActivo = false;
    // Si no está hablando y el micro sigue activo, se relanza automáticamente
    if (!hablando && privacidad.microfono) iniciarReconocimientoConRetardo(150);
  };

  return rec;
}

// Inicia el reconocimiento de voz si las condiciones son correctas
function iniciarReconocimiento() {
  if (!privacidad.microfono) {
    actualizarResumenSensores();
    return;
  }

  if (!reconocimiento || reconocimientoActivo || hablando) return;

  try {
    reconocimiento.start();
  } catch {}
}

// Detiene el reconocimiento de voz si estaba activo
function pararReconocimiento() {
  clearTimeout(temporizadorReinicioMicro);

  if (reconocimiento && reconocimientoActivo) {
    try {
      reconocimiento.stop();
    } catch {}
  }
}

// Programa el arranque del reconocimiento tras un pequeño retardo
function iniciarReconocimientoConRetardo(ms = 150) {
  clearTimeout(temporizadorReinicioMicro);
  temporizadorReinicioMicro = setTimeout(iniciarReconocimiento, ms);
}

// Detiene el seguimiento continuo de GPS
function pararWatchGPS() {
  if (watchIdGPS !== null) {
    navigator.geolocation.clearWatch(watchIdGPS);
    watchIdGPS = null;
  }
  primerFixGPS = false;
}

// Inicia el seguimiento continuo de GPS con alta precisión
function iniciarWatchGPS() {
  if (!privacidad.ubicacion) {
    actualizarResumenSensores();
    return;
  }

  if (!("geolocation" in navigator)) {
    ponerEstadoSensores("El navegador no soporta ubicación");
    return;
  }

  pararWatchGPS();
  ponerEstadoSensores("Buscando señal GPS...");

  watchIdGPS = navigator.geolocation.watchPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const accuracy = position.coords.accuracy;

      posicionActual = { lat, lng, accuracy };
      actualizarPosicionUsuario(lat, lng);

      // Solo la primera vez se informa de que el GPS ya está listo
      if (!primerFixGPS) {
        primerFixGPS = true;
        ponerEstado(
          accuracy <= 100
            ? "GPS activo. Puedes crear la ruta o empezar a conducir"
            : `GPS activo, pero precisión limitada (${Math.round(accuracy)} m)`
        );
      }

      actualizarResumenSensores();

      // Durante conducción la nueva posición actualiza ruta, avisos y recálculo
      if (enConduccion) {
        actualizarProgresoRutaGPS();
        anunciarAvisosProximos();
        comprobarSalidaDeRutaYRecalcular();
      }
    },
    (error) => {
      switch (error.code) {
        case error.PERMISSION_DENIED:
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

// Inicializa el mapa Leaflet y las capas necesarias
function iniciarMapa() {
  mapa = L.map("mapa").setView([40.4168, -3.7038], 14);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(mapa);

  // Línea azul que representa la parte aún no recorrida
  lineaRutaPendiente = L.polyline([], {
    color: "#2563eb",
    weight: 7,
    opacity: 0.95
  }).addTo(mapa);

  // Línea naranja que representa la parte ya recorrida
  lineaRutaRecorrida = L.polyline([], {
    color: "#f97316",
    weight: 7,
    opacity: 1
  }).addTo(mapa);

  // Se coloca una posición inicial por defecto hasta recibir GPS real
  actualizarPosicionUsuario(40.4168, -3.7038);
}

// Coloca o actualiza el marcador del usuario en el mapa
function actualizarPosicionUsuario(lat, lng) {
  const latlng = L.latLng(lat, lng);

  if (!marcadorUsuario) {
    marcadorUsuario = L.marker(latlng, {
      icon: crearIconoHTML("marcador-usuario", "TÚ")
    }).addTo(mapa).bindPopup("Tu posición");
  } else {
    marcadorUsuario.setLatLng(latlng);
  }

  // Si el modo seguir vehículo está activo, el mapa se centra en la posición actual
  if (seguirVehiculo) mapa.setView(latlng, ZOOM_CONDUCCION, { animate: true });
}

// Borra visualmente las dos líneas que representan la ruta
function resetearLineasRuta() {
  indiceMaxRecorrido = 0;
  lineaRutaPendiente.setLatLngs([]);
  lineaRutaRecorrida.setLatLngs([]);
}

// Elimina la ruta actual y limpia variables asociadas
function limpiarRuta() {
  coordenadasRuta = [];
  textoDestinoActual = "";
  latLngDestinoActual = null;

  if (controlRuta) {
    mapa.removeControl(controlRuta);
    controlRuta = null;
  }

  resetearLineasRuta();
  refrescarVisibilidadAvisos();
  actualizarBarraCompacta();
}

// Calcula la distancia geográfica entre dos puntos usando la fórmula Haversine
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

// Calcula la distancia mínima entre un punto y un segmento de ruta
function distanciaPuntoASegmentoMetros(p, a, b) {
  const ax = a.lng;
  const ay = a.lat;
  const bx = b.lng;
  const by = b.lat;
  const px = p.lng;
  const py = p.lat;

  const dx = bx - ax;
  const dy = by - ay;

  if (dx === 0 && dy === 0) return distanciaHaversineMetros(p, a);

  let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));

  const proj = { lat: ay + t * dy, lng: ax + t * dx };
  return distanciaHaversineMetros(p, proj);
}

// Calcula la distancia mínima entre un punto y toda la polilínea de la ruta
function distanciaARutaMetros(point, path) {
  if (path.length < 2) return Infinity;

  let min = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const d = distanciaPuntoASegmentoMetros(point, path[i], path[i + 1]);
    if (d < min) min = d;
  }
  return min;
}

// Busca el punto de la ruta más cercano a una posición dada
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

// Actualiza qué parte de la ruta ya se recorrió y cuál queda pendiente
function actualizarProgresoRutaGPS() {
  if (!coordenadasRuta.length || !posicionActual) return;

  const puntoActual = L.latLng(posicionActual.lat, posicionActual.lng);
  const indiceMasCercano = buscarIndiceRutaMasCercano(puntoActual);

  if (indiceMasCercano > indiceMaxRecorrido) indiceMaxRecorrido = indiceMasCercano;

  const recorrida = coordenadasRuta
    .slice(0, indiceMaxRecorrido + 1)
    .map(p => [p.lat, p.lng]);

  recorrida.push([posicionActual.lat, posicionActual.lng]);

  const pendiente = [[posicionActual.lat, posicionActual.lng]]
    .concat(coordenadasRuta.slice(indiceMaxRecorrido + 1).map(p => [p.lat, p.lng]));

  lineaRutaRecorrida.setLatLngs(recorrida);
  lineaRutaPendiente.setLatLngs(pendiente);
}

// Convierte el texto del destino en coordenadas mediante Nominatim
async function geocodificarDestino(query) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`
  );
  const data = await response.json();

  if (!data?.length) throw new Error("Destino no encontrado");
  return L.latLng(parseFloat(data[0].lat), parseFloat(data[0].lon));
}

// Construye la ruta desde el origen actual hasta el destino usando OSRM
function construirRuta(inicioLatLng, destinoLatLng) {
  return new Promise((resolve, reject) => {
    if (controlRuta) {
      mapa.removeControl(controlRuta);
      controlRuta = null;
    }

    resetearLineasRuta();
    coordenadasRuta = [];
    indiceMaxRecorrido = 0;

    controlRuta = L.Routing.control({
      waypoints: [inicioLatLng, destinoLatLng],
      router: L.Routing.osrmv1({
        serviceUrl: "https://router.project-osrm.org/route/v1"
      }),
      routeWhileDragging: false,
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      show: false,
      collapsible: true,
      lineOptions: { styles: [{ color: "transparent", opacity: 0, weight: 0 }] },
      createMarker: () => null
    }).addTo(mapa);

    controlRuta.on("routesfound", (e) => {
      const route = e.routes[0];
      coordenadasRuta = route.coordinates.map(c => ({ lat: c.lat, lng: c.lng }));
      lineaRutaPendiente.setLatLngs(coordenadasRuta.map(p => [p.lat, p.lng]));
      lineaRutaRecorrida.setLatLngs([]);
      refrescarVisibilidadAvisos();
      actualizarBarraCompacta();
      resolve(route);
    });

    controlRuta.on("routingerror", () => {
      reject(new Error("No se pudo calcular la ruta"));
    });
  });
}

// Crea una nueva ruta usando el texto escrito por el usuario
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

    // Al crear nueva ruta se reinician las marcas de avisos anunciados
    avisos.forEach(a => {
      a.anunciado150 = false;
      a.anunciado50 = false;
    });

    refrescarVisibilidadAvisos();
    ponerEstado(`Ruta creada hacia ${destino}. Avisos en ruta: ${avisosEnRuta.length}`);
    anunciarNumeroAvisosRuta("Ruta creada");
  } catch (error) {
    ponerEstado(error.message || "No se pudo crear la ruta");
  }
}

// Cambia la aplicación al modo conducción
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

  // Se reinician avisos anunciados para la nueva conducción
  avisos.forEach(a => {
    a.anunciado150 = false;
    a.anunciado50 = false;
  });

  ponerEstado("En conducción...");
  actualizarProgresoRutaGPS();
}

// Sale del modo conducción y opcionalmente limpia la ruta
function detenerConduccion(limpiarRutaTambien = true) {
  limpiarTemporizadorConduccion();
  enConduccion = false;
  seguirVehiculo = false;
  actualizarBarraCompacta();
  resetearPendientes();

  if (limpiarRutaTambien) limpiarRuta();
}

// Comprueba si el usuario se ha desviado de la ruta y recalcula si hace falta
async function comprobarSalidaDeRutaYRecalcular() {
  if (!posicionActual || !coordenadasRuta.length || !textoDestinoActual || !latLngDestinoActual) return;
  if (recalculandoRuta || !enConduccion) return;

  const distancia = distanciaARutaMetros(posicionActual, coordenadasRuta);

  if (distancia > UMBRAL_SALIDA_RUTA_METROS) {
    recalculandoRuta = true;
    ponerEstado("Te has salido de la ruta. Recalculando...");
    hablar("Te has salido de la ruta. Recalculando");

    try {
      const inicio = L.latLng(posicionActual.lat, posicionActual.lng);
      await construirRuta(inicio, latLngDestinoActual);

      avisos.forEach(a => {
        a.anunciado150 = false;
        a.anunciado50 = false;
      });

      refrescarVisibilidadAvisos();
      ponerEstado(`Ruta recalculada. Avisos en ruta: ${avisosEnRuta.length}`);
      anunciarNumeroAvisosRuta("Ruta recalculada");
      actualizarProgresoRutaGPS();
    } catch {
      ponerEstado("No se pudo recalcular la ruta");
    } finally {
      recalculandoRuta = false;
    }
  }
}

// Añade a la interfaz un aviso recibido del servidor
function agregarAvisoServidor(aviso) {
  if (avisos.some(a => a.id === aviso.id)) return;

  const marker = L.marker([aviso.lat, aviso.lng], {
    icon: crearIconoHTML("marcador-aviso", "AVISO")
  });

  marker.bindPopup(`
    <b>AVISO</b><br>
    ${aviso.message}<br>
    <small>${formatearHora(aviso.timestamp)}</small>
  `);

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

// Elimina de la interfaz un aviso dado su id
function quitarAvisoUI(id) {
  const index = avisos.findIndex(a => a.id === id);
  if (index === -1) return false;

  const aviso = avisos[index];
  if (mapa.hasLayer(aviso.marker)) mapa.removeLayer(aviso.marker);

  avisos.splice(index, 1);
  refrescarVisibilidadAvisos();
  refrescarPanelMisAvisos();
  actualizarBarraCompacta();
  return true;
}

// Envía al servidor la petición para crear un nuevo aviso
function enviarCreacionAviso(lat, lng, message) {
  socket.emit("warning:create", {
    lat,
    lng,
    message: mapearMotivoAviso(message).slice(0, 80)
  });
}

// Envía al servidor la petición para borrar un aviso
function enviarBorradoAviso(id) {
  socket.emit("warning:delete", { id });
}

// Reconstruye visualmente el panel con los avisos creados por el propio usuario
function refrescarPanelMisAvisos() {
  panelMisAvisosEl.innerHTML = "";

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

// Devuelve solo los avisos que se consideran cercanos a la ruta actual
function obtenerAvisosEnRuta() {
  if (!coordenadasRuta.length) return [];

  return avisos.filter(a => {
    const d = distanciaARutaMetros({ lat: a.lat, lng: a.lng }, coordenadasRuta);
    return d <= DISTANCIA_AVISO_RUTA_METROS;
  });
}

// Muestra u oculta los marcadores según si pertenecen a la ruta actual
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

// Anuncia por voz cuántos avisos hay en la ruta tras crearla o recalcularla
function anunciarNumeroAvisosRuta(prefijo = "Ruta creada") {
  const count = avisosEnRuta.length;
  if (count === 0) return hablar(`${prefijo}. No hay avisos en la ruta`);
  if (count === 1) return hablar(`${prefijo}. Hay 1 aviso en la ruta`);
  hablar(`${prefijo}. Hay ${count} avisos en la ruta`);
}

// Busca el aviso más adecuado para borrar por voz en función de ruta y distancia
function obtenerAvisoPasadoMasCercanoEnRuta() {
  if (!posicionActual || !avisosEnRuta.length || !coordenadasRuta.length) return null;

  const indiceCoche = buscarIndiceRutaMasCercano(posicionActual);
  let mejorAviso = null;
  let mejorScore = Infinity;

  for (const aviso of avisosEnRuta) {
    const puntoAviso = { lat: aviso.lat, lng: aviso.lng };
    const indiceAviso = buscarIndiceRutaMasCercano(puntoAviso);
    const distanciaCoche = distanciaHaversineMetros(posicionActual, puntoAviso);

    // Se considera válido si está cerca y no demasiado adelantado respecto al coche
    const detras = indiceAviso <= indiceCoche + 5;
    if (!detras) continue;
    if (distanciaCoche > DISTANCIA_MAX_BORRADO_ATRAS_METROS) continue;

    // Se penaliza ligeramente si está más adelantado en la ruta
    const penalizacion = Math.max(0, indiceAviso - indiceCoche) * 5;
    const score = distanciaCoche + penalizacion;

    if (score < mejorScore) {
      mejorScore = score;
      mejorAviso = aviso;
    }
  }

  return mejorAviso;
}

// Lanza avisos por voz cuando hay marcadores próximos en la ruta
function anunciarAvisosProximos() {
  if (!posicionActual || !avisosEnRuta.length || hablando) return;

  const ahora = Date.now();
  if (ahora - ultimoMomentoAviso < COOLDOWN_AVISOS_MS) return;

  const banda150 = [];
  const banda50 = [];

  for (const aviso of avisosEnRuta) {
    // No se anuncia al propio usuario su propio aviso
    if (aviso.creatorClientId === idCliente) continue;

    const distancia = distanciaHaversineMetros(posicionActual, { lat: aviso.lat, lng: aviso.lng });

    if (distancia <= DISTANCIA_SEGUNDO_AVISO_METROS && !aviso.anunciado50) {
      banda50.push({ aviso, distancia });
    } else if (distancia <= DISTANCIA_PRIMER_AVISO_METROS && !aviso.anunciado150) {
      banda150.push({ aviso, distancia });
    }
  }

  // Se da prioridad a los avisos más cercanos
  if (banda50.length > 0) {
    banda50.forEach(item => {
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

  // Si no hay de 50 metros, se anuncian los de 150 metros
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

// Empieza el flujo de creación de aviso por voz
function iniciarFlujoAviso() {
  limpiarTemporizadorConduccion();

  if (!posicionActual) {
    hablar("Todavía no tengo posición");
    return;
  }

  posicionPendienteAviso = { lat: posicionActual.lat, lng: posicionActual.lng };
  ponerEstadoApp("confirmando_aviso");
  ponerEstado("Confirmando aviso...");
  hablar("¿Quieres poner un aviso? Responde sí o no");
}

// Pasa al siguiente paso, donde el usuario debe decir el motivo del aviso
function pedirMotivoAviso() {
  limpiarTemporizadorConduccion();
  ponerEstadoApp("esperando_motivo");
  ponerEstado("Esperando motivo...");
  hablar("Di el motivo del aviso");
}

// Empieza el flujo de borrado de aviso por voz
function iniciarFlujoBorrado() {
  limpiarTemporizadorConduccion();

  const avisoMasCercano = obtenerAvisoPasadoMasCercanoEnRuta();
  if (!avisoMasCercano) {
    hablar("No hay avisos recientes de tu ruta para borrar");
    return;
  }

  avisoPendienteBorrado = avisoMasCercano;
  ponerEstadoApp("confirmando_borrado");
  ponerEstado(`Confirmando borrado de: ${avisoMasCercano.message}`);
  hablar(`¿Quieres borrar el aviso de ${avisoMasCercano.message}? Responde sí o no`);
}

// Interpreta los comandos de voz según el estado actual del flujo
function gestionarComandoVoz(texto) {
  if (hablando || !privacidad.microfono) return;

  // Comando global para cancelar cualquier flujo en curso
  if (texto === "cancelar" || texto.includes("cancelar")) {
    resetearPendientes();
    hablar("Acción cancelada");
    programarEstadoConduccion();
    return;
  }

  // Estado normal esperando un comando nuevo
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

  // Estado esperando confirmación para crear aviso
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

  // Estado esperando el motivo del aviso a crear
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

  // Estado esperando confirmación para borrar un aviso
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

// Cuando se conecta el cliente, se guarda su id para identificar avisos propios
socket.on("connect", () => {
  idCliente = socket.id;
  refrescarPanelMisAvisos();
});

// Al entrar, el servidor envía todos los avisos actuales para inicializar el cliente
socket.on("warnings:init", (serverWarnings) => {
  avisos.forEach(a => {
    if (mapa.hasLayer(a.marker)) mapa.removeLayer(a.marker);
  });

  avisos = [];
  serverWarnings.forEach(agregarAvisoServidor);
});

// Cuando el servidor comunica un nuevo aviso, se añade a la interfaz
socket.on("warning:created", (warning) => {
  agregarAvisoServidor(warning);

  if (warning.creatorClientId === idCliente) {
    ponerEstado(`Aviso compartido: ${warning.message}`);
    programarEstadoConduccion();
  }
});

// Cuando el servidor comunica un borrado, se elimina en la interfaz
socket.on("warning:deleted", ({ id }) => {
  quitarAvisoUI(id);
});

// Abre el panel de ayuda
botonAyudaEl.addEventListener("click", () => {
  panelAyudaEl.style.display = "block";
});

// Cierra el panel de ayuda
cerrarAyudaEl.addEventListener("click", () => {
  panelAyudaEl.style.display = "none";
});

// Abre el panel de privacidad
botonPrivacidadEl.addEventListener("click", () => {
  panelPrivacidadEl.style.display = "block";
});

// Cierra el panel de privacidad
cerrarPrivacidadEl.addEventListener("click", () => {
  panelPrivacidadEl.style.display = "none";
});

// Abre la ventana del detector solo si está permitido y encendido
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
  window.dispatchEvent(new CustomEvent("somnolencia:mostrar"));
});

// Botón para encender el detector
encenderSomnolenciaEl.addEventListener("click", () => {
  encenderDetectorSomnolencia();
  panelPrivacidadEl.style.display = "none";
});

// Botón para apagar el detector
apagarSomnolenciaEl.addEventListener("click", () => {
  apagarDetectorSomnolencia();
  panelPrivacidadEl.style.display = "none";
});

// Cierra solo la ventana visual del detector, no necesariamente el detector entero
cerrarModalSomnolenciaEl.addEventListener("click", () => {
  modalSomnolenciaEl.classList.remove("abierto");
  window.dispatchEvent(new CustomEvent("somnolencia:ocultar"));
});

// Activa o desactiva pantalla completa sobre la ventana del detector
pantallaCompletaSomnolenciaEl.addEventListener("click", async () => {
  try {
    const ventana = modalSomnolenciaEl.querySelector(".ventanaSomnolencia");

    if (!document.fullscreenElement) {
      await ventana.requestFullscreen();
      pantallaCompletaSomnolenciaEl.textContent = "🡼";
    } else {
      await document.exitFullscreen();
      pantallaCompletaSomnolenciaEl.textContent = "⛶";
    }
  } catch {}
});

// Restaura el icono correcto al salir de pantalla completa
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) pantallaCompletaSomnolenciaEl.textContent = "⛶";
});

// Gestión del checkbox de micrófono
usarMicrofonoEl.addEventListener("change", async () => {
  if (usarMicrofonoEl.checked) {
    const granted = await pedirPermisoMicrofono();
    ponerPermisoMicrofono(granted);
    if (!granted) ponerEstadoSensores("Micrófono denegado o desactivado");
  } else {
    ponerPermisoMicrofono(false);
  }
});

// Gestión del checkbox de ubicación
usarUbicacionEl.addEventListener("change", async () => {
  if (usarUbicacionEl.checked) {
    const granted = await pedirPermisoUbicacion();
    ponerPermisoUbicacion(granted);
    if (!granted) ponerEstadoSensores("Ubicación denegada o desactivada");
  } else {
    ponerPermisoUbicacion(false);
  }
});

// Gestión del checkbox de cámara
usarCamaraEl.addEventListener("change", async () => {
  if (usarCamaraEl.checked) {
    const granted = await pedirPermisoCamara();
    ponerPermisoCamara(granted);
    if (!granted) ponerEstadoSensores("Cámara denegada o desactivada");
  } else {
    ponerPermisoCamara(false);
  }
});

// Eventos principales de los botones de navegación
botonCrearRutaEl.addEventListener("click", crearRutaDesdeInput);
botonEmpezarRutaEl.addEventListener("click", empezarConduccion);
botonSalirConduccionEl.addEventListener("click", salirModoConduccion);

// Abre o cierra el panel de "mis avisos" y lo reconstruye
botonMisAvisosEl.addEventListener("click", () => {
  panelMisAvisosEl.classList.toggle("oculto");
  refrescarPanelMisAvisos();
});

// Sale del modo conducción y devuelve la app a estado normal
function salirModoConduccion() {
  detenerConduccion(true);
  destinoInputEl.value = "";
  cerrarPaneles();

  if (posicionActual) {
    mapa.setView([posicionActual.lat, posicionActual.lng], 14, { animate: true });
  }

  ponerEstado("Modo conducción finalizado. Puedes crear otra ruta");
}

// Función principal de arranque de toda la app
function iniciarApp() {
  cargarPrivacidad();
  iniciarMapa();
  aplicarPrivacidadEnUI();

  // Se crea una sola vez el objeto de reconocimiento de voz
  reconocimiento = crearReconocimiento();

  if (privacidad.inicializado) {
    // Si ya había permisos guardados, se restauran los servicios necesarios
    if (privacidad.microfono) iniciarReconocimientoConRetardo(150);
    if (privacidad.ubicacion) iniciarWatchGPS();
    if (privacidad.camara && privacidad.somnolenciaEncendida) {
      window.dispatchEvent(new CustomEvent("somnolencia:activar"));
    }

    // Se muestra un mensaje inicial según qué permisos estén activos
    if (!privacidad.ubicacion && !privacidad.microfono && !privacidad.camara) {
      ponerEstado("Activa permisos desde Privacidad para usar el sistema");
    } else if (!privacidad.ubicacion) {
      ponerEstado("Activa la ubicación para crear una ruta");
    } else {
      ponerEstado("Sistema listo. Escribe un destino para crear una ruta");
    }
  } else {
    // Si es la primera vez, se lanza el flujo inicial de permisos
    pedirPermisosInicialesSiHaceFalta();
  }

  actualizarBarraCompacta();
}

// Arranca la aplicación al cargar el script
iniciarApp();