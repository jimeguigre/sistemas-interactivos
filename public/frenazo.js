// DETECTOR DE FRENAZO BRUSCO Y AVISO DE EMERGENCIA


// Se usa la misma clave de localStorage que en app.js para compartir el estado.
const CLAVE_PRIVACIDAD_FRENAZO = "avisos_nav_privacidad_v10";

// Socket dedicado al envio del email de emergencia.
const socketFrenazo = window.socketPrincipal || io();

// Umbral para considerar un posible frenazo.
// Caso esperado: movil en horizontal/apaisado, vertical en el soporte,
// con la pantalla y la camara frontal mirando hacia el conductor.
const UMBRAL_FRENAZO_BRUSCO = 12;

// Tiempo maximo para que el usuario responda si esta bien.
const TIEMPO_ESPERA_RESPUESTA_MS = 20000;

// Tiempo minimo entre dos detecciones para no disparar varias alertas seguidas.
const COOLDOWN_FRENAZO_MS = 45000;

// Tiempo minimo entre dos analisis del sensor para no saturar.
const THROTTLE_SENSOR_MS = 250;


// REFERENCIAS AL MODAL DE CONTACTO


// Modal donde se pide o edita el contacto de emergencia.
const modalContactoEmergenciaEl = document.getElementById("modalContactoEmergencia");
// Campo del nombre del contacto.
const inputNombreContactoEmergenciaEl = document.getElementById("inputNombreContactoEmergencia");
// Campo del email del contacto.
const inputEmailContactoEmergenciaEl = document.getElementById("inputEmailContactoEmergencia");
// Texto de error si falta algún campo.
const errorContactoEmergenciaEl = document.getElementById("errorContactoEmergencia");
// Botón para confirmar el contacto y activar el detector.
const botonConfirmarContactoEmergenciaEl = document.getElementById("botonConfirmarContactoEmergencia");
// Botón para salir del popup sin activar el detector.
const botonCancelarContactoEmergenciaEl = document.getElementById("botonCancelarContactoEmergencia");


// ESTADO INTERNO DEL DETECTOR


// Indica si el detector esta activado realmente.
let detectorFrenazoActivo = false;

// Marca temporal del ultimo frenazo aceptado.
let ultimoMomentoFrenazo = 0;

// Marca temporal de la ultima lectura util del sensor.
let ultimoMomentoLectura = 0;

// Indica si ya se recibio alguna lectura real del sensor.
let primeraLecturaMovimientoRecibida = false;

// Temporizador que manda el email si el usuario no responde.
let temporizadorEmergencia = null;

// Guarda los datos del evento actual de emergencia.
let emergenciaActiva = null;

// Evita enviar varios correos por el mismo frenazo si coinciden voz y timeout.
let correoEmergenciaEnviado = false;

// Funcion registrada en app.js para interpretar solo la respuesta de emergencia.
let gestorVozEmergencia = null;


// PRIVACIDAD COMPARTIDA CON app.js


// Lee desde localStorage el estado relevante para este modulo.
function cargarPrivacidadFrenazo() {
  try {
    const raw = localStorage.getItem(CLAVE_PRIVACIDAD_FRENAZO);

    if (!raw) {
      return {
        frenazoEncendido: false,
        contactoEmergenciaNombre: "",
        contactoEmergenciaEmail: "",
        microfono: false
      };
    }

    const datos = JSON.parse(raw);

    return {
      frenazoEncendido: !!datos.frenazoEncendido,
      contactoEmergenciaNombre: String(datos.contactoEmergenciaNombre || ""),
      contactoEmergenciaEmail: String(datos.contactoEmergenciaEmail || ""),
      microfono: !!datos.microfono
    };
  } catch {
    return {
      frenazoEncendido: false,
      contactoEmergenciaNombre: "",
      contactoEmergenciaEmail: "",
      microfono: false
    };
  }
}

