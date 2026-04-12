// Elementos principales de la vista del espectador
const estadoGeneralRutaCompartidaEl = document.getElementById("estadoGeneralRutaCompartida");
const insigniaModoEl = document.getElementById("insigniaModo");
const panelEspectadorEl = document.getElementById("panelEspectador");
const campoMensajeEspectadorEl = document.getElementById("campoMensajeEspectador");
const botonEnviarMensajeEspectadorEl = document.getElementById("botonEnviarMensajeEspectador");
const textoEstadoMensajesEl = document.getElementById("textoEstadoMensajes");
const datoCodigoRutaEl = document.getElementById("datoCodigoRuta");
const datoDestinoRutaEl = document.getElementById("datoDestinoRuta");
const datoEstadoRutaEl = document.getElementById("datoEstadoRuta");
const datoPosicionRutaEl = document.getElementById("datoPosicionRuta");
const bloqueoRutaFinalizadaEl = document.getElementById("bloqueoRutaFinalizada");

// Conexion en tiempo real con el servidor
const socketRutaCompartida = io();

// Codigo de la sesion que viene en la URL
const rutaActualNavegador = window.location.pathname;
const codigoObservado = decodeURIComponent(rutaActualNavegador.split("/").pop() || "").trim().toUpperCase();

// Estado local de la vista
let mapaRutaCompartida = null;
let lineaRutaCompartida = null;
let marcadorConductorRutaCompartida = null;
let marcadorDestinoRutaCompartida = null;
let posicionActualConductor = null;
let textoDestinoActualRutaCompartida = "";
let destinoActualLatLngRutaCompartida = null;
let coordenadasRutaActual = [];
let sesionCompartidaActual = null;
let rutaActivaRutaCompartida = false;
let rutaFinalizadaRutaCompartida = false;

// Bloquea la pantalla cuando la ruta ya ha terminado
function bloquearInterfazPorRutaFinalizada() {
  // Se muestra la capa oscura de bloqueo
  if (bloqueoRutaFinalizadaEl) bloqueoRutaFinalizadaEl.classList.add("visible");
  // Se desactiva el campo de texto
  campoMensajeEspectadorEl.disabled = true;
  // Se desactiva tambien el boton de enviar
  botonEnviarMensajeEspectadorEl.disabled = true;
}

// Guarda un texto de estado interno
function ponerEstadoGeneralRutaCompartida(texto) {
  // Se escribe el mensaje en el elemento oculto de estado
  estadoGeneralRutaCompartidaEl.textContent = texto;
}

// Devuelve el texto visible del estado actual de la ruta
function obtenerTextoEstadoRuta() {
  // Si ya termino, se indica claramente
  if (rutaFinalizadaRutaCompartida) return "Estado: finalizada";
  // Si esta activa, se muestra que esta en marcha
  if (rutaActivaRutaCompartida) return "Estado: en marcha";
  // Si hay geometria pero todavia no se ha iniciado, se indica espera
  if (coordenadasRutaActual.length > 0) return "Estado: creada y esperando inicio";
  // Si todavia no llego nada util, se deja el texto neutro
  return "Estado: esperando datos";
}

// Actualiza el panel lateral con la informacion mas reciente
function refrescarResumenVisible() {
  // Se calcula que codigo ensenar
  const codigoVisible = sesionCompartidaActual?.codigo || codigoObservado || "sin codigo";
  // Se calcula que destino ensenar
  const destinoVisible = textoDestinoActualRutaCompartida || "sin ruta creada";
  // Se prepara el texto de la posicion actual
  const posicionVisible = posicionActualConductor
    ? `${posicionActualConductor.lat.toFixed(5)}, ${posicionActualConductor.lng.toFixed(5)}`
    : "sin datos GPS";

  // Se actualiza el codigo de la sesion
  datoCodigoRutaEl.textContent = `Codigo: ${codigoVisible}`;
  // Se actualiza el destino visible
  datoDestinoRutaEl.textContent = `Destino: ${destinoVisible}`;
  // Se actualiza el estado general de la ruta
  datoEstadoRutaEl.textContent = obtenerTextoEstadoRuta();
  // Se actualiza la posicion del conductor
  datoPosicionRutaEl.textContent = `Posicion: ${posicionVisible}`;
}

