// Boton principal que abre o cierra el panel de compartir
const botonCompartirRutaPrincipalEl = document.getElementById("botonCompartirRuta");
// Boton de salir de conduccion de la app principal
const botonSalirConduccionPrincipalEl = document.getElementById("botonSalirConduccion");
// Panel desplegable donde se ensena el enlace compartido
const panelCompartirRutaPrincipalEl = document.getElementById("panelCompartirRuta");
// Campo de texto donde se ve la URL generada
const enlaceRutaCompartidaEl = document.getElementById("enlaceRutaCompartida");
// Boton para copiar el enlace
const botonCopiarRutaCompartidaEl = document.getElementById("botonCopiarRutaCompartida");
// Boton para usar la funcion nativa de compartir del navegador
const botonCompartirRutaNativoEl = document.getElementById("botonCompartirRutaNativo");
// Texto de ayuda que aparece debajo del enlace
const textoEstadoRutaCompartidaEl = document.getElementById("textoEstadoRutaCompartida");

// Si la pagina principal no tiene esta parte montada, el archivo no hace nada
if (botonCompartirRutaPrincipalEl && panelCompartirRutaPrincipalEl && window.apiRutaCompartida) {
  // Socket dedicado a la funcionalidad de compartir ruta
  const socketCompartirRuta = window.socketPrincipal || io();

  // Guarda la sesion compartida actual
  let sesionRutaCompartida = null;
  // Guarda el ultimo estado recibido desde app.js
  let ultimoEstadoRutaPrincipal = window.apiRutaCompartida.obtenerEstadoActual();
  // Sirve para saber si la ruta compartida ya se activo en el servidor
  let inicioCompartidoYaEnviado = false;

  // Cambia el texto informativo del panel
  function ponerEstadoCompartirRuta(texto) {
    // Se escribe el mensaje nuevo en el parrafo de ayuda
    textoEstadoRutaCompartidaEl.textContent = texto;
  }

  // Cierra la sesion compartida actual y limpia la interfaz
  function cerrarSesionCompartidaActiva(mensajeCierre) {
    // Si no hay una sesion valida, no hay nada que cerrar
    if (!sesionRutaCompartida?.codigo) return false;

    // Se avisa al servidor de que esta sesion ha terminado
    socketCompartirRuta.emit("ruta:finalizar", {
      codigo: sesionRutaCompartida.codigo,
      conductorToken: sesionRutaCompartida.conductorToken
    });
    // Se borra la referencia local a la sesion
    sesionRutaCompartida = null;
    // Se reinicia la marca que indicaba que la conduccion ya habia empezado
    inicioCompartidoYaEnviado = false;
    // Se oculta el panel porque ese enlace ya no sirve
    panelCompartirRutaPrincipalEl.classList.add("oculto");
    // Se vacia el campo del enlace visible
    enlaceRutaCompartidaEl.value = "";
    // Se deja un texto claro en el panel
    ponerEstadoCompartirRuta(mensajeCierre);

    // Se devuelve true para indicar que si se ha cerrado algo
    return true;
  }

  // Ajusta lo que se ve en el panel segun el estado actual de la ruta
  function refrescarInterfazCompartirRuta() {
    // Se comprueba si realmente hay una ruta creada en la app principal
    const hayRuta = Boolean(ultimoEstadoRutaPrincipal?.rutaDisponible);

    // Si no hay una sesion con URL, el campo debe quedar vacio
    if (!sesionRutaCompartida?.url) {
      // Se borra lo que hubiera en pantalla
      enlaceRutaCompartidaEl.value = "";
    }

    // Si ya no existe ruta, esta parte debe quedar reseteada
    if (!hayRuta) {
      // Se borra la sesion local porque ya no tiene sentido conservarla
      sesionRutaCompartida = null;
      // Se reinicia la bandera de inicio compartido
      inicioCompartidoYaEnviado = false;
      // Se deja el mensaje por defecto
      ponerEstadoCompartirRuta("Crea una ruta para generar el enlace compartido");
    }
  }

  // Abre el panel o crea una sesion nueva si hace falta
  function prepararComparticionRuta() {
    // Si el panel ya esta abierto, este boton actua como cierre
    if (!panelCompartirRutaPrincipalEl.classList.contains("oculto")) {
      // Se oculta el panel
      panelCompartirRutaPrincipalEl.classList.add("oculto");
      // Y se termina aqui
      return;
    }

    // Se pide el estado mas reciente de la app principal
    ultimoEstadoRutaPrincipal = window.apiRutaCompartida.obtenerEstadoActual();

    // Si todavia no hay ruta valida, se muestra el aviso y se para
    if (!ultimoEstadoRutaPrincipal?.rutaDisponible || !ultimoEstadoRutaPrincipal?.latLngDestinoActual) {
      // Se explica por que no se puede compartir todavia
      ponerEstadoCompartirRuta("Hay que crear una ruta primero para poder compartirla");
      // Se abre el panel para que el usuario vea ese mensaje
      panelCompartirRutaPrincipalEl.classList.remove("oculto");
      // Se sale de la funcion
      return;
    }

    // Si ya existe una sesion compartida, no hace falta pedir otra
    if (sesionRutaCompartida?.url) {
      // Se vuelve a ensenar el panel
      panelCompartirRutaPrincipalEl.classList.remove("oculto");
      // Se coloca la URL existente en el campo
      enlaceRutaCompartidaEl.value = sesionRutaCompartida.url;
      // Se actualiza el texto segun si la ruta ya esta en marcha o no
      ponerEstadoCompartirRuta(
        ultimoEstadoRutaPrincipal.enConduccion
          ? "El enlace ya esta activo y actualizando la ruta en tiempo real"
          : "El enlace ya esta listo y empezara a funcionar al iniciar la conduccion"
      );
      // Se termina porque ya estaba todo creado
      return;
    }

    // Se abre el panel mientras se genera el enlace
    panelCompartirRutaPrincipalEl.classList.remove("oculto");
    // Se informa de que la app esta preparando la sesion
    ponerEstadoCompartirRuta("Generando enlace compartido con la IP local");

    // Se pide al servidor que cree una nueva sesion compartida
    socketCompartirRuta.emit("ruta:crear_comparticion", {
      // Se manda el texto del destino actual
      destinoTexto: ultimoEstadoRutaPrincipal.textoDestinoActual,
      // Se manda la posicion del destino
      destinoLatLng: ultimoEstadoRutaPrincipal.latLngDestinoActual,
      // Se manda la geometria completa de la ruta
      coordenadasRuta: ultimoEstadoRutaPrincipal.coordenadasRuta
    });
  }

  // Copia la URL al portapapeles
  async function copiarEnlaceCompartido() {
    // Si no hay URL, no se intenta copiar nada
    if (!enlaceRutaCompartidaEl.value) return;

    try {
      // Se intenta usar la API moderna del portapapeles
      await navigator.clipboard.writeText(enlaceRutaCompartidaEl.value);
      // Se avisa de que la copia ha salido bien
      ponerEstadoCompartirRuta("Enlace copiado al portapapeles");
    } catch {
      // Si falla la API moderna, se selecciona el texto manualmente
      enlaceRutaCompartidaEl.select();
      // Se usa el metodo clasico como plan B
      document.execCommand("copy");
      // Se informa tambien en este caso
      ponerEstadoCompartirRuta("Enlace copiado con el metodo alternativo");
    }
  }

  // Abre el dialogo nativo de compartir si el navegador lo permite
  async function compartirEnlaceNativamente() {
    // Si no hay enlace, no hay nada que compartir
    if (!enlaceRutaCompartidaEl.value) return;

    // Si no existe navigator.share, se reutiliza la copia normal
    if (!navigator.share) {
      // Se llama al metodo de copiar
      await copiarEnlaceCompartido();
      // Y se termina la funcion
      return;
    }

    try {
      // Se abre el cuadro nativo de compartir del dispositivo
      await navigator.share({
        // Titulo corto para la accion de compartir
        title: "Seguimiento de ruta",
        // Texto que acompana al enlace
        text: "Te comparto mi ruta en tiempo real",
        // URL que se va a compartir
        url: enlaceRutaCompartidaEl.value
      });
      // Se informa de que el dialogo se ha abierto
      ponerEstadoCompartirRuta("Se ha abierto el panel nativo de compartir");
    } catch {
      // Si falla o el usuario cancela, se deja un mensaje suave
      ponerEstadoCompartirRuta("No se pudo completar la accion de compartir");
    }
  }

  // Sincroniza la sesion compartida con los cambios de la ruta principal
  function sincronizarSesionConEstadoPrincipal(estado) {
    // Se guarda el estado mas reciente para reutilizarlo despues
    ultimoEstadoRutaPrincipal = estado;

    // Si todavia no hay sesion compartida, solo hay que refrescar la interfaz
    if (!sesionRutaCompartida?.codigo) {
      // Se actualiza lo que se ve en pantalla
      refrescarInterfazCompartirRuta();
      // Se termina aqui
      return;
    }

    // Si la conduccion ha terminado y esta sesion ya estaba activa, se cierra
    if (!estado.enConduccion && inicioCompartidoYaEnviado) {
      // Se cierra la sesion compartida completa
      cerrarSesionCompartidaActiva("La sesion compartida ha terminado al salir de conduccion");
      // Y no hace falta seguir
      return;
    }

    // Se actualiza la parte visual despues de resolver el posible cierre
    refrescarInterfazCompartirRuta();

    // Si ya no hay ruta disponible, no se envian mas actualizaciones
    if (!estado.rutaDisponible) return;

    // Se manda al servidor la ruta actualizada
    socketCompartirRuta.emit("ruta:actualizar_comparticion", {
      // Codigo de la sesion que se esta actualizando
      codigo: sesionRutaCompartida.codigo,
      // Token privado para recuperar la sesion si el socket se reconecta
      conductorToken: sesionRutaCompartida.conductorToken,
      // Texto del destino actual
      destinoTexto: estado.textoDestinoActual,
      // Coordenadas del destino
      destinoLatLng: estado.latLngDestinoActual,
      // Nueva geometria de la ruta
      coordenadasRuta: estado.coordenadasRuta
    });

    // Si la conduccion acaba de empezar y todavia no se habia activado la sesion, se activa ahora
    if (estado.enConduccion && !inicioCompartidoYaEnviado) {
      // Se marca localmente para no repetir este paso
      inicioCompartidoYaEnviado = true;

      // Se avisa al servidor de que la sesion ya esta activa
      socketCompartirRuta.emit("ruta:iniciar", {
        // Codigo de la sesion
        codigo: sesionRutaCompartida.codigo,
        // Token privado de la sesion del conductor
        conductorToken: sesionRutaCompartida.conductorToken,
        // Posicion actual del conductor
        posicionActual: estado.posicionActual
      });

      // Se actualiza el mensaje visible del panel
      ponerEstadoCompartirRuta("Enlace activo y actualizando la ruta en tiempo real");
    }

    // Mientras la ruta siga activa, tambien se manda la posicion del conductor
    if (estado.enConduccion && estado.posicionActual) {
      // Se envia la posicion mas reciente al servidor
      socketCompartirRuta.emit("ruta:actualizar_posicion", {
        // Codigo de la sesion
        codigo: sesionRutaCompartida.codigo,
        // Token privado de la sesion del conductor
        conductorToken: sesionRutaCompartida.conductorToken,
        // Posicion actual del conductor
        posicionActual: estado.posicionActual
      });
    }
  }

  // Cuando el servidor confirma que la sesion se ha creado
  socketCompartirRuta.on("ruta:comparticion_creada", (sesion) => {
    // Se guarda la nueva sesion en memoria local
    sesionRutaCompartida = sesion;
    // Se muestra el panel de compartir
    panelCompartirRutaPrincipalEl.classList.remove("oculto");
    // Se ensena la URL generada
    enlaceRutaCompartidaEl.value = sesion.url;

    // Se adapta el texto al estado actual de la conduccion
    ponerEstadoCompartirRuta(
      ultimoEstadoRutaPrincipal.enConduccion
        ? "Enlace listo y ya activado porque estabas conduciendo"
        : "Enlace listo y pendiente de que empiece la conduccion"
    );

    // Si la app ya estaba en conduccion cuando se creo el enlace, se activa directamente
    if (ultimoEstadoRutaPrincipal.enConduccion) {
      // Se marca como ya iniciado
      inicioCompartidoYaEnviado = true;
      // Se avisa al servidor
      socketCompartirRuta.emit("ruta:iniciar", {
        // Codigo de la nueva sesion
        codigo: sesion.codigo,
        // Token privado de la sesion del conductor
        conductorToken: sesion.conductorToken,
        // Posicion actual del conductor
        posicionActual: ultimoEstadoRutaPrincipal.posicionActual
      });
    }
  });

  // Si se corta la red un momento y Socket.IO reconecta, se recupera la sesion.
  socketCompartirRuta.on("connect", () => {
    if (!sesionRutaCompartida?.codigo || !sesionRutaCompartida?.conductorToken) return;

    socketCompartirRuta.emit("ruta:recuperar_conductor", {
      codigo: sesionRutaCompartida.codigo,
      conductorToken: sesionRutaCompartida.conductorToken
    });

    ultimoEstadoRutaPrincipal = window.apiRutaCompartida.obtenerEstadoActual();

    if (ultimoEstadoRutaPrincipal.enConduccion && inicioCompartidoYaEnviado) {
      socketCompartirRuta.emit("ruta:iniciar", {
        codigo: sesionRutaCompartida.codigo,
        conductorToken: sesionRutaCompartida.conductorToken,
        posicionActual: ultimoEstadoRutaPrincipal.posicionActual
      });
    }
  });

  // Cuando llega un mensaje del espectador al conductor
  socketCompartirRuta.on("ruta:mensaje_para_conductor", (mensaje) => {
    // Se deja el texto visible en el panel
    ponerEstadoCompartirRuta(`Mensaje recibido: ${mensaje.texto}`);
    // Se reutiliza la voz principal de la app para leerlo en cola
    window.apiRutaCompartida.hablarTexto(`Mensaje del contacto ${mensaje.texto}`);
  });

  // Cuando el servidor marca la sesion como finalizada
  socketCompartirRuta.on("ruta:finalizada", () => {
    // Se borra la sesion local
    sesionRutaCompartida = null;
    // Se reinicia la marca de inicio
    inicioCompartidoYaEnviado = false;
    // Se vacia el campo del enlace
    enlaceRutaCompartidaEl.value = "";
    // Se oculta el panel porque ya no tiene utilidad
    panelCompartirRutaPrincipalEl.classList.add("oculto");
    // Se deja un mensaje final
    ponerEstadoCompartirRuta("La sesion compartida ya ha terminado");
  });

  // Cuando el servidor devuelve un error relacionado con compartir
  socketCompartirRuta.on("ruta:error", (payload) => {
    // Se ensena el mensaje recibido o uno generico si no viene ninguno
    ponerEstadoCompartirRuta(payload?.mensaje || "Ha ocurrido un error en la ruta compartida");
    // Se abre el panel para que el usuario vea ese error
    panelCompartirRutaPrincipalEl.classList.remove("oculto");
  });

  // Escucha los cambios de estado que emite app.js
  window.addEventListener("ruta-compartida:estado", (evento) => {
    // Se sincroniza la sesion con el nuevo estado
    sincronizarSesionConEstadoPrincipal(evento.detail);
  });

  // Evento del boton principal de compartir
  botonCompartirRutaPrincipalEl.addEventListener("click", prepararComparticionRuta);

  // Evento del boton salir para cerrar la sesion justo antes de que la app limpie la ruta
  botonSalirConduccionPrincipalEl?.addEventListener("click", () => {
    // Si la sesion todavia no estaba activa, no hace falta cerrar nada
    if (!inicioCompartidoYaEnviado) return;
    // Se cierra la sesion compartida de inmediato
    cerrarSesionCompartidaActiva("La sesion compartida ha terminado al salir de conduccion");
  }, true);

  // Evento del boton de copiar enlace
  botonCopiarRutaCompartidaEl.addEventListener("click", copiarEnlaceCompartido);
  // Evento del boton de compartir con la funcion nativa del navegador
  botonCompartirRutaNativoEl.addEventListener("click", compartirEnlaceNativamente);

  // Se deja la interfaz en un estado correcto nada mas cargar
  refrescarInterfazCompartirRuta();
}
