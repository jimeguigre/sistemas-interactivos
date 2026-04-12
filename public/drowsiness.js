// IMPORTACIÓN DE MEDIAPIPE

// Se importan las clases necesarias de MediaPipe Tasks Vision.
// FilesetResolver carga los recursos base WASM y FaceLandmarker detecta landmarks faciales.
import {
  FaceLandmarker,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";


// CONFIGURACIÓN GENERAL


// Se usa la misma clave de localStorage que en app.js para compartir el estado de permisos.
const CLAVE_PRIVACIDAD = "avisos_nav_privacidad_v10";

// Elementos del modal del detector de somnolencia.
const modalSomnolenciaEl = document.getElementById("modalSomnolencia");
const camaraSomnolenciaEl = document.getElementById("camaraSomnolencia");
const lienzoSomnolenciaEl = document.getElementById("lienzoSomnolencia");

// Contexto 2D del canvas, necesario para dibujar landmarks encima del vídeo.
const ctxSomnolencia = lienzoSomnolenciaEl.getContext("2d");

// Elementos donde se muestran métricas y estado del detector.
const estadoSomnolenciaEl = document.getElementById("estadoSomnolencia");
const earIzquierdoEl = document.getElementById("earIzquierdo");
const earDerechoEl = document.getElementById("earDerecho");
const tiempoOjosCerradosEl = document.getElementById("tiempoOjosCerrados");
const valorUmbralSomnolenciaEl = document.getElementById("valorUmbralSomnolencia");
const valorTiempoSomnolenciaEl = document.getElementById("valorTiempoSomnolencia");

// Umbral de Eye Aspect Ratio por debajo del cual se considera que el ojo está cerrado.
// Cuanto más bajo sea este valor, más cerrado tiene que estar el ojo para detectarlo y al revés.
const UMBRAL_OJO_CERRADO = 0.21;

// Tiempo que ambos ojos deben permanecer cerrados para activar la alerta de somnolencia.
const TIEMPO_ALERTA_SOMNOLENCIA_MS = 1500;

// Se muestran estos valores en la interfaz para que el usuario vea la configuración actual.
valorUmbralSomnolenciaEl.innerText = UMBRAL_OJO_CERRADO.toFixed(2);
valorTiempoSomnolenciaEl.innerText = `${TIEMPO_ALERTA_SOMNOLENCIA_MS} ms`;


// ESTADO INTERNO DEL DETECTOR


// Instancia del detector de cara de MediaPipe.
// Empieza en null porque aún no se ha cargado el modelo.
let detectorCara = null;
// Evita recargar el modelo varias veces a lo largo de la sesión.
let modeloCargado = false;
// Indica si el detector está activo de verdad y debe seguir procesando frames.
let detectorActivo = false;
// Guarda el instante en que se detectó por primera vez que ambos ojos estaban cerrados.
// Se usa para medir duración del cierre de ojos.
let ojosCerradosDesde = null;
// Guarda el currentTime del último frame de vídeo procesado.
// Sirve para no analizar dos veces el mismo frame si requestAnimationFrame va más rápido.
let ultimoVideoTime = -1;
// Stream real de la cámara frontal del dispositivo.
let streamCamara = null;
// ID del requestAnimationFrame activo, para poder cancelarlo al detener el detector.
let rafId = null;
// Contexto de audio usado para generar pitidos sin cargar archivos de sonido.
let audioContext = null;
// Intervalo usado para repetir la alarma mientras persiste el estado de alerta.
let intervaloAlarma = null;
// Si vale true, la alarma sonora no debe sonar, normalmente por la orientación del dispositivo.
let alarmaSilenciadaPorOrientacion = false;


// LANDMARKS DE LOS OJOS


// Índices de MediaPipe que corresponden a 6 puntos del ojo izquierdo.
// Esos 6 puntos se usan para calcular el EAR.
const OJO_IZQUIERDO = [33, 160, 158, 133, 153, 144];
// Índices equivalentes del ojo derecho.
const OJO_DERECHO = [362, 385, 387, 263, 373, 380];


// PRIVACIDAD COMPARTIDA CON app.js


// Lee desde localStorage si el usuario tiene cámara permitida y si el detector se dejó encendido.
// Este módulo no decide permisos por sí mismo: consulta el estado guardado por la app principal.
function cargarPrivacidad() {
  try {
    const raw = localStorage.getItem(CLAVE_PRIVACIDAD);

    // Si no hay nada guardado, se asume el estado más seguro: sin cámara y detector apagado.
    if (!raw) return { camara: false, somnolenciaEncendida: false };

    const datos = JSON.parse(raw);

    // Solo se devuelve lo que este módulo necesita realmente.
    return {
      camara: !!datos.camara,
      somnolenciaEncendida: !!datos.somnolenciaEncendida
    };
  } catch {
    // Si localStorage está corrupto o el JSON falla, se vuelve a un estado seguro por defecto.
    return { camara: false, somnolenciaEncendida: false };
  }
}


// ESTADO VISUAL DEL DETECTOR


// Actualiza el texto de estado y la clase CSS asociada.
// La clase se usa para colorear el estado como ok, warning o alerta.
function ponerEstadoSomnolencia(texto, clase = "") {
  estadoSomnolenciaEl.textContent = texto;
  estadoSomnolenciaEl.className = `estadoSomnolencia ${clase}`.trim();
}


// ORIENTACIÓN


// Comprueba si el dispositivo está en vertical.
// En este proyecto se usa para silenciar la alarma si la orientación no es la esperada.
function esVertical() {
  return window.innerHeight > window.innerWidth;
}


// AUDIO Y ALARMA


// Crea el contexto de audio la primera vez que se necesite.
// Se usa Web Audio para generar pitidos de forma programática.
function iniciarAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
}