// Prepara el mapa base
function iniciarMapaRutaCompartida() {
  // Se crea el mapa con una vista inicial centrada en Madrid
  mapaRutaCompartida = L.map("mapaRutaCompartida").setView([40.4168, -3.7038], 13);

  // Se anade la capa de OpenStreetMap
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    // Se fija el zoom maximo util
    maxZoom: 19,
    // Se muestra la atribucion obligatoria
    attribution: "&copy; OpenStreetMap"
  }).addTo(mapaRutaCompartida);

  // Se crea la linea que luego dibujara la ruta
  lineaRutaCompartida = L.polyline([], {
    // Se usa el color verde de la app
    color: "#0f766e",
    // Se define el grosor de la linea
    weight: 6,
    // Se deja una opacidad alta
    opacity: 0.9
  }).addTo(mapaRutaCompartida);

  // En movil y en algunos navegadores el contenedor aun no tiene bien el tamano al crear el mapa
  // Se fuerza un recalculo poco despues para que Leaflet pinte correctamente
  setTimeout(() => {
    if (mapaRutaCompartida) mapaRutaCompartida.invalidateSize();
  }, 150);

  // Se repite una vez mas por si el layout termina de ajustarse un poco mas tarde
  setTimeout(() => {
    if (mapaRutaCompartida) mapaRutaCompartida.invalidateSize();
  }, 500);
}

// Pinta o mueve el marcador del conductor
function pintarPosicionConductor(lat, lng) {
  // Se construye el punto que entiende Leaflet
  const punto = L.latLng(lat, lng);

  // Si el marcador todavia no existe, se crea
  if (!marcadorConductorRutaCompartida) {
    // Se anade al mapa con un texto identificativo
    marcadorConductorRutaCompartida = L.marker(punto).addTo(mapaRutaCompartida).bindPopup("Posicion del conductor");
    // Y se termina aqui
    return;
  }

  // Si ya existia, solo se mueve a la nueva posicion
  marcadorConductorRutaCompartida.setLatLng(punto);
}

// Pinta o mueve el marcador del destino
function pintarDestinoRutaCompartida(lat, lng) {
  // Se construye el punto del destino
  const punto = L.latLng(lat, lng);

  // Si todavia no existia el marcador, se crea
  if (!marcadorDestinoRutaCompartida) {
    // Se anade al mapa con su popup
    marcadorDestinoRutaCompartida = L.marker(punto).addTo(mapaRutaCompartida).bindPopup("Destino");
    // Y se termina aqui
    return;
  }

  // Si ya existia, se mueve al nuevo destino
  marcadorDestinoRutaCompartida.setLatLng(punto);
}

// Dibuja la ruta actual en el mapa
function pintarRutaActualEnMapa() {
  // Se pasa la geometria al formato que espera Leaflet
  const puntos = coordenadasRutaActual.map((punto) => [punto.lat, punto.lng]);

  // Se actualiza la linea visible del mapa
  lineaRutaCompartida.setLatLngs(puntos);

  // Si hay varios puntos, se ajusta el encuadre a toda la ruta
  if (puntos.length > 1) {
    // Se hace zoom automatico con un margen comodo
    mapaRutaCompartida.fitBounds(L.latLngBounds(puntos), { padding: [30, 30] });
    // Y se termina aqui
    return;
  }

  // Si no hay ruta completa pero si posicion del conductor, se centra en ella
  if (posicionActualConductor) {
    // Se actualiza la vista del mapa
    mapaRutaCompartida.setView([posicionActualConductor.lat, posicionActualConductor.lng], 15);
  }
}