// Guarda campos concretos sin pisar el resto de configuracion de la app.
function guardarPrivacidadFrenazo(parcial) {
  let actual = {};

  try {
    actual = JSON.parse(localStorage.getItem(CLAVE_PRIVACIDAD_FRENAZO) || "{}");
  } catch {
    actual = {};
  }

  localStorage.setItem(CLAVE_PRIVACIDAD_FRENAZO, JSON.stringify({
    ...actual,
    ...parcial
  }));
}


// FUNCIONES AUXILIARES


// Devuelve el estado actual de la ruta principal reutilizando la API global.
function obtenerEstadoRutaPrincipal() {
  return window.apiRutaCompartida?.obtenerEstadoActual?.() || null;
}

// Normaliza texto para comparar respuestas de voz.
function normalizarTextoFrenazo(texto) {
  return String(texto || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Reconoce respuestas que significan que el usuario esta bien.
function esRespuestaBienFrenazo(texto) {
  return texto === "si"
    || texto === "estoy bien"
    || texto === "vale"
    || texto === "ok"
    || texto.includes("estoy bien")
    || texto.includes("todo bien")
    || texto.includes("me encuentro bien");
}

// Reconoce respuestas que significan que hay que avisar al contacto.
function esRespuestaAyudaFrenazo(texto) {
  return texto === "no"
    || texto === "ayuda"
    || texto.includes("necesito ayuda")
    || texto.includes("no estoy bien")
    || texto.includes("llama")
    || texto.includes("avisar");
}

// Calcula la fuerza frontal del coche segun la orientacion prevista del movil.
// El movil va apaisado, pero no tumbado: va vertical en un soporte de coche.
// Como la pantalla/camara frontal mira al conductor, el eje Z representa
// el movimiento hacia el conductor o hacia el parabrisas.
// Un frenazo fuerte deberia generar un pico en este eje.
function obtenerIntensidadFrontal(event) {
  const acc = event.acceleration || event.accelerationIncludingGravity;
  if (!acc) return null;

  // Se prefiere acceleration, pero se acepta accelerationIncludingGravity
  // porque algunos navegadores moviles no rellenan la primera.
  // Se usa valor absoluto porque depende de si el pico sale positivo o negativo.
  return Math.abs(Number(acc.z || 0));
}

// Escribe un mensaje de error en el popup del contacto.
function ponerErrorContactoEmergencia(texto) {
  errorContactoEmergenciaEl.textContent = texto || "";
}

// Abre el popup de contacto con los datos guardados.
function abrirModalContactoEmergencia() {
  const privacidad = cargarPrivacidadFrenazo();

  inputNombreContactoEmergenciaEl.value = privacidad.contactoEmergenciaNombre || "";
  inputEmailContactoEmergenciaEl.value = privacidad.contactoEmergenciaEmail || "";
  ponerErrorContactoEmergencia("");
  modalContactoEmergenciaEl.classList.add("abierto");

  setTimeout(() => {
    inputNombreContactoEmergenciaEl.focus();
  }, 60);
}

// Cierra el popup del contacto.
function cerrarModalContactoEmergencia() {
  modalContactoEmergenciaEl.classList.remove("abierto");
  ponerErrorContactoEmergencia("");
}

// Limpia temporizadores internos del flujo de emergencia.
function limpiarTemporizadoresFrenazo() {
  clearTimeout(temporizadorEmergencia);
  temporizadorEmergencia = null;
}

// Reanuda las locuciones normales de la app despues de la interrupcion urgente.
function reanudarLocucionesNormalesSiHaceFalta() {
  if (window.apiRutaCompartida?.desbloquearVozPrincipalPorEmergencia) {
    window.apiRutaCompartida.desbloquearVozPrincipalPorEmergencia();
  }

  if (!window.apiRutaCompartida?.reanudarLocucionesNormales) return;
  window.apiRutaCompartida.reanudarLocucionesNormales();
}

// Informa a app.js de cambios reales del detector.
function notificarEstadoFrenazo(detalle = {}) {
  window.dispatchEvent(new CustomEvent("frenazo:estado", {
    detail: detalle
  }));
}

// Cierra por completo el flujo de emergencia actual.
function cerrarFlujoEmergencia() {
  limpiarTemporizadoresFrenazo();
  detenerReconocimientoEmergencia();
  emergenciaActiva = null;
  correoEmergenciaEnviado = false;
  reanudarLocucionesNormalesSiHaceFalta();
}

// Construye el texto del email de emergencia con datos utiles.
function construirMensajeEmergencia(payload) {
  const lat = Number(payload?.lat);
  const lng = Number(payload?.lng);
  const hayPosicion = Number.isFinite(lat) && Number.isFinite(lng);

  const enlaceMapa = hayPosicion
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : "No disponible";

  return [
    "Posible emergencia detectada en ruta.",
    "",
    `Hora: ${new Date(payload?.momento || Date.now()).toLocaleString("es-ES")}`,
    `Motivo: ${payload?.motivo || "Frenazo brusco detectado"}`,
    `Destino actual: ${payload?.destinoTexto || "No disponible"}`,
    `Ubicacion: ${hayPosicion ? `${lat}, ${lng}` : "No disponible"}`,
    `Mapa: ${enlaceMapa}`,
    "",
    "El usuario ha indicado que no esta bien o no ha respondido dentro del tiempo de espera."
  ].join("\n");
}

// Envia el email real de emergencia al servidor.
function enviarCorreoEmergencia(origen = "sin_respuesta") {
  if (!emergenciaActiva) return;
  if (correoEmergenciaEnviado) return;

  correoEmergenciaEnviado = true;
  limpiarTemporizadoresFrenazo();
  detenerReconocimientoEmergencia();

  const privacidad = cargarPrivacidadFrenazo();

  if (!privacidad.contactoEmergenciaEmail.trim()) {
    if (window.apiRutaCompartida?.ponerEstadoUrgente) {
      window.apiRutaCompartida.ponerEstadoUrgente("No hay contacto de emergencia guardado");
    }
    cerrarFlujoEmergencia();
    return;
  }

  if (window.apiRutaCompartida?.ponerEstadoUrgente) {
    window.apiRutaCompartida.ponerEstadoUrgente("Enviando email de emergencia...");
  }

  socketFrenazo.emit("emergencia:enviar_email", {
    to: privacidad.contactoEmergenciaEmail.trim(),
    contactName: privacidad.contactoEmergenciaNombre.trim(),
    subject: "Posible emergencia detectada en ruta",
    body: construirMensajeEmergencia({
      ...emergenciaActiva,
      origen
    })
  });
}


// Conecta la respuesta del frenazo a la escucha principal de la app.
function iniciarReconocimientoEmergenciaSiHaceFalta() {
  const privacidad = cargarPrivacidadFrenazo();

  if (!privacidad.microfono) return;

  gestorVozEmergencia = (texto) => {
    const limpio = normalizarTextoFrenazo(texto);

    if (esRespuestaAyudaFrenazo(limpio)) {
      if (window.apiRutaCompartida?.interrumpirYHablarUrgente) {
        window.apiRutaCompartida.interrumpirYHablarUrgente("Entendido. Voy a avisar al contacto de emergencia.");
      }
      enviarCorreoEmergencia("respuesta_no");
      return true;
    }

    if (esRespuestaBienFrenazo(limpio)) {
      if (window.apiRutaCompartida?.interrumpirYHablarUrgente) {
        window.apiRutaCompartida.interrumpirYHablarUrgente("Perfecto. Cancelo la alerta de emergencia.");
      }
      cerrarFlujoEmergencia();
      return true;
    }

    return true;
  };

  window.apiRutaCompartida?.registrarGestorVozUrgente?.(gestorVozEmergencia);
}

// Desconecta la respuesta urgente y deja libre la escucha principal.
function detenerReconocimientoEmergencia() {
  if (gestorVozEmergencia) {
    window.apiRutaCompartida?.limpiarGestorVozUrgente?.(gestorVozEmergencia);
    gestorVozEmergencia = null;
  }
}


// FLUJO PRINCIPAL DE FRENAZO


// Arranca la alerta urgente al detectar un frenazo fuerte.
function dispararAlertaFrenazo(intensidad) {
  if (emergenciaActiva) return;

  const privacidad = cargarPrivacidadFrenazo();

  if (!privacidad.frenazoEncendido) return;

  const ahora = Date.now();

  // Se ignoran detecciones demasiado seguidas.
  if (ahora - ultimoMomentoFrenazo < COOLDOWN_FRENAZO_MS) return;

  ultimoMomentoFrenazo = ahora;
  correoEmergenciaEnviado = false;

  const estadoRuta = obtenerEstadoRutaPrincipal();

  emergenciaActiva = {
    motivo: `Frenazo brusco detectado (intensidad ${intensidad.toFixed(2)})`,
    momento: ahora,
    lat: Number(estadoRuta?.posicionActual?.lat),
    lng: Number(estadoRuta?.posicionActual?.lng),
    destinoTexto: estadoRuta?.textoDestinoActual || ""
  };

  if (window.apiRutaCompartida?.bloquearVozPrincipalPorEmergencia) {
    window.apiRutaCompartida.bloquearVozPrincipalPorEmergencia();
  }

  // Se corta lo que este sonando ahora, pero sin vaciar la cola.
  if (window.apiRutaCompartida?.interrumpirYHablarUrgente) {
    window.apiRutaCompartida.interrumpirYHablarUrgente(
      "Atencion. He detectado un frenazo fuerte. ¿Estas bien? Responde si o no. Si no respondes en veinte segundos, avisare al contacto de emergencia.",
      iniciarReconocimientoEmergenciaSiHaceFalta
    );
  }

  if (window.apiRutaCompartida?.ponerEstadoUrgente) {
    window.apiRutaCompartida.ponerEstadoUrgente("Frenazo fuerte detectado. Esperando respuesta...");
  }

  temporizadorEmergencia = setTimeout(() => {
    enviarCorreoEmergencia("sin_respuesta");
  }, TIEMPO_ESPERA_RESPUESTA_MS);
}

// Analiza cada evento de movimiento del dispositivo.
function analizarMovimientoFrenazo(event) {
  if (!detectorFrenazoActivo) return;

  const ahora = Date.now();

  if (ahora - ultimoMomentoLectura < THROTTLE_SENSOR_MS) return;
  ultimoMomentoLectura = ahora;

  const intensidadFrontal = obtenerIntensidadFrontal(event);
  if (intensidadFrontal === null) return;

  if (!primeraLecturaMovimientoRecibida) {
    primeraLecturaMovimientoRecibida = true;

    if (window.apiRutaCompartida?.ponerEstadoUrgente) {
      window.apiRutaCompartida.ponerEstadoUrgente("Sensor de movimiento activo. Frenazo listo.");
    }
  }

  // Con el movil apaisado en soporte y mirando al conductor,
  // el frenazo se interpreta como un pico frontal en Z.
  if (intensidadFrontal >= UMBRAL_FRENAZO_BRUSCO) {
    dispararAlertaFrenazo(intensidadFrontal);
  }
}

// Activa la escucha real del detector una vez confirmado el contacto.
function activarEscuchaDetectorFrenazo() {
  if (detectorFrenazoActivo) return;

  detectorFrenazoActivo = true;
  ultimoMomentoLectura = 0;
  primeraLecturaMovimientoRecibida = false;
  window.addEventListener("devicemotion", analizarMovimientoFrenazo);

  if (window.apiRutaCompartida?.ponerEstadoUrgente) {
    window.apiRutaCompartida.ponerEstadoUrgente("Detector de frenazo activo. Esperando datos del sensor...");
  }
}

// Valida el contacto, lo guarda y activa el detector.
function confirmarContactoYActivarDetector() {
  const nombre = inputNombreContactoEmergenciaEl.value.trim();
  const email = inputEmailContactoEmergenciaEl.value.trim();

  if (!nombre) {
    ponerErrorContactoEmergencia("Debes indicar un nombre de contacto de emergencia");
    inputNombreContactoEmergenciaEl.focus();
    return;
  }

  if (!email) {
    ponerErrorContactoEmergencia("Debes indicar un email de contacto de emergencia");
    inputEmailContactoEmergenciaEl.focus();
    return;
  }

  guardarPrivacidadFrenazo({
    frenazoEncendido: true,
    contactoEmergenciaNombre: nombre,
    contactoEmergenciaEmail: email
  });

  notificarEstadoFrenazo({
    encendido: true,
    contactoEmergenciaNombre: nombre,
    contactoEmergenciaEmail: email,
    mensaje: "Detector de frenazo encendido"
  });

  cerrarModalContactoEmergencia();
  activarEscuchaDetectorFrenazo();
}

// Muestra el popup para pedir o editar el contacto antes de activar.
function abrirFlujoActivacionFrenazo() {
  abrirModalContactoEmergencia();
}

// Sale del popup sin guardar cambios ni encender el detector.
function cancelarActivacionFrenazo() {
  cerrarModalContactoEmergencia();

  if (!detectorFrenazoActivo && window.apiRutaCompartida?.ponerEstadoUrgente) {
    window.apiRutaCompartida.ponerEstadoUrgente("Detector de frenazo sin activar");
  }
}

// Apaga el detector y detiene cualquier flujo pendiente.
function detenerDetectorFrenazo() {
  detectorFrenazoActivo = false;
  ultimoMomentoLectura = 0;
  primeraLecturaMovimientoRecibida = false;
  window.removeEventListener("devicemotion", analizarMovimientoFrenazo);
  cerrarFlujoEmergencia();
  cerrarModalContactoEmergencia();

  guardarPrivacidadFrenazo({ frenazoEncendido: false });

  notificarEstadoFrenazo({
    encendido: false,
    mensaje: "Detector de frenazo apagado"
  });

  if (window.apiRutaCompartida?.ponerEstadoUrgente) {
    window.apiRutaCompartida.ponerEstadoUrgente("Detector de frenazo apagado");
  }
}


// RESPUESTAS DEL SERVIDOR


// Cuando el servidor confirma el envio, se avisa y se cierra el flujo.
socketFrenazo.on("emergencia:email_enviado", () => {
  if (window.apiRutaCompartida?.interrumpirYHablarUrgente) {
    window.apiRutaCompartida.interrumpirYHablarUrgente("He enviado el email al contacto de emergencia.");
  }

  if (window.apiRutaCompartida?.ponerEstadoUrgente) {
    window.apiRutaCompartida.ponerEstadoUrgente("Email enviado al contacto de emergencia");
  }

  setTimeout(() => {
    cerrarFlujoEmergencia();
  }, 1200);
});

// Si falla el envio, se informa y se cierra.
socketFrenazo.on("emergencia:email_error", (payload) => {
  if (window.apiRutaCompartida?.interrumpirYHablarUrgente) {
    window.apiRutaCompartida.interrumpirYHablarUrgente("No se pudo enviar el email de emergencia.");
  }

  if (window.apiRutaCompartida?.ponerEstadoUrgente) {
    window.apiRutaCompartida.ponerEstadoUrgente(payload?.mensaje || "No se pudo enviar el email de emergencia");
  }

  setTimeout(() => {
    cerrarFlujoEmergencia();
  }, 1200);
});


// EVENTOS DE INTERFAZ DEL MODAL


// Confirmar contacto y activar detector.
botonConfirmarContactoEmergenciaEl?.addEventListener("click", () => {
  confirmarContactoYActivarDetector();
});

botonCancelarContactoEmergenciaEl?.addEventListener("click", () => {
  cancelarActivacionFrenazo();
});

inputNombreContactoEmergenciaEl?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    inputEmailContactoEmergenciaEl.focus();
  }
});

inputEmailContactoEmergenciaEl?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    confirmarContactoYActivarDetector();
  }
});


// EVENTOS PERSONALIZADOS DESDE app.js


// app.js lanza este evento cuando el usuario enciende el detector.
window.addEventListener("frenazo:activar", () => {
  abrirFlujoActivacionFrenazo();
});

// app.js lanza este evento cuando el usuario apaga el detector.
window.addEventListener("frenazo:detener", () => {
  detenerDetectorFrenazo();
});