// Intenta reanudar el contexto de audio tras interacción del usuario.
// Muchos navegadores bloquean el audio hasta que el usuario toca o pulsa algo.
async function desbloquearAudio() {
  try {
    iniciarAudio();

    // Si el contexto está suspendido, se intenta activarlo.
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
  } catch {}
}

// Genera un pitido corto.
// No usa archivos externos: crea una onda senoidal y un envolvente de ganancia.
function beep() {
  // Sin contexto de audio no puede sonar nada.
  if (!audioContext) return;

  // Si la alarma está silenciada, no se emite el pitido.
  if (alarmaSilenciadaPorOrientacion) return;

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  // Onda senoidal simple y relativamente aguda para que sea claramente audible.
  oscillator.type = "sine";
  oscillator.frequency.value = 880;

  // El oscilador se conecta al nodo de ganancia y luego a la salida.
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // Se aplica una envolvente corta al volumen para que el pitido no suene brusco.
  gainNode.gain.setValueAtTime(0.001, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.15, audioContext.currentTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.25);

  // El pitido empieza y se detiene muy poco después.
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.25);
}

// Arranca la alarma repetitiva si aún no estaba activa.
async function iniciarAlarma() {
  try {
    // Primero se intenta asegurar que el audio esté desbloqueado.
    await desbloquearAudio();

    // Si la orientación obliga a silencio, no se arranca.
    if (alarmaSilenciadaPorOrientacion) return;

    // Si ya existe un intervalo de alarma, no se crea otro.
    if (intervaloAlarma) return;

    // Se lanza un pitido inicial y luego se repite cada 700 ms.
    beep();
    intervaloAlarma = setInterval(beep, 700);
  } catch {}
}

// Detiene por completo la alarma repetitiva.
function pararAlarma() {
  if (intervaloAlarma) {
    clearInterval(intervaloAlarma);
    intervaloAlarma = null;
  }
}

// Recalcula si la alarma debe estar silenciada según la orientación actual.
function actualizarSilencioPorOrientacion() {
  const vertical = esVertical();
  alarmaSilenciadaPorOrientacion = vertical;

  // Si se entra en vertical, se detiene inmediatamente cualquier alarma que esté sonando.
  if (vertical) {
    pararAlarma();
  }
}

// Se intenta desbloquear el audio con el primer click del usuario.
window.addEventListener("click", desbloquearAudio, { once: true });

// También se intenta desbloquear con la primera pulsación de teclado.
window.addEventListener("keydown", desbloquearAudio, { once: true });



// CARGA DEL MODELO MEDIAPIPE