// Aplica el estado completo que manda el servidor
function aplicarEstadoRecibidoDeSesion(sesion) {
  // Si no llega una sesion valida, no se hace nada
  if (!sesion) return;

  // Se guarda la sesion actual
  sesionCompartidaActual = sesion;
  // Se guarda el texto del destino
  textoDestinoActualRutaCompartida = sesion.destinoTexto || "";
  // Se actualiza si la ruta esta activa
  rutaActivaRutaCompartida = Boolean(sesion.activa);
  // Se actualiza si la ruta ya termino
  rutaFinalizadaRutaCompartida = Boolean(sesion.finalizada);

  // Si llega un destino valido, se guarda y se pinta
  if (Number.isFinite(sesion.destinoLatLng?.lat) && Number.isFinite(sesion.destinoLatLng?.lng)) {
    // Se guarda el destino en memoria
    destinoActualLatLngRutaCompartida = sesion.destinoLatLng;
    // Se pinta el marcador del destino
    pintarDestinoRutaCompartida(destinoActualLatLngRutaCompartida.lat, destinoActualLatLngRutaCompartida.lng);
  }

  // Si llega una geometria de ruta, se reemplaza la actual
  if (Array.isArray(sesion.coordenadasRuta)) {
    // Se guarda la nueva geometria
    coordenadasRutaActual = sesion.coordenadasRuta;
    // Se repinta la ruta
    pintarRutaActualEnMapa();
  }

  // Si llega una posicion valida del conductor, se actualiza
  if (Number.isFinite(sesion.posicionActual?.lat) && Number.isFinite(sesion.posicionActual?.lng)) {
    // Se guarda la posicion actual
    posicionActualConductor = sesion.posicionActual;
    // Se repinta el marcador del conductor
    pintarPosicionConductor(posicionActualConductor.lat, posicionActualConductor.lng);
  }

  // Si la ruta ya ha terminado, se bloquea la pantalla
  if (rutaFinalizadaRutaCompartida) {
    // Se activa el bloqueo visual y funcional
    bloquearInterfazPorRutaFinalizada();
  }

  // Se refresca el panel lateral con los nuevos datos
  refrescarResumenVisible();
}

// Envia un mensaje del espectador al conductor
function enviarMensajeDelEspectador() {
  // Se lee y limpia el texto escrito
  const texto = campoMensajeEspectadorEl.value.trim();

  // Si no hay codigo valido en la URL, no se puede continuar
  if (!codigoObservado) {
    // Se informa del problema en pantalla
    textoEstadoMensajesEl.textContent = "No existe un codigo de seguimiento valido";
    // Y se termina aqui
    return;
  }

  // Si la ruta ya termino, no se admiten mas mensajes
  if (rutaFinalizadaRutaCompartida) {
    // Se deja claro el motivo
    textoEstadoMensajesEl.textContent = "La ruta ya termino y no admite mas mensajes";
    // Y se termina la funcion
    return;
  }

  // Si el texto esta vacio, tampoco se envia
  if (!texto) {
    // Se pide al usuario que escriba algo
    textoEstadoMensajesEl.textContent = "Escribe un mensaje antes de enviarlo";
    // Y se corta la ejecucion
    return;
  }

  // Se envia el mensaje al servidor
  socketRutaCompartida.emit("ruta:mensaje_espectador", {
    // Se manda el codigo de la sesion
    codigo: codigoObservado,
    // Se manda el texto escrito
    texto
  });

  // Se limpia el campo para dejarlo listo para otro mensaje
  campoMensajeEspectadorEl.value = "";
  // Se avisa de que el envio se ha lanzado
  textoEstadoMensajesEl.textContent = "Mensaje enviado al conductor";
}

