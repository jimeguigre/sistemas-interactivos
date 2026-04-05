const logEl = document.querySelector("#log");
let estaHablando = false;

const SpeechRecognition =
  window.SpeechRecognition || webkitSpeechRecognition;
const SpeechGrammarList =
  window.SpeechGrammarList || webkitSpeechGrammarList;

//Función para dar retroalimentación por voz
function speak(text) {
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-ES";
    // Control de estado para evitar bucles
    utterance.onstart = () => { estaHablando = true; };
    utterance.onend = () => { estaHablando = false; };

    synth.speak(utterance);
}

//Reconocimiento de voz
function startRecognition() {
    const recognition = new SpeechRecognition();
    const speechRecognitionList = new SpeechGrammarList();

    const grammar = `#JSGF V1.0; grammar comandos; public <comando> = nueva alerta | accidente | atasco | animal salvaje | corte de vía | carretera cortada | ayuda | hora ;`;
    speechRecognitionList.addFromString(grammar, 1);
    recognition.grammars = speechRecognitionList;
    recognition.lang = "es-ES";
    recognition.continuous = true;     // Mantiene el micro abierto tras detectar una frase
    recognition.interimResults = false; // Solo queremos el resultado final

    // Feedback visual para saber que el micro está activo
    recognition.onstart = () => {
        logEl.innerText = "Escuchando...";
    };

    recognition.onresult = (event) => {
        const last = event.results.length - 1;
        let command = event.results[last][0].transcript.toLowerCase().trim();
        
        // Solo procesamos si el sistema no está hablando para evitar bucles
        if (!estaHablando) {
            logEl.innerText = `Comando detectado: "${command}"`;
            handleCommand(command);
        }
    };

    recognition.onerror = (event) => {
        console.error("Error de reconocimiento:", event.error);
        logEl.innerText = "Error: " + event.error;
    };

    recognition.start();
}

function speak(text) {
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-ES";

    utterance.onstart = () => { estaHablando = true; };
    utterance.onend = () => { estaHablando = false; };

    synth.speak(utterance);
}


//Manejo de comandos de voz
function handleCommand(command) {
    //Manejo de tipos específicos definidos en vuestros bocetos
    if (command.includes("animal salvaje")) {
        // Lógica para el caso del storyboard (viñetas 7-8)
        speak("Aviso creado en tu ubicación.");
        marcarAlertaVisual("animal"); 
        logEl.innerText = "Alerta enviada: Animal Salvaje";
    } 
    else if (command.includes("accidente")) {
        speak("Aviso enviado.");
        logEl.innerText = "Alerta enviada: Accidente";
    } 
    else if (command.includes("atasco") || command.includes("retención")) {
        speak("Aviso registrado.");
        logEl.innerText = "Alerta enviada: Atasco";
    } 
    else if (command.includes("corte de vía") || command.includes("carretera cortada")) {
        speak("Aviso guardado.");
        logEl.innerText = "Alerta enviada: Corte de vía";
    }
    // Iniciamos el proceso de alerta específica
    else if (command.includes("nueva alerta") || command.includes("alerta")) {
        speak("¿Qué clase de peligro hay?"); 
        logEl.innerText = "Esperando tipo...";
    } 
    
    // Funcionalidad extra: Ayuda/Hora
    else if (command.includes("ayuda")) {
        speak("Puedes decir: Poner nueva alerta, accidente, atasco, animal salvaje o corte de vía.");
    } 
    else if (command.includes("hora")) {
        const ahora = new Date();
        speak(`Son las ${ahora.getHours()} y ${ahora.getMinutes()}`);
    }
    else {
        speak("No entendí el comando.");
    }
}

function marcarAlertaVisual(tipo) {
    // Quitar selección previa
    document.querySelectorAll('.alert-card').forEach(card => card.classList.remove('selected'));
    
    // Buscar el cuadrado que contiene el texto y marcarlo
    const cards = document.querySelectorAll('.alert-card');
    cards.forEach(card => {
        if (card.innerText.toLowerCase().includes(tipo.toLowerCase())) {
            card.classList.add('selected');
            logEl.innerText = "Alerta visual activa: " + tipo;
        }
    });
}

// --- cosas frenazo ----- 
// cosas anteriores (de la solución tomada como base): 
//Control por gestos con Acelerómetro
if ("Accelerometer" in window) {
    try {
        const sensor = new Accelerometer({ frequency: 60 });
        let lastMoveTime = 0;

        sensor.onreading = () => {
            const now = performance.now(); 
            const totalForce = Math.sqrt(sensor.x**2 + sensor.y**2 + sensor.z**2);
            
            if (totalForce > 25 && (now - lastMoveTime) > 3000) {
                logEl.innerText = "¡Frenazo detectado!";
                speak("Se ha detectado un frenazo. ¿Confirmas la alerta?");
                lastMoveTime = now;
            }
        };
        sensor.start();
    } catch (e) { console.error(e); }
}
//------- fin cosas frenazo-------


// Iniciar el reconocimiento con la primera interacción del usuario
// Esto cumple con las políticas de seguridad del navegador
window.addEventListener('click', () => {
    startRecognition();
    speak("Sistema de alertas activado. Estoy escuchando.");
}, { once: true }); // 'once: true' asegura que solo se ejecute la primera vez