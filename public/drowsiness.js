// Importa las clases de MediaPipe necesarias para detectar landmarks faciales en vídeo
import {
  FaceLandmarker,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

// Clave usada para leer la configuración guardada de privacidad en localStorage
const CLAVE_PRIVACIDAD = "avisos_nav_privacidad_v10";

// Referencia al modal visual del detector de somnolencia
const modalSomnolenciaEl = document.getElementById("modalSomnolencia");

// Referencia al elemento <video> donde se muestra la cámara frontal
const camaraSomnolenciaEl = document.getElementById("camaraSomnolencia");

// Referencia al canvas que se superpone al vídeo para dibujar landmarks
const lienzoSomnolenciaEl = document.getElementById("lienzoSomnolencia");

// Contexto 2D del canvas para poder dibujar puntos y líneas
const ctxSomnolencia = lienzoSomnolenciaEl.getContext("2d");

// Elemento donde se muestra el estado textual del detector
const estadoSomnolenciaEl = document.getElementById("estadoSomnolencia");

// Elemento donde se muestra el EAR del ojo izquierdo
const earIzquierdoEl = document.getElementById("earIzquierdo");

// Elemento donde se muestra el EAR del ojo derecho
const earDerechoEl = document.getElementById("earDerecho");

// Elemento donde se muestra el tiempo acumulado con ojos cerrados
const tiempoOjosCerradosEl = document.getElementById("tiempoOjosCerrados");

// Elemento donde se enseña el umbral configurado de EAR
const valorUmbralSomnolenciaEl = document.getElementById("valorUmbralSomnolencia");

// Elemento donde se enseña el tiempo configurado de alerta
const valorTiempoSomnolenciaEl = document.getElementById("valorTiempoSomnolencia");

// Umbral de EAR por debajo del cual se considera que el ojo está cerrado
const UMBRAL_OJO_CERRADO = 0.21;

// Tiempo mínimo con los ojos cerrados para disparar alerta de somnolencia
const TIEMPO_ALERTA_SOMNOLENCIA_MS = 1500;

// Muestra en pantalla el umbral actual para que el usuario vea la configuración
valorUmbralSomnolenciaEl.innerText = UMBRAL_OJO_CERRADO.toFixed(2);

// Muestra en pantalla el tiempo de alerta configurado
valorTiempoSomnolenciaEl.innerText = `${TIEMPO_ALERTA_SOMNOLENCIA_MS} ms`;

// Instancia del detector facial de MediaPipe, inicialmente no cargada
let detectorCara = null;

// Bandera para no volver a cargar el modelo más de una vez
let modeloCargado = false;

// Bandera que indica si el detector está funcionando realmente
let detectorActivo = false;

// Marca temporal desde la que se detecta que ambos ojos están cerrados
let ojosCerradosDesde = null;

// Último instante de vídeo procesado, para no analizar dos veces el mismo frame
let ultimoVideoTime = -1;

// Stream real de la cámara frontal del dispositivo
let streamCamara = null;

// ID del requestAnimationFrame usado para el bucle principal
let rafId = null;

// Contexto de audio usado para generar pitidos sin cargar archivos externos
let audioContext = null;

// Intervalo repetitivo que mantiene la alarma sonora
let intervaloAlarma = null;

// Bandera para silenciar la alarma cuando la orientación no es la deseada
let alarmaSilenciadaPorOrientacion = false;

// Índices de landmarks del ojo izquierdo usados para calcular el EAR
const OJO_IZQUIERDO = [33, 160, 158, 133, 153, 144];

// Índices de landmarks del ojo derecho usados para calcular el EAR
const OJO_DERECHO = [362, 385, 387, 263, 373, 380];

// Lee desde localStorage si el usuario tiene cámara permitida y detector encendido
function cargarPrivacidad() {
  try {
    const raw = localStorage.getItem(CLAVE_PRIVACIDAD);

    // Si no hay datos guardados, devolvemos un estado por defecto
    if (!raw) return { camara: false, somnolenciaEncendida: false };

    const datos = JSON.parse(raw);

    // Se devuelve solo la parte relevante para este módulo
    return {
      camara: !!datos.camara,
      somnolenciaEncendida: !!datos.somnolenciaEncendida
    };
  } catch {
    // Si el JSON falla, se fuerza un estado seguro sin cámara ni detector
    return { camara: false, somnolenciaEncendida: false };
  }
}

// Actualiza el texto y la clase visual del estado del detector
function ponerEstadoSomnolencia(texto, clase = "") {
  estadoSomnolenciaEl.textContent = texto;
  estadoSomnolenciaEl.className = `estadoSomnolencia ${clase}`.trim();
}

// Comprueba si el dispositivo está actualmente en vertical
function esVertical() {
  return window.innerHeight > window.innerWidth;
}

// Crea el contexto de audio la primera vez que hace falta
function iniciarAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
}