// Carga y crea el detector facial solo una vez.
// Así no se vuelve a descargar ni inicializar el modelo cada vez que se enciende el detector.
async function asegurarModeloCargado() {
  if (modeloCargado) return;

  ponerEstadoSomnolencia("Cargando modelo...");

  // Carga los recursos base WASM necesarios para MediaPipe Tasks Vision.
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );

  // Crea el detector con configuración adaptada a vídeo en tiempo real.
  detectorCara = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      // Modelo preentrenado de landmarks faciales.
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",

      // Se intenta usar GPU para mejorar rendimiento en tiempo real.
      delegate: "GPU"
    },

    // El detector trabajará sobre vídeo, no sobre imagen fija.
    runningMode: "VIDEO",

    // Solo interesa la cara principal del conductor.
    numFaces: 1
  });

  modeloCargado = true;
}



// CÁMARA


// Solicita acceso a la cámara frontal y conecta el stream al elemento <video>.
async function iniciarCamara() {
  // Si la cámara ya estaba abierta, no se solicita otra vez.
  if (streamCamara) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        // Se prioriza la cámara delantera del dispositivo.
        facingMode: { ideal: "user" },

        // Se pide una resolución razonable para que el detector tenga suficiente calidad.
        width: { ideal: 1280 },
        height: { ideal: 720 },

        // Se sugiere una proporción panorámica, útil en horizontal.
        aspectRatio: { ideal: 16 / 9 }
      },
      audio: false
    });

    streamCamara = stream;
    camaraSomnolenciaEl.srcObject = stream;

    // Se espera a que el navegador conozca metadatos como el tamaño real del vídeo.
    await new Promise((resolve) => {
      camaraSomnolenciaEl.onloadedmetadata = () => resolve();
    });

    // Se intenta reproducir el vídeo; si falla, el catch superior se encargará.
    await camaraSomnolenciaEl.play().catch(() => {});

    // Una vez el vídeo está listo, se ajusta el canvas al tamaño visible.
    ajustarCanvasAlVideo();
  } catch (error) {
    ponerEstadoSomnolencia("No se pudo acceder a la cámara", "alerta");
    throw error;
  }
}

// Cierra la cámara y libera los recursos del stream.
function pararCamara() {
  if (streamCamara) {
    // Se paran todos los tracks del stream para apagar físicamente la cámara.
    streamCamara.getTracks().forEach(track => track.stop());
    streamCamara = null;
  }

  // Se desconecta el vídeo del stream.
  camaraSomnolenciaEl.srcObject = null;
}



// CANVAS Y COORDENADAS DE DIBUJO


// Ajusta el canvas al tamaño real con el que se está viendo el vídeo.
function ajustarCanvasAlVideo() {
  // Si el modal está cerrado, no hace falta recalcular el canvas.
  if (!modalSomnolenciaEl.classList.contains("abierto")) return;

  const rect = camaraSomnolenciaEl.getBoundingClientRect();

  // Si aún no hay dimensiones visibles válidas, se sale.
  if (!rect.width || !rect.height) return;

  const dpr = window.devicePixelRatio || 1;

  // La resolución interna del canvas se multiplica por el pixel ratio para que se vea nítido.
  lienzoSomnolenciaEl.width = Math.round(rect.width * dpr);
  lienzoSomnolenciaEl.height = Math.round(rect.height * dpr);

  // Pero el tamaño visual CSS se mantiene igual que el del vídeo.
  lienzoSomnolenciaEl.style.width = `${rect.width}px`;
  lienzoSomnolenciaEl.style.height = `${rect.height}px`;

  // Se resetea cualquier transformación anterior.
  ctxSomnolencia.setTransform(1, 0, 0, 1, 0, 0);

  // Se reescala el contexto para trabajar en coordenadas CSS aunque el canvas tenga más resolución interna.
  ctxSomnolencia.scale(dpr, dpr);
}

// Calcula el rectángulo exacto en el que el vídeo se está dibujando dentro del contenedor.
// Esto es importante porque con object-fit: contain puede haber márgenes arriba/abajo o a los lados.
function obtenerRectanguloVideoRenderizado() {
  const contW = camaraSomnolenciaEl.clientWidth;
  const contH = camaraSomnolenciaEl.clientHeight;
  const vidW = camaraSomnolenciaEl.videoWidth || 1;
  const vidH = camaraSomnolenciaEl.videoHeight || 1;

  // Se calcula la escala mínima para que quepa sin deformarse.
  const escala = Math.min(contW / vidW, contH / vidH);
  const drawW = vidW * escala;
  const drawH = vidH * escala;

  // Se calculan los márgenes internos para centrar el vídeo.
  const offsetX = (contW - drawW) / 2;
  const offsetY = (contH - drawH) / 2;

  return { offsetX, offsetY, drawW, drawH };
}



