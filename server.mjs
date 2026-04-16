// Modulos basicos del servidor
import https from "https";
import fs from "fs";
import path from "path";
import os from "os";
import express from "express";
import nodemailer from "nodemailer";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

// Ruta real del archivo actual
const __filename = fileURLToPath(import.meta.url);
// Carpeta donde vive este servidor
const __dirname = path.dirname(__filename);

// Certificados HTTPS del proyecto
const options = {
  // Clave privada del certificado
  key: fs.readFileSync(path.join(__dirname, "certificados", "MiServidorHTTPS.key")),
  // Certificado publico
  cert: fs.readFileSync(path.join(__dirname, "certificados", "MiServidorHTTPS.crt"))
};

// Aplicacion Express
const app = express();
// Servidor HTTPS real
const server = https.createServer(options, app);
// Socket.IO montado sobre el mismo servidor HTTPS
const io = new Server(server);
// Puerto por defecto
const PORT = process.env.PORT || 3000;
// Configuracion SMTP del proyecto para el envio real de emails.
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM;

// Transportador de correo real.
// apunta a una cuenta tecnica del proyecto
const transporterEmergencia = SMTP_HOST && SMTP_USER && SMTP_PASS
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    })
  : null;

// Evita saltos de linea en campos que acaban en cabeceras SMTP.
function limpiarCabeceraCorreo(texto, max = 160) {
  return String(texto || "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, max);
}

// Validacion sencilla para evitar destinatarios vacios o con formato peligroso.
function esEmailSimpleValido(email) {
  return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email);
}

