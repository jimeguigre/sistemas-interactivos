// Importa el módulo HTTPS de Node para crear un servidor seguro
import https from "https";

// Importa FS para leer archivos del sistema, en este caso los certificados
import fs from "fs";

// Importa PATH para construir rutas de archivos correctamente
import path from "path";

// Importa Express para servir la web y rutas HTTP
import express from "express";

// Importa el servidor de Socket.IO para comunicación en tiempo real
import { Server } from "socket.io";

// Importa utilidades para obtener la ruta real del archivo actual en módulos ES
import { fileURLToPath } from "url";

// Importa randomUUID para generar IDs únicos para cada aviso
import { randomUUID } from "crypto";

// Convierte la URL del archivo actual a una ruta normal del sistema
const __filename = fileURLToPath(import.meta.url);

// Obtiene la carpeta donde está este archivo
const __dirname = path.dirname(__filename);

// Carga la clave privada y el certificado del servidor HTTPS
const options = {
  // Lee la clave privada .key
  key: fs.readFileSync(path.join(__dirname, "certificados", "MiServidorHTTPS.key")),

  // Lee el certificado .crt
  cert: fs.readFileSync(path.join(__dirname, "certificados", "MiServidorHTTPS.crt")),
};

// Crea la aplicación Express
const app = express();

// Crea el servidor HTTPS usando Express como manejador de peticiones
const server = https.createServer(options, app);

// Conecta Socket.IO al servidor HTTPS
const io = new Server(server);

// Define el puerto del servidor; si no hay variable de entorno usa 3000
const PORT = process.env.PORT || 3000;

// Sirve todos los archivos estáticos de la carpeta public
app.use(express.static(path.join(__dirname, "public")));

// Estructura en memoria para guardar avisos
// La clave será el id del aviso y el valor el objeto completo
const warnings = new Map();

// Se ejecuta cada vez que un cliente se conecta por Socket.IO
io.on("connection", (socket) => {
  // Muestra en consola el id del cliente conectado
  console.log(`Cliente conectado: ${socket.id}`);

  // Envía al cliente recién conectado todos los avisos actuales
  socket.emit("warnings:init", Array.from(warnings.values()));

  // Escucha cuando un cliente quiere crear un aviso
  socket.on("warning:create", (payload) => {
    // Convierte latitud a número
    const lat = Number(payload?.lat);

    // Convierte longitud a número
    const lng = Number(payload?.lng);

    // Convierte el mensaje a string y elimina espacios al principio y final
    const message = String(payload?.message || "").trim();

    // Si la latitud, longitud o mensaje no son válidos, no hace nada
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !message) return;

    // Construye el nuevo aviso
    const warning = {
      // ID único del aviso
      id: randomUUID(),

      // Latitud del aviso
      lat,

      // Longitud del aviso
      lng,

      // Texto del aviso
      message,

      // Marca temporal de creación
      timestamp: Date.now(),

      // Guarda quién creó el aviso usando el id del socket
      creatorClientId: socket.id
    };

    // Guarda el aviso en memoria
    warnings.set(warning.id, warning);

    // Lo envía a todos los clientes conectados en tiempo real
    io.emit("warning:created", warning);
  });

  // Escucha cuando un cliente quiere borrar un aviso
  socket.on("warning:delete", ({ id }) => {
    // Si no hay id o no existe ese aviso, no hace nada
    if (!id || !warnings.has(id)) return;

    // Elimina el aviso del mapa en memoria
    warnings.delete(id);

    // Informa a todos los clientes para que lo borren de la interfaz
    io.emit("warning:deleted", { id });
  });

  // Se ejecuta cuando un cliente se desconecta
  socket.on("disconnect", () => {
    // Muestra en consola el id del cliente desconectado
    console.log(`Cliente desconectado: ${socket.id}`);
  });
});

// Ruta de prueba sencilla para comprobar que el servidor responde
app.get("/hola", (_req, res) => {
  // Devuelve un texto simple en el navegador
  res.send("Servidor HTTPS con Express y Socket.IO funcionando");
});

// Arranca el servidor escuchando en todas las interfaces de red
server.listen(PORT, "0.0.0.0", () => {
  // Muestra por consola la URL local del servidor
  console.log(`Servidor HTTPS corriendo en https://localhost:${PORT}`);
});