// ARRANQUE Y PARADA DEL DETECTOR


// Enciende todo el detector si permisos y estado lo permiten.
async function iniciarDetectorSomnolencia() {
  const privacidad = cargarPrivacidad();

  // Sin permiso de cámara no tiene sentido continuar.
  if (!privacidad.camara) {
    ponerEstadoSomnolencia("La cámara está desactivada. Actívala en Privacidad", "warning");
    return;
  }

  // Si el usuario dejó el detector apagado, también se respeta.
  if (!privacidad.somnolenciaEncendida) {
    ponerEstadoSomnolencia("Detector apagado");
    return;
  }

  // Se actualiza el estado de silencio según la orientación actual.
  actualizarSilencioPorOrientacion();

  // Si ya estaba activo, no se rearma todo; solo se reajusta el canvas si el modal está abierto.
  if (detectorActivo) {
    if (modalSomnolenciaEl.classList.contains("abierto")) {
      setTimeout(ajustarCanvasAlVideo, 60);
    }
    return;
  }

  try {
    detectorActivo = true;

    // Se limpian valores visuales anteriores.
    resetearSomnolencia();

    // Se asegura que el modelo esté cargado.
    await asegurarModeloCargado();

    // Se abre la cámara si aún no lo estaba.
    await iniciarCamara();

    ponerEstadoSomnolencia("Detector activo en segundo plano", "ok");

    // Se resetea el control de frame procesado.
    ultimoVideoTime = -1;

    // Se arranca el bucle principal de análisis.
    analizarFrame();
  } catch {
    detectorActivo = false;
  }
}

// Apaga completamente el detector y limpia recursos.
function detenerDetectorSomnolencia() {
  detectorActivo = false;
  pararAlarma();
  pararCamara();

  // Si el bucle estaba activo, se cancela.
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  // Se resetea el control del último frame visto.
  ultimoVideoTime = -1;

  // Se limpia el canvas para que no queden landmarks dibujados.
  ctxSomnolencia.clearRect(0, 0, lienzoSomnolenciaEl.width, lienzoSomnolenciaEl.height);

  resetearSomnolencia();
  ponerEstadoSomnolencia("Detector detenido");
}



// BUCLE PRINCIPAL DE ANÁLISIS


// Función que se llama a sí misma con requestAnimationFrame para analizar vídeo continuamente.
function analizarFrame() {
  // Si el detector ya no está activo, no se sigue procesando.
  if (!detectorActivo) return;

  // Si el detector aún no está listo o el vídeo no tiene datos suficientes, se reintenta en el siguiente frame.
  if (!detectorCara || camaraSomnolenciaEl.readyState < 2) {
    rafId = requestAnimationFrame(analizarFrame);
    return;
  }

  const ahoraMs = performance.now();

  // Solo se analiza si el vídeo ha avanzado respecto al último frame ya procesado.
  // Esto evita recalcular varias veces exactamente la misma imagen.
  if (camaraSomnolenciaEl.currentTime !== ultimoVideoTime) {
    ultimoVideoTime = camaraSomnolenciaEl.currentTime;

    // MediaPipe analiza el frame actual del vídeo y devuelve landmarks faciales.
    const resultado = detectorCara.detectForVideo(camaraSomnolenciaEl, ahoraMs);

    // Si el visor está abierto, se limpia el canvas para redibujar sobre el frame nuevo.
    if (modalSomnolenciaEl.classList.contains("abierto")) {
      ajustarCanvasAlVideo();
      ctxSomnolencia.clearRect(
        0,
        0,
        lienzoSomnolenciaEl.clientWidth,
        lienzoSomnolenciaEl.clientHeight
      );
    }

    // Si se detectó al menos una cara, se usa la primera.
    if (resultado.faceLandmarks && resultado.faceLandmarks.length > 0) {
      const landmarks = resultado.faceLandmarks[0];

      // Solo se dibujan puntos y líneas si la ventana visual está abierta.
      if (modalSomnolenciaEl.classList.contains("abierto")) {
        dibujarLandmarksOjos(landmarks);
      }

      // La lógica de somnolencia sí se ejecuta siempre, aunque el visor esté cerrado.
      analizarSomnolencia(landmarks, ahoraMs);
    } else {
      // Si no se detecta ninguna cara, se resetea el estado y se apaga la alarma.
      resetearSomnolencia();
      pararAlarma();
      ponerEstadoSomnolencia("Buscando cara...");
    }
  }

  // Se programa el siguiente frame del bucle.
  rafId = requestAnimationFrame(analizarFrame);
}