function escaparHtml(texto) {
  return String(texto || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Se bloquea el acceso directo a la vista del espectador
// Esa pantalla debe abrirse solo con un codigo valido dentro de /seguimiento/:codigo
app.get("/index-ruta-compartida.html", (_req, res) => {
  res.redirect("/");
});

// Se sirve toda la carpeta public como contenido estatico
// Esto permite abrir HTML, CSS y JS directamente
app.use(express.static(path.join(__dirname, "public")));

// Avisos compartidos guardados en memoria
// Si el servidor se reinicia, se pierden
const warnings = new Map();

// Sesiones de compartir ruta guardadas en memoria
// Cada sesion representa un enlace de seguimiento
const sesionesCompartidas = new Map();
// Tiempo de margen para cortes breves de red antes de cerrar una ruta compartida.
const GRACIA_DESCONEXION_CONDUCTOR_MS = 45 * 1000;

// Busca una IP local IPv4 para construir el enlace compartido
function obtenerIpLocalPreferida() {
  // Se consultan todas las interfaces de red del equipo
  const interfaces = os.networkInterfaces();

  // Se recorren todas las listas de interfaces. Se incluye tambien el nombre para dar prioridades segun nombre (p. ej. Wi-Fi)
  for (const [name, listaInterfaces] of Object.entries(interfaces)) {
    // Si una lista no existe, se ignora
    if (!listaInterfaces) continue;

    // Se revisa cada interfaz concreta
    for (const interfaz of listaInterfaces) {
      // Solo interesa una IPv4 que no sea interna
      // Asi evitamos loopback o direcciones que no valen para compartir en red local
      if (interfaz.family !== "IPv4" || interfaz.internal) continue;

      // Preferencia por interfaces inalambricas

      // Prioridad Wi-Fi
      if (name.toLowerCase().includes('wi-fi')) {
          return interfaz.address; 
        }

      // Si no, se busca red que tenga en el nombre wlan, inalambrica o wireless
      if (name.toLowerCase().includes('wlan') || 
            name.toLowerCase().includes('inalámbrica') || 
            name.toLowerCase().includes('wireless')) {
          return interfaz.address; 
        }

      // Puede que tome la primera interfaz, llamada "Ethernet Ethernet" y que sirve a menudo de adaptador para maquina virtual
      // Se quiere evitar esta interfaz porque no es valida para la aplicacion
      // Suele ser 192.168.56.1, asi que se descarta si empieza por 192.168.56, se ignora
      if (!interfaz.address.startsWith('192.168.56.')) continue;
    }
  }

  // Si no aparece ninguna, se usa localhost como ultimo recurso
  return "127.0.0.1";
}

// Genera un codigo corto para una sesion compartida
function crearCodigoSesion() {
  // Se parte de un UUID completo
  // Se quitan los guiones
  // Se recorta para que sea facil de leer y compartir
  return randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

// Devuelve el nombre de la sala de Socket.IO de una sesion
function obtenerNombreSala(codigo) {
  return `ruta:${codigo}`;
}

// Limpia una geometria de ruta y se queda solo con puntos validos
function sanearCoordenadasRuta(coordenadasRuta) {
  // Si no llega una lista, se devuelve una vacia
  if (!Array.isArray(coordenadasRuta)) return [];

  // Se fuerzan latitud y longitud a numero
  // Luego se eliminan los puntos corruptos
  return coordenadasRuta
    .map((punto) => ({
      lat: Number(punto?.lat),
      lng: Number(punto?.lng)
    }))
    .filter((punto) => Number.isFinite(punto.lat) && Number.isFinite(punto.lng));
}

// Limpia una posicion suelta y devuelve null si no es usable
function sanearPosicion(posicion) {
  // Se convierten los dos campos a numero
  const lat = Number(posicion?.lat);
  const lng = Number(posicion?.lng);

  // Si alguno no es valido, la posicion no sirve
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  // Si todo esta bien, se devuelve la posicion limpia
  return { lat, lng };
}

// Prepara una copia simple de la sesion para mandarla al cliente
function resumirSesion(sesion, incluirPrivado = false) {
  // Si no hay sesion, se devuelve null
  if (!sesion) return null;

  // Solo se exponen los datos que necesita el cliente
  const resumen = {
    codigo: sesion.codigo,
    url: sesion.url,
    destinoTexto: sesion.destinoTexto,
    destinoLatLng: sesion.destinoLatLng,
    coordenadasRuta: sesion.coordenadasRuta,
    posicionActual: sesion.posicionActual,
    activa: sesion.activa,
    finalizada: sesion.finalizada,
    creadaEn: sesion.creadaEn
  };

  // El token privado solo se entrega al conductor.
  if (incluirPrivado) {
    resumen.conductorToken = sesion.conductorToken;
  }

  return resumen;
}

// Devuelve true si este socket puede gestionar la sesion como conductor.
function esConductorAutorizado(socket, sesion, payload = {}) {
  if (!sesion || sesion.finalizada) return false;
  if (sesion.conductorId === socket.id) return true;

  const conductorToken = String(payload?.conductorToken || "");
  if (!conductorToken || conductorToken !== sesion.conductorToken) return false;

  // Si el movil reconecto con otro socket, se reasocia la sesion.
  if (sesion.cierrePorDesconexion) {
    clearTimeout(sesion.cierrePorDesconexion);
    sesion.cierrePorDesconexion = null;
  }

  sesion.conductorId = socket.id;
  socket.data.codigoSesionPropia = sesion.codigo;
  socket.join(obtenerNombreSala(sesion.codigo));
  return true;
}

// Marca una sesion como terminada y avisa a todos los conectados a ella
function finalizarSesionCompartida(codigo, motivo = "Ruta finalizada") {
  // Se busca la sesion en memoria
  const sesion = sesionesCompartidas.get(codigo);

  // Si no existe, no hay nada que hacer
  if (!sesion) return;

  if (sesion.cierrePorDesconexion) {
    clearTimeout(sesion.cierrePorDesconexion);
    sesion.cierrePorDesconexion = null;
  }

  // Se cambia el estado para impedir nuevas actualizaciones
  sesion.activa = false;
  sesion.finalizada = true;
  sesion.motivoFinalizacion = motivo;

  // Se avisa a toda la sala de esta sesion
  // Aqui entran el conductor y cualquier espectador conectado
  io.to(obtenerNombreSala(codigo)).emit("ruta:finalizada", resumirSesion(sesion));

  // La sesion no se borra al momento
  // Se deja un margen por si alguien recarga justo despues o por depuracion
  setTimeout(() => {
    // Se relee por si durante ese tiempo hubiera cambiado algo
    const sesionActual = sesionesCompartidas.get(codigo);

    // Solo se borra si sigue marcada como finalizada
    if (sesionActual && sesionActual.finalizada) {
      sesionesCompartidas.delete(codigo);
    }
  }, 15 * 60 * 1000);
}

// Ruta simple para comprobar que el servidor esta vivo
app.get("/hola", (_req, res) => {
  res.send("Servidor HTTPS con Express y Socket.IO funcionando");
});

// Ruta que sirve la vista del espectador
app.get("/seguimiento/:codigo", (_req, res) => {
  // Siempre se sirve el HTML del seguimiento
  // El codigo concreto se procesa luego en el cliente y en Socket.IO
  res.sendFile(path.join(__dirname, "public", "index-ruta-compartida.html"));
});

// Toda la logica en tiempo real cuelga de aqui
io.on("connection", (socket) => {
  // Traza util para seguir conexiones nuevas
  console.log(`Cliente conectado: ${socket.id}`);

  // En cuanto un cliente entra, se le mandan los avisos ya existentes
  // Asi su interfaz arranca sincronizada con el resto
  socket.emit("warnings:init", Array.from(warnings.values()));

  // Crear un aviso nuevo
  socket.on("warning:create", (payload) => {
    // Se limpian los datos de entrada
    const lat = Number(payload?.lat);
    const lng = Number(payload?.lng);
    const message = String(payload?.message || "").trim();

    // Si falta algo o es invalido, no se guarda nada
    // Esto evita basura en memoria y avisos inconsistentes
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !message) return;

    // Se monta el aviso con la informacion necesaria
    const warning = {
      id: randomUUID(),
      lat,
      lng,
      message,
      timestamp: Date.now(),
      creatorClientId: socket.id
    };

    // Se guarda en memoria para nuevos clientes
    warnings.set(warning.id, warning);
    // Se emite a todos para actualizar los mapas en tiempo real
    io.emit("warning:created", warning);
  });

  // Borrar un aviso existente
  socket.on("warning:delete", ({ id }) => {
    // Si no hay id o no existe el aviso, se ignora
    if (!id || !warnings.has(id)) return;

    // Se borra de memoria
    warnings.delete(id);
    // Se avisa a todos para que lo quiten de su interfaz
    io.emit("warning:deleted", { id });
  });

  // Enviar un email real al contacto de emergencia
  socket.on("emergencia:enviar_email", async (payload = {}) => {
    try {
      // Si no hay correo configurado en servidor, no se puede enviar nada.
      if (!transporterEmergencia) {
        socket.emit("emergencia:email_error", {
          mensaje: "El servidor no tiene configurado el correo SMTP"
        });
        return;
      }

      // Se limpian los datos recibidos.
      const to = limpiarCabeceraCorreo(payload?.to, 320);
      const subject = limpiarCabeceraCorreo(payload?.subject || "Aviso de emergencia");
      const body = String(payload?.body || "").trim().slice(0, 8000);
      const contactName = limpiarCabeceraCorreo(payload?.contactName, 120);

      // Si faltan datos clave, se rechaza el envio.
      if (!esEmailSimpleValido(to) || !body) {
        socket.emit("emergencia:email_error", {
          mensaje: "Faltan datos para enviar el email de emergencia"
        });
        return;
      }

      // Se envia el correo real.
      await transporterEmergencia.sendMail({
        from: SMTP_FROM,
        to,
        subject,
        text: body,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <h2>Posible emergencia detectada en ruta</h2>
            <p><b>Contacto:</b> ${escaparHtml(contactName || "Sin nombre")}</p>
            <pre style="white-space: pre-wrap; font-family: Arial, sans-serif;">${escaparHtml(body)}</pre>
          </div>
        `
      });

      // Se confirma al cliente que el envio ha salido bien.
      socket.emit("emergencia:email_enviado", { ok: true });
    } catch (error) {
      console.error("Error enviando email de emergencia:", error);

      socket.emit("emergencia:email_error", {
        mensaje: "No se pudo enviar el email de emergencia"
      });
    }
  });

  // Crear una nueva sesion para compartir ruta
  socket.on("ruta:crear_comparticion", (payload = {}) => {
    // Se limpian los datos que manda el conductor
    const destinoTexto = String(payload?.destinoTexto || "").trim();
    const destinoLatLng = sanearPosicion(payload?.destinoLatLng);
    const coordenadasRuta = sanearCoordenadasRuta(payload?.coordenadasRuta);

    // Si falta destino o la ruta no trae geometria util, no se crea el enlace
    if (!destinoTexto || !destinoLatLng || coordenadasRuta.length === 0) {
      socket.emit("ruta:error", { mensaje: "No se pudo preparar el enlace porque la ruta no es valida" });
      return;
    }

    // Si este mismo conductor ya tenia una sesion abierta, se cierra antes
    // Asi evitamos que una misma persona deje varios enlaces vivos a la vez
    if (socket.data.codigoSesionPropia && sesionesCompartidas.has(socket.data.codigoSesionPropia)) {
      finalizarSesionCompartida(socket.data.codigoSesionPropia, "Se creo una nueva ruta compartida");
    }

    // Se crea el codigo de la nueva sesion
    const codigo = crearCodigoSesion();
    // Se obtiene una IP local valida para la red
    const ipLocal = obtenerIpLocalPreferida();
    // Se construye la URL completa que se compartira
    const url = `https://${ipLocal}:${PORT}/seguimiento/${codigo}`;

    // Se crea el objeto sesion con su estado inicial
    const sesion = {
      codigo,
      url,
      // Guardamos el socket del conductor para validar ownership mas tarde
      conductorId: socket.id,
      // Token privado para recuperar la sesion si el socket se reconecta
      conductorToken: randomUUID(),
      destinoTexto,
      destinoLatLng,
      coordenadasRuta,
      // La posicion inicial puede no estar lista todavia
      posicionActual: null,
      // La sesion existe, pero no se considera activa hasta que el conductor empiece a conducir
      activa: false,
      finalizada: false,
      creadaEn: Date.now(),
      cierrePorDesconexion: null
    };

    // Se guarda la sesion en memoria
    sesionesCompartidas.set(codigo, sesion);
    // Se recuerda en el socket cual es la sesion propia del conductor
    // Esto permite actualizarla despues aunque no mande siempre el codigo
    socket.data.codigoSesionPropia = codigo;
    // El conductor entra en la sala de su propia sesion
    // Asi recibe los mismos eventos de esa sala si hace falta
    socket.join(obtenerNombreSala(codigo));
    // Se devuelve al conductor la sesion creada
    socket.emit("ruta:comparticion_creada", resumirSesion(sesion, true));
  });

  // Recuperar una sesion propia despues de una reconexion breve del movil
  socket.on("ruta:recuperar_conductor", (payload = {}) => {
    const codigo = String(payload?.codigo || "").trim().toUpperCase();
    const sesion = sesionesCompartidas.get(codigo);

    if (!esConductorAutorizado(socket, sesion, payload)) {
      socket.emit("ruta:error", { mensaje: "No se pudo recuperar la sesion compartida" });
      return;
    }

    socket.emit("ruta:estado", resumirSesion(sesion, true));
  });

  // Actualizar una sesion compartida cuando cambie la ruta
  socket.on("ruta:actualizar_comparticion", (payload = {}) => {
    // Se intenta localizar la sesion usando el codigo recibido o el codigo guardado en el socket
    const codigo = String(payload?.codigo || socket.data.codigoSesionPropia || "");
    const sesion = sesionesCompartidas.get(codigo);

    // Solo el conductor duenyo de la sesion puede modificarla
    // Esto evita que otro cliente altere una sesion ajena
    if (!esConductorAutorizado(socket, sesion, payload)) {
      socket.emit("ruta:error", { mensaje: "No se encontro la sesion compartida que intentabas actualizar" });
      return;
    }

    // Se limpian los nuevos datos
    const destinoTexto = String(payload?.destinoTexto || sesion.destinoTexto || "").trim();
    const destinoLatLng = sanearPosicion(payload?.destinoLatLng) || sesion.destinoLatLng;
    const coordenadasRuta = sanearCoordenadasRuta(payload?.coordenadasRuta);

    // Solo se reemplaza lo que llegue bien
    if (coordenadasRuta.length > 0) {
      // Si hay una geometria nueva valida, sustituye a la anterior
      sesion.coordenadasRuta = coordenadasRuta;
    }
    if (destinoTexto) {
      // Si hay un nuevo texto de destino, se actualiza
      sesion.destinoTexto = destinoTexto;
    }
    if (destinoLatLng) {
      // Si llega un destino geografico valido, se actualiza
      sesion.destinoLatLng = destinoLatLng;
    }

    // Se emite el nuevo estado a toda la sala
    // Esto hace que el espectador vea recalculos y cambios casi al momento
    io.to(obtenerNombreSala(codigo)).emit("ruta:estado", resumirSesion(sesion));
  });

  // Marcar una sesion como iniciada cuando empieza la conduccion
  socket.on("ruta:iniciar", (payload = {}) => {
    // Se localiza la sesion del conductor
    const codigo = String(payload?.codigo || socket.data.codigoSesionPropia || "");
    const sesion = sesionesCompartidas.get(codigo);

    // Solo el conductor propietario puede activarla
    if (!esConductorAutorizado(socket, sesion, payload)) {
      socket.emit("ruta:error", { mensaje: "No se pudo iniciar la sesion compartida" });
      return;
    }

    // Se limpia la posicion recibida
    const posicionActual = sanearPosicion(payload?.posicionActual);
    // Si la posicion es valida, se guarda para el primer render del espectador
    if (posicionActual) sesion.posicionActual = posicionActual;

    // La sesion ya pasa a estar activa
    sesion.activa = true;
    // Y se asegura que no quede como finalizada por un estado anterior
    sesion.finalizada = false;

    // Se emite el nuevo estado a todos los conectados
    io.to(obtenerNombreSala(codigo)).emit("ruta:estado", resumirSesion(sesion));
  });

  // Actualizar la posicion del conductor en tiempo real
  socket.on("ruta:actualizar_posicion", (payload = {}) => {
    // Se busca la sesion que el conductor esta moviendo
    const codigo = String(payload?.codigo || socket.data.codigoSesionPropia || "");
    const sesion = sesionesCompartidas.get(codigo);

    // Si la sesion no existe, no es suya o ya termino, no se actualiza nada
    // Esto evita mover rutas cerradas o ajenas
    if (!esConductorAutorizado(socket, sesion, payload)) return;

    // Se limpia la nueva posicion
    const posicionActual = sanearPosicion(payload?.posicionActual);
    // Si no es valida, se ignora
    if (!posicionActual) return;

    // Se guarda la posicion mas reciente
    sesion.posicionActual = posicionActual;
    // Se emite a toda la sala para que el espectador vea moverse al conductor
    io.to(obtenerNombreSala(codigo)).emit("ruta:estado", resumirSesion(sesion));
  });

  // Finalizar una sesion cuando el conductor sale de conduccion
  socket.on("ruta:finalizar", (payload = {}) => {
    // Se localiza la sesion actual
    const codigo = String(payload?.codigo || socket.data.codigoSesionPropia || "");
    const sesion = sesionesCompartidas.get(codigo);

    // Solo el conductor propietario puede cerrarla
    if (!esConductorAutorizado(socket, sesion, payload)) {
      socket.emit("ruta:error", { mensaje: "No se pudo finalizar la sesion compartida" });
      return;
    }

    // Se marca como terminada y se avisa a todos
    finalizarSesionCompartida(codigo, "El conductor salio de la conduccion");
    // Se borra la referencia local para que este socket no siga tocando esa sesion
    socket.data.codigoSesionPropia = null;
  });

  // Unir a un espectador a la sesion del enlace
  socket.on("ruta:unirse_espectador", (payload = {}) => {
    // Se limpia el codigo recibido desde la URL
    const codigo = String(payload?.codigo || "").trim().toUpperCase();
    const sesion = sesionesCompartidas.get(codigo);

    // Si no existe, puede ser un enlace viejo, mal escrito o ya limpiado
    if (!sesion) {
      socket.emit("ruta:error", { mensaje: "No existe una ruta activa o reciente para ese enlace" });
      return;
    }

    // Se recuerda que este cliente esta observando esta sesion
    // Esto luego sirve para mandar mensajes sin reenviar siempre el codigo
    socket.data.codigoSesionObservada = codigo;
    // Se mete al espectador en la sala correcta
    socket.join(obtenerNombreSala(codigo));
    // Nada mas entrar recibe el estado actual completo
    // Asi puede ver la ruta aunque llegue a mitad del trayecto
    socket.emit("ruta:estado_inicial", resumirSesion(sesion));
  });

  // Reenviar un mensaje del espectador al conductor
  socket.on("ruta:mensaje_espectador", (payload = {}) => {
    // Se localiza la sesion observada
    const codigo = String(payload?.codigo || socket.data.codigoSesionObservada || "").trim().toUpperCase();
    const sesion = sesionesCompartidas.get(codigo);
    // Se limpia el texto y se limita su tamano
    // El recorte evita mensajes demasiado largos para la lectura por voz
    const texto = String(payload?.texto || "").trim().slice(0, 220);

    // Si la sesion ya no existe, se informa del error
    if (!sesion) {
      socket.emit("ruta:error", { mensaje: "La sesion ya no existe" });
      return;
    }

    // Si la ruta ya termino, no se aceptan mas mensajes
    if (sesion.finalizada) {
      socket.emit("ruta:error", { mensaje: "La ruta ya termino y no admite mas mensajes" });
      return;
    }

    // Si no hay texto real, tambien se rechaza
    if (!texto) {
      socket.emit("ruta:error", { mensaje: "No puedes enviar un mensaje vacio" });
      return;
    }

    // El mensaje se manda solo al conductor de esa sesion
    // No se reenvia a otros espectadores ni se guarda en memoria
    io.to(sesion.conductorId).emit("ruta:mensaje_para_conductor", {
      codigo,
      texto,
      momento: Date.now()
    });
  });

  // Que hacer cuando un cliente se desconecta
  socket.on("disconnect", () => {
    // Se deja un rastro util en consola
    console.log(`Cliente desconectado: ${socket.id}`);

    // Si quien se desconecta era un conductor, se espera por si vuelve enseguida.
    if (socket.data.codigoSesionPropia && sesionesCompartidas.has(socket.data.codigoSesionPropia)) {
      const codigo = socket.data.codigoSesionPropia;
      const sesion = sesionesCompartidas.get(codigo);

      if (sesion && sesion.conductorId === socket.id && !sesion.finalizada) {
        if (sesion.cierrePorDesconexion) clearTimeout(sesion.cierrePorDesconexion);

        sesion.cierrePorDesconexion = setTimeout(() => {
          const sesionActual = sesionesCompartidas.get(codigo);

          if (sesionActual && sesionActual.conductorId === socket.id && !sesionActual.finalizada) {
            finalizarSesionCompartida(codigo, "El conductor se desconecto");
          }
        }, GRACIA_DESCONEXION_CONDUCTOR_MS);
      }
    }

    // Si era un espectador, no hace falta limpiar nada extra
    // Al cerrarse el socket deja de estar en su sala automaticamente
  });
});

// Arranque final del servidor
server.listen(PORT, "0.0.0.0", () => {
  // Se muestra la URL local que se podra usar dentro de la misma red
  console.log(`Servidor HTTPS corriendo en https://${obtenerIpLocalPreferida()}:${PORT}`);
});