// Intenta activar el audio del navegador tras interacción del usuario
async function desbloquearAudio() {
  try {
    iniciarAudio();

    // Algunos navegadores móviles arrancan el contexto suspendido y hay que reanudarlo
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
  } catch {}
}

// Genera un pitido breve usando un oscilador de Web Audio
function beep() {
  // Si no existe contexto de audio, no se puede sonar
  if (!audioContext) return;

  // Si la alarma está silenciada por orientación, no se emite pitido
  if (alarmaSilenciadaPorOrientacion) return;

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  // Se usa una onda senoidal para que el pitido sea simple y claro
  oscillator.type = "sine";
  oscillator.frequency.value = 880;

  // Se conecta el oscilador al control de ganancia y luego a la salida
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // Se crea una envolvente de volumen corta para evitar clics bruscos
  gainNode.gain.setValueAtTime(0.001, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.15, audioContext.currentTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.25);

  // Se lanza el pitido y se detiene poco después
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.25);
}

// Inicia la alarma sonora repetitiva si todavía no estaba activa
async function iniciarAlarma() {
  try {
    await desbloquearAudio();

    // Si la orientación silencia la alarma, no se arranca
    if (alarmaSilenciadaPorOrientacion) return;

    // Si ya hay una alarma activa, no se duplica
    if (intervaloAlarma) return;

    // Se lanza un pitido inicial y luego se repite periódicamente
    beep();
    intervaloAlarma = setInterval(beep, 700);
  } catch {}
}

// Detiene completamente la alarma sonora
function pararAlarma() {
  if (intervaloAlarma) {
    clearInterval(intervaloAlarma);
    intervaloAlarma = null;
  }
}

// Actualiza si la alarma debe estar silenciada según la orientación actual
function actualizarSilencioPorOrientacion() {
  const vertical = esVertical();
  alarmaSilenciadaPorOrientacion = vertical;

  // Si se entra en vertical se para cualquier alarma ya sonando
  if (vertical) {
    pararAlarma();
  }
}

// El navegador suele requerir interacción del usuario antes de permitir audio
window.addEventListener("click", desbloquearAudio, { once: true });

// También se permite desbloquear el audio con una pulsación de teclado
window.addEventListener("keydown", desbloquearAudio, { once: true });

// Carga y crea el modelo de MediaPipe solo una vez durante toda la sesión
async function asegurarModeloCargado() {
  if (modeloCargado) return;

  ponerEstadoSomnolencia("Cargando modelo...");

  // Carga los archivos base WASM necesarios para ejecutar la visión por computador
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );

  // Crea el detector facial con configuración de vídeo y una sola cara
  detectorCara = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      // Ruta del modelo preentrenado de landmarks faciales
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      // Se intenta usar GPU para mejorar rendimiento
      delegate: "GPU"
    },
    // El detector va a trabajar frame a frame sobre vídeo en tiempo real
    runningMode: "VIDEO",
    // Solo interesa la cara principal del conductor
    numFaces: 1
  });

  modeloCargado = true;
}