// LÓGICA DE SOMNOLENCIA


// Usa los landmarks faciales para decidir si hay signos de somnolencia.
function analizarSomnolencia(landmarks, ahoraMs) {
  // Se extraen los puntos concretos de cada ojo a partir de los índices definidos arriba.
  const puntosOjoIzq = OJO_IZQUIERDO.map(index => landmarks[index]);
  const puntosOjoDer = OJO_DERECHO.map(index => landmarks[index]);

  // Se calcula el EAR de ambos ojos.
  const earIzq = calcularEAR(...puntosOjoIzq);
  const earDer = calcularEAR(...puntosOjoDer);

  // Se muestran en interfaz con 3 decimales.
  earIzquierdoEl.innerText = earIzq.toFixed(3);
  earDerechoEl.innerText = earDer.toFixed(3);

  // Solo se considera cierre real si ambos ojos están por debajo del umbral.
  const ambosCerrados = earIzq < UMBRAL_OJO_CERRADO && earDer < UMBRAL_OJO_CERRADO;

  if (ambosCerrados) {
    // Si es el primer frame detectado como cerrado, se guarda el instante inicial.
    if (ojosCerradosDesde === null) ojosCerradosDesde = ahoraMs;

    const duracion = ahoraMs - ojosCerradosDesde;
    tiempoOjosCerradosEl.innerText = `${Math.round(duracion)} ms`;

    // Si la duración supera el umbral temporal, se considera alerta de somnolencia.
    if (duracion >= TIEMPO_ALERTA_SOMNOLENCIA_MS) {
      if (alarmaSilenciadaPorOrientacion) {
        // Si la orientación obliga a silencio, se muestra alerta pero sin sonido.
        ponerEstadoSomnolencia("ALERTA en silencio por orientación", "warning");
        pararAlarma();
      } else {
        // Alerta completa con texto y sonido.
        ponerEstadoSomnolencia("ALERTA: posible somnolencia", "alerta");
        iniciarAlarma();
      }
    } else {
      // Todavía no ha pasado suficiente tiempo como para alertar seriamente.
      ponerEstadoSomnolencia("Ojos cerrados...", "warning");
      pararAlarma();
    }
  } else {
    // Si los ojos se han vuelto a abrir, se reinicia el contador de cierre.
    ojosCerradosDesde = null;
    tiempoOjosCerradosEl.innerText = "0 ms";
    ponerEstadoSomnolencia("Ojos abiertos", "ok");
    pararAlarma();
  }
}



// CÁLCULO DEL EAR


// Calcula distancia euclídea 3D entre dos landmarks.
// MediaPipe da x, y y z normalizados, así que se usa la distancia completa.
function distancia(a, b) {
  return Math.sqrt(
    (a.x - b.x) ** 2 +
    (a.y - b.y) ** 2 +
    (a.z - b.z) ** 2
  );
}

// Calcula el Eye Aspect Ratio a partir de 6 puntos del ojo.
// La idea es comparar apertura vertical respecto al ancho horizontal del ojo.
function calcularEAR(p1, p2, p3, p4, p5, p6) {
  const vertical1 = distancia(p2, p6);
  const vertical2 = distancia(p3, p5);
  const horizontal = distancia(p1, p4);

  // Si el ancho sale 0 por un caso raro, se evita dividir entre cero.
  if (horizontal === 0) return 0;

  return (vertical1 + vertical2) / (2 * horizontal);
}



// DIBUJO DE LANDMARKS


// Dibuja ambos ojos para depuración visual.
function dibujarLandmarksOjos(landmarks) {
  dibujarUnOjo(OJO_IZQUIERDO, landmarks, "cyan");
  dibujarUnOjo(OJO_DERECHO, landmarks, "lime");
}