// Registra los eventos del socket para esta vista
function registrarEventosDeSocket() {
  // Cuando el socket conecta, se intenta entrar en la sesion
  socketRutaCompartida.on("connect", () => {
    // Si falta el codigo, se informa y se para
    if (!codigoObservado) {
      // Se guarda el estado de error
      ponerEstadoGeneralRutaCompartida("No existe un codigo valido en este enlace");
      // Y se termina aqui
      return;
    }

    // Se pide unirse a la sesion del enlace actual
    socketRutaCompartida.emit("ruta:unirse_espectador", { codigo: codigoObservado });
  });

  // Cuando llega una actualizacion completa del estado
  socketRutaCompartida.on("ruta:estado", (sesion) => {
    // Se aplica todo lo recibido
    aplicarEstadoRecibidoDeSesion(sesion);
    // Se actualiza el estado general visible
    ponerEstadoGeneralRutaCompartida(
      sesion.finalizada
        ? "La ruta ya ha finalizado"
        : (sesion.activa ? "La ruta esta activa y actualizandose" : "La ruta aun no ha empezado")
    );
  });

  // Cuando el espectador entra por primera vez y recibe el estado inicial
  socketRutaCompartida.on("ruta:estado_inicial", (sesion) => {
    // Se aplica ese primer estado
    aplicarEstadoRecibidoDeSesion(sesion);
    // Se deja un mensaje adaptado a la situacion
    ponerEstadoGeneralRutaCompartida(
      sesion.finalizada
        ? "Entraste a una ruta que ya ha terminado"
        : (sesion.activa ? "Seguimiento cargado correctamente" : "La ruta aun no ha empezado")
    );
  });

  // Cuando la ruta termina para todos
  socketRutaCompartida.on("ruta:finalizada", (sesion) => {
    // Se aplica el estado final
    aplicarEstadoRecibidoDeSesion(sesion);
    // Se marca el estado general como cerrado
    ponerEstadoGeneralRutaCompartida("La sesion compartida ha terminado");
    // Se informa tambien en el bloque de mensajes
    textoEstadoMensajesEl.textContent = "La ruta termino y ya no puedes enviar mensajes";
  });

  // Cuando llega un error funcional desde el servidor
  socketRutaCompartida.on("ruta:error", (payload) => {
    // Se toma el mensaje recibido o uno generico
    const mensaje = payload?.mensaje || "Ha ocurrido un error en la sesion compartida";
    // Se guarda como estado general
    ponerEstadoGeneralRutaCompartida(mensaje);
    // Y tambien se ensena en el bloque de mensajes
    textoEstadoMensajesEl.textContent = mensaje;
  });
}

// Conecta los eventos de la interfaz
function registrarEventosDeInterfaz() {
  // Se hace que el boton envie el mensaje al pulsarlo
  botonEnviarMensajeEspectadorEl.addEventListener("click", enviarMensajeDelEspectador);
}

// Ajusta la pantalla al modo espectador
function aplicarModoEspectadorEnInterfaz() {
  // Se cambia la insignia superior
  insigniaModoEl.textContent = "Modo espectador";
  // Se asegura que el panel principal esta visible
  panelEspectadorEl.classList.remove("oculto");
  // Se deja un mensaje inicial mientras conecta
  ponerEstadoGeneralRutaCompartida(`Conectando al seguimiento ${codigoObservado || "sin codigo"}...`);
}

// Arranque principal de la vista compartida
function iniciarAplicacionRutaCompartida() {
  // Se deja la interfaz en modo espectador
  aplicarModoEspectadorEnInterfaz();
  // Se inicializa el mapa
  iniciarMapaRutaCompartida();
  // Se rellena el panel lateral con el estado inicial
  refrescarResumenVisible();
  // Se registran los eventos del socket
  registrarEventosDeSocket();
  // Se registran los eventos de la interfaz
  registrarEventosDeInterfaz();

  // Si cambia el tamano de pantalla o la orientacion, se vuelve a calcular el mapa
  window.addEventListener("resize", () => {
    if (!mapaRutaCompartida) return;
    mapaRutaCompartida.invalidateSize();
  });

  // En algunos moviles la pagina vuelve desde cache visual y el mapa queda sin recalcular
  window.addEventListener("pageshow", () => {
    if (!mapaRutaCompartida) return;
    mapaRutaCompartida.invalidateSize();
  });
}

// Punto de entrada del archivo
iniciarAplicacionRutaCompartida();