// Solicita el acceso a la cámara frontal y conecta el stream al elemento vídeo
async function iniciarCamara() {
  // Si ya existe stream, no se abre la cámara otra vez
  if (streamCamara) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        // Se prioriza la cámara frontal del dispositivo
        facingMode: { ideal: "user" },
        // Resolución ideal pensada para horizontal
        width: { ideal: 1280 },
        height: { ideal: 720 },
        // Relación de aspecto panorámica
        aspectRatio: { ideal: 16 / 9 }
      },
      audio: false
    });

    streamCamara = stream;
    camaraSomnolenciaEl.srcObject = stream;

    // Espera a que el navegador conozca el tamaño real del vídeo
    await new Promise((resolve) => {
      camaraSomnolenciaEl.onloadedmetadata = () => resolve();
    });

    // Intenta reproducir el vídeo sin sonido
    await camaraSomnolenciaEl.play().catch(() => {});

    // Ajusta el canvas al tamaño visible del vídeo
    ajustarCanvasAlVideo();
  } catch (error) {
    ponerEstadoSomnolencia("No se pudo acceder a la cámara", "alerta");
    throw error;
  }
}

// Cierra la cámara y libera los tracks del stream
function pararCamara() {
  if (streamCamara) {
    streamCamara.getTracks().forEach(track => track.stop());
    streamCamara = null;
  }

  camaraSomnolenciaEl.srcObject = null;
}

// Ajusta el canvas al tamaño visual real del vídeo cuando el modal está abierto
function ajustarCanvasAlVideo() {
  // Si el modal no está visible no hace falta recalcular el canvas
  if (!modalSomnolenciaEl.classList.contains("abierto")) return;

  const rect = camaraSomnolenciaEl.getBoundingClientRect();

  // Si todavía no hay tamaño real, se sale
  if (!rect.width || !rect.height) return;

  const dpr = window.devicePixelRatio || 1;

  // Se aumenta la resolución interna del canvas según el pixel ratio del dispositivo
  lienzoSomnolenciaEl.width = Math.round(rect.width * dpr);
  lienzoSomnolenciaEl.height = Math.round(rect.height * dpr);

  // Se mantiene el tamaño CSS para que el canvas coincida visualmente con el vídeo
  lienzoSomnolenciaEl.style.width = `${rect.width}px`;
  lienzoSomnolenciaEl.style.height = `${rect.height}px`;

  // Se resetea la transformación previa y se aplica la escala de alta densidad
  ctxSomnolencia.setTransform(1, 0, 0, 1, 0, 0);
  ctxSomnolencia.scale(dpr, dpr);
}

// Calcula el rectángulo exacto donde realmente se está dibujando el vídeo dentro del contenedor
function obtenerRectanguloVideoRenderizado() {
  const contW = camaraSomnolenciaEl.clientWidth;
  const contH = camaraSomnolenciaEl.clientHeight;
  const vidW = camaraSomnolenciaEl.videoWidth || 1;
  const vidH = camaraSomnolenciaEl.videoHeight || 1;

  // Como se usa object-fit: contain, se calcula la escala mínima para no deformar
  const escala = Math.min(contW / vidW, contH / vidH);
  const drawW = vidW * escala;
  const drawH = vidH * escala;

  // Se calculan márgenes internos para centrar el vídeo dentro del contenedor
  const offsetX = (contW - drawW) / 2;
  const offsetY = (contH - drawH) / 2;

  return { offsetX, offsetY, drawW, drawH };
}

// Arranca el detector completo si permisos y estado lo permiten
async function iniciarDetectorSomnolencia() {
  const privacidad = cargarPrivacidad();

  // Si no hay permiso de cámara, no se puede activar
  if (!privacidad.camara) {
    ponerEstadoSomnolencia("La cámara está desactivada. Actívala en Privacidad", "warning");
    return;
  }

  // Si el usuario dejó el detector apagado, se respeta ese estado
  if (!privacidad.somnolenciaEncendida) {
    ponerEstadoSomnolencia("Detector apagado");
    return;
  }

  // Se actualiza si la alarma debe estar muda por orientación
  actualizarSilencioPorOrientacion();

  // Si ya estaba activo, solo se reajusta el canvas si hace falta
  if (detectorActivo) {
    if (modalSomnolenciaEl.classList.contains("abierto")) {
      setTimeout(ajustarCanvasAlVideo, 60);
    }
    return;
  }

  try {
    detectorActivo = true;
    resetearSomnolencia();
    await asegurarModeloCargado();
    await iniciarCamara();
    ponerEstadoSomnolencia("Detector activo en segundo plano", "ok");
    ultimoVideoTime = -1;
    analizarFrame();
  } catch {
    detectorActivo = false;
  }
}