// Dibuja los puntos y el contorno de un ojo concreto.
function dibujarUnOjo(indices, landmarks, color) {
  // Primero se pintan los puntos.
  indices.forEach(index => dibujarPunto(landmarks[index], color));

  // Luego se conectan en orden para visualizar la forma del ojo.
  for (let i = 0; i < indices.length; i++) {
    const actual = landmarks[indices[i]];
    const siguiente = landmarks[indices[(i + 1) % indices.length]];
    dibujarLinea(actual, siguiente, color);
  }
}

// Convierte un punto normalizado del sistema de MediaPipe a coordenadas del canvas visible.
function convertirPuntoVideoACanvas(point) {
  const { offsetX, offsetY, drawW, drawH } = obtenerRectanguloVideoRenderizado();

  return {
    x: offsetX + point.x * drawW,
    y: offsetY + point.y * drawH
  };
}

// Dibuja un punto circular en el canvas.
function dibujarPunto(point, color = "red") {
  const p = convertirPuntoVideoACanvas(point);

  ctxSomnolencia.beginPath();
  ctxSomnolencia.arc(p.x, p.y, 3, 0, 2 * Math.PI);
  ctxSomnolencia.fillStyle = color;
  ctxSomnolencia.fill();
}

// Dibuja una línea entre dos landmarks convertidos al sistema del canvas.
function dibujarLinea(p1, p2, color = "white") {
  const a = convertirPuntoVideoACanvas(p1);
  const b = convertirPuntoVideoACanvas(p2);

  ctxSomnolencia.beginPath();
  ctxSomnolencia.moveTo(a.x, a.y);
  ctxSomnolencia.lineTo(b.x, b.y);
  ctxSomnolencia.lineWidth = 2;
  ctxSomnolencia.strokeStyle = color;
  ctxSomnolencia.stroke();
}



// RESETEO VISUAL


// Restablece métricas e indicadores visuales a estado inicial.
function resetearSomnolencia() {
  ojosCerradosDesde = null;
  earIzquierdoEl.innerText = "0.000";
  earDerechoEl.innerText = "0.000";
  tiempoOjosCerradosEl.innerText = "0 ms";
}



// EVENTOS PERSONALIZADOS DESDE app.js


// app.js lanza este evento cuando el usuario enciende el detector.
window.addEventListener("somnolencia:activar", () => {
  iniciarDetectorSomnolencia();
});

// app.js lanza este evento cuando el usuario apaga el detector.
window.addEventListener("somnolencia:detener", () => {
  detenerDetectorSomnolencia();
});

// app.js lanza este evento al abrir la ventana visual del detector.
// Se usa un pequeño retraso para que el modal tenga ya tamaño real.
window.addEventListener("somnolencia:mostrar", () => {
  setTimeout(ajustarCanvasAlVideo, 80);
});

// app.js lanza este evento al cerrar la ventana visual.
// Aquí solo se limpia el canvas, no necesariamente se apaga el detector.
window.addEventListener("somnolencia:ocultar", () => {
  ctxSomnolencia.clearRect(0, 0, lienzoSomnolenciaEl.width, lienzoSomnolenciaEl.height);
});



// REACCIÓN A CAMBIOS DE TAMAÑO Y ORIENTACIÓN


// Si cambia el tamaño de ventana, puede cambiar orientación o geometría del vídeo.
window.addEventListener("resize", () => {
  actualizarSilencioPorOrientacion();
  setTimeout(ajustarCanvasAlVideo, 120);
});

// Si cambia la orientación, se deja un margen para que el layout se estabilice.
window.addEventListener("orientationchange", () => {
  setTimeout(() => {
    actualizarSilencioPorOrientacion();
    ajustarCanvasAlVideo();
  }, 150);
});

// Si la app se recarga con somnolencia guardada como activa, este módulo se rearma solo.
// Es un respaldo por si el evento inicial de app.js ocurre antes de que el módulo termine de cargar.
setTimeout(() => {
  const privacidad = cargarPrivacidad();
  if (privacidad.camara && privacidad.somnolenciaEncendida) {
    iniciarDetectorSomnolencia();
  }
}, 0);
