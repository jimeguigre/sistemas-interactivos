# Sistema de avisos en la navegacion

## Instalar
```bash
npm install
```

## Ejecutar

### PowerShell
```bash
$env:SMTP_HOST="smtp.gmail.com"
$env:SMTP_PORT="587"
$env:SMTP_USER="appnavegacionavisos@gmail.com"
$env:SMTP_PASS="aepfjaaxbfvejgeu"
$env:SMTP_FROM="appnavegacionavisos@gmail.com"
npm start
```
### CMD
```bash
set SMTP_HOST=smtp.gmail.com
set SMTP_PORT=587
set SMTP_USER=appnavegacionavisos@gmail.com
set SMTP_PASS=aepfjaaxbfvejgeu
set SMTP_FROM=appnavegacionavisos@gmail.com
npm start
```

Servidor:
```text
https://localhost:3000
```

## Importante
El certificado incluido es de prueba. El navegador te mostrara un aviso de seguridad.
Para probar en local:
- entra a la URL
- acepta la excepcion de seguridad
- despues ya podras usar la app

## Probar en el movil
1. Conecta movil y ordenador a la misma Wi-Fi
2. Averigua la IP local del ordenador
3. Abre en el movil:
```text
https://IP_DEL_ORDENADOR:3000
```

Ejemplo:
```text
https://192.168.1.34:3000
```

El movil probablemente avisara de que el certificado no es de confianza. Es normal con este certificado de prueba.

## Flujo rapido

### 1. Inicio de la aplicacion
- El usuario accede a la app desde el navegador HTTPS
- Se solicitan permisos de ubicacion, microfono y camara
- Se inicializa el mapa y los sensores
- El detector de frenazo siempre empieza apagado al abrir la app

### 2. Creacion de ruta
- El usuario introduce un destino
- Se calcula la ruta mediante un servicio externo
- La ruta se dibuja en el mapa

### 3. Inicio de navegacion
- Se activa el seguimiento GPS en tiempo real
- Se muestra la posicion del usuario en el mapa
- Se actualiza el progreso sobre la ruta

### 4. Monitorizacion de ruta
- Se calcula continuamente la distancia del usuario a la ruta
- Si se supera un umbral, se detecta salida de ruta
- Cuando hace falta, la ruta se recalcula automaticamente desde la posicion actual

### 5. Gestion de avisos
- El usuario puede crear avisos por voz con `aviso`
- El sistema solicita confirmacion y mensaje
- El aviso se envia al servidor con Socket.IO
- Otros usuarios lo reciben en tiempo real

### 6. Filtrado de avisos
- Cada cliente recibe todos los avisos
- Solo se muestran los cercanos a su ruta actual
- Avisa de cada aviso cuando está alrededor de 150 m y posteriormente cuando está a 50 m

### 7. Eliminacion de avisos
- El usuario puede borrar avisos por voz con `borrar aviso` una vez pasados (ajenos y propios)
- Tambien puede borrarlos desde el panel `Tus avisos` (propios)
- El cambio se sincroniza en todos los clientes

### 8. Detector de somnolencia
- El usuario activa el detector desde el panel
- Se accede a la camara frontal
- Se detectan los ojos con MediaPipe
- Se calcula el EAR, que mide la apertura de ojos
- Si los ojos permanecen cerrados un tiempo suficiente, se lanza una alarma sonora

### 9. Detector de frenazo
- El detector se enciende desde el panel de privacidad con `Encender detector de frenazo`
- Al encenderlo aparece un popup para indicar nombre y correo del contacto de emergencia
- El contacto es obligatorio y queda guardado para la siguiente vez
- El detector funciona aunque no se haya creado ni empezado una ruta
- Al detectar un frenazo fuerte, la app pregunta por voz si el usuario esta bien
- Si el usuario responde que esta bien, se cancela la emergencia y no se envia correo
- Si responde que necesita ayuda o no responde a tiempo (20 s), se envia un email al contacto de emergencia
- El frenazo usa la escucha principal de la app para evitar conflictos con el microfono

### 10. Fin de navegacion
- El usuario pulsa `Salir de conduccion`
- Se detiene el GPS
- Se limpia la ruta y el estado
- La app vuelve al estado inicial



## Compartir ruta en tiempo real

La app tambien permite compartir una ruta con otra persona dentro de la misma red local.

### Que hace
- El conductor puede generar un enlace despues de crear una ruta
- Ese enlace usa la IP local del servidor
- El espectador abre el enlace y ve la ruta, el destino y la posicion del conductor en tiempo real
- El espectador puede enviar mensajes al conductor
- Esos mensajes se leen por voz en la app principal despues de los avisos o locuciones que ya estuvieran sonando
- El panel de compartir se abre y se cierra pulsando de nuevo `Compartir ruta`
- En movil el panel se muestra centrado y con botones adaptados para que no se salgan de la pantalla

### Flujo de uso
1. El conductor crea una ruta
2. Pulsa `Compartir ruta`
3. Copia o comparte el enlace generado
4. La otra persona abre el enlace desde un dispositivo conectado a la misma red
5. Cuando el conductor pulsa `Empezar ruta`, el seguimiento pasa a estar activo
6. Si la ruta se recalcula o cambia la posicion, el espectador lo ve al momento
7. Cuando el conductor pulsa `Salir de conduccion`, la sesion compartida termina

### Comportamiento importante
- Si se pulsa `Compartir ruta` antes de crear una ruta, la app avisa de que primero hay que crearla
- Si el panel ya esta abierto, al pulsar otra vez `Compartir ruta` se cierra
- El enlace compartido deja de servir cuando termina la conduccion
- Al terminar la conduccion, el espectador ve un aviso y ya no puede enviar mensajes ni interactuar con esa sesion
- La vista del espectador se abre desde `/seguimiento/CODIGO`
- Durante la conduccion la app intenta mantener la pantalla encendida para evitar que el navegador suspenda el GPS o la conexion
- Si el conductor pierde la conexion durante unos segundos, la sesion compartida espera hasta 45 s antes de cerrarse
- Si el usuario bloquea manualmente el movil o el navegador no soporta mantener la pantalla encendida, el sistema operativo puede pausar la app igualmente

## Notas sobre permisos y guardado

- Usa siempre la misma URL para probar, por ejemplo siempre `https://IP_DEL_ORDENADOR:3000`
- `localhost`, `127.0.0.1` y la IP local tienen almacenamientos distintos en el navegador
- El contacto de emergencia queda guardado en el navegador del dispositivo
- El detector de frenazo no queda encendido tras recargar: por seguridad siempre arranca apagado
- Si el reconocimiento de voz falla al arrancar, la app no borra la preferencia del microfono; lo deja pendiente de reactivar con una pulsacion