// Detiene el detector y deja todo limpio
function detenerDetectorSomnolencia() {
  detectorActivo = false;
  pararAlarma();
  pararCamara();

  // Si había un bucle de animación activo, se cancela
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  ultimoVideoTime = -1;

  // Se limpia el canvas visual de puntos y líneas
  ctxSomnolencia.clearRect(0, 0, lienzoSomnolenciaEl.width, lienzoSomnolenciaEl.height);

  resetearSomnolencia();
  ponerEstadoSomnolencia("Detector detenido");
}

// Bucle principal que procesa el vídeo frame a frame
function analizarFrame() {
  if (!detectorActivo) return;

  // Si el modelo aún no está listo o el vídeo no tiene datos, se reintenta en el siguiente frame
  if (!detectorCara || camaraSomnolenciaEl.readyState < 2) {
    rafId = requestAnimationFrame(analizarFrame);
    return;
  }

  const ahoraMs = performance.now();

  // Solo se analiza si el vídeo ha avanzado respecto al último frame procesado
  if (camaraSomnolenciaEl.currentTime !== ultimoVideoTime) {
    ultimoVideoTime = camaraSomnolenciaEl.currentTime;

    // MediaPipe detecta landmarks faciales sobre el frame actual del vídeo
    const resultado = detectorCara.detectForVideo(camaraSomnolenciaEl, ahoraMs);

    // Si el visor está abierto, se limpia el canvas para redibujar landmarks
    if (modalSomnolenciaEl.classList.contains("abierto")) {
      ajustarCanvasAlVideo();
      ctxSomnolencia.clearRect(
        0,
        0,
        lienzoSomnolenciaEl.clientWidth,
        lienzoSomnolenciaEl.clientHeight
      );
    }

    // Si se detectó al menos una cara, se procesa la primera
    if (resultado.faceLandmarks && resultado.faceLandmarks.length > 0) {
      const landmarks = resultado.faceLandmarks[0];

      // Solo se dibuja la parte visual si la ventana está abierta
      if (modalSomnolenciaEl.classList.contains("abierto")) {
        dibujarLandmarksOjos(landmarks);
      }

      // Siempre se analiza la somnolencia aunque el visor no esté abierto
      analizarSomnolencia(landmarks, ahoraMs);
    } else {
      // Si no hay cara, se resetea el estado y se para cualquier alarma
      resetearSomnolencia();
      pararAlarma();
      ponerEstadoSomnolencia("Buscando cara...");
    }
  }

  rafId = requestAnimationFrame(analizarFrame);
}

// Analiza los landmarks de los ojos y decide si hay posible somnolencia
function analizarSomnolencia(landmarks, ahoraMs) {
  const puntosOjoIzq = OJO_IZQUIERDO.map(index => landmarks[index]);
  const puntosOjoDer = OJO_DERECHO.map(index => landmarks[index]);

  // Se calcula el EAR de cada ojo por separado
  const earIzq = calcularEAR(...puntosOjoIzq);
  const earDer = calcularEAR(...puntosOjoDer);

  // Se muestran ambos valores en la interfaz
  earIzquierdoEl.innerText = earIzq.toFixed(3);
  earDerechoEl.innerText = earDer.toFixed(3);

  // Solo se considera ojo cerrado si ambos ojos bajan del umbral
  const ambosCerrados = earIzq < UMBRAL_OJO_CERRADO && earDer < UMBRAL_OJO_CERRADO;

  if (ambosCerrados) {
    // Si es el primer frame de cierre, guardamos el instante inicial
    if (ojosCerradosDesde === null) ojosCerradosDesde = ahoraMs;

    const duracion = ahoraMs - ojosCerradosDesde;
    tiempoOjosCerradosEl.innerText = `${Math.round(duracion)} ms`;

    // Si se supera el tiempo configurado, se dispara la alerta
    if (duracion >= TIEMPO_ALERTA_SOMNOLENCIA_MS) {
      if (alarmaSilenciadaPorOrientacion) {
        ponerEstadoSomnolencia("ALERTA en silencio por orientación", "warning");
        pararAlarma();
      } else {
        ponerEstadoSomnolencia("ALERTA: posible somnolencia", "alerta");
        iniciarAlarma();
      }
    } else {
      // Antes de llegar al tiempo de alerta, solo se marca como ojos cerrados
      ponerEstadoSomnolencia("Ojos cerrados...", "warning");
      pararAlarma();
    }
  } else {
    // Si se vuelven a abrir los ojos, se resetea el contador y la alarma
    ojosCerradosDesde = null;
    tiempoOjosCerradosEl.innerText = "0 ms";
    ponerEstadoSomnolencia("Ojos abiertos", "ok");
    pararAlarma();
  }
}

// Calcula la distancia euclídea 3D entre dos landmarks
function distancia(a, b) {
  return Math.sqrt(
    (a.x - b.x) ** 2 +
    (a.y - b.y) ** 2 +
    (a.z - b.z) ** 2
  );
}

// Calcula el Eye Aspect Ratio usando seis puntos de un ojo
function calcularEAR(p1, p2, p3, p4, p5, p6) {
  const vertical1 = distancia(p2, p6);
  const vertical2 = distancia(p3, p5);
  const horizontal = distancia(p1, p4);

  // Evita división entre cero en casos degenerados
  if (horizontal === 0) return 0;

  return (vertical1 + vertical2) / (2 * horizontal);
}

// Dibuja ambos ojos sobre el canvas para depuración visual
function dibujarLandmarksOjos(landmarks) {
  dibujarUnOjo(OJO_IZQUIERDO, landmarks, "cyan");
  dibujarUnOjo(OJO_DERECHO, landmarks, "lime");
}

// Dibuja los puntos y el contorno de un ojo concreto
function dibujarUnOjo(indices, landmarks, color) {
  indices.forEach(index => dibujarPunto(landmarks[index], color));

  for (let i = 0; i < indices.length; i++) {
    const actual = landmarks[indices[i]];
    const siguiente = landmarks[indices[(i + 1) % indices.length]];
    dibujarLinea(actual, siguiente, color);
  }
}

// Convierte un landmark normalizado del vídeo a coordenadas reales del canvas
function convertirPuntoVideoACanvas(point) {
  const { offsetX, offsetY, drawW, drawH } = obtenerRectanguloVideoRenderizado();

  return {
    x: offsetX + point.x * drawW,
    y: offsetY + point.y * drawH
  };
}

// Dibuja un punto circular en la posición correspondiente del canvas
function dibujarPunto(point, color = "red") {
  const p = convertirPuntoVideoACanvas(point);

  ctxSomnolencia.beginPath();
  ctxSomnolencia.arc(p.x, p.y, 3, 0, 2 * Math.PI);
  ctxSomnolencia.fillStyle = color;
  ctxSomnolencia.fill();
}

// Dibuja una línea entre dos landmarks ya convertidos al sistema del canvas
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

// Restablece los indicadores visuales del detector a valores iniciales
function resetearSomnolencia() {
  ojosCerradosDesde = null;
  earIzquierdoEl.innerText = "0.000";
  earDerechoEl.innerText = "0.000";
  tiempoOjosCerradosEl.innerText = "0 ms";
}

// Evento personalizado lanzado desde app.js para encender el detector
window.addEventListener("somnolencia:activar", () => {
  iniciarDetectorSomnolencia();
});

// Evento personalizado lanzado desde app.js para apagar el detector
window.addEventListener("somnolencia:detener", () => {
  detenerDetectorSomnolencia();
});

// Evento personalizado para reajustar el canvas cuando se abre el visor
window.addEventListener("somnolencia:mostrar", () => {
  setTimeout(ajustarCanvasAlVideo, 80);
});

// Evento personalizado para limpiar el canvas cuando se oculta el visor
window.addEventListener("somnolencia:ocultar", () => {
  ctxSomnolencia.clearRect(0, 0, lienzoSomnolenciaEl.width, lienzoSomnolenciaEl.height);
});

// En resize se revisa si la alarma debe silenciarse y se reajusta el canvas
window.addEventListener("resize", () => {
  actualizarSilencioPorOrientacion();
  setTimeout(ajustarCanvasAlVideo, 120);
});

// En cambio de orientación se da un pequeño margen antes de recalcular tamaños
window.addEventListener("orientationchange", () => {
  setTimeout(() => {
    actualizarSilencioPorOrientacion();
    ajustarCanvasAlVideo();
  }, 150);
});