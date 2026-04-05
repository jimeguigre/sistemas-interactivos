# Sistema de avisos en la navegación

## Instalar
```bash
npm install
```

## Ejecutar
```bash
npm start
```

Servidor:
```text
https://localhost:3000
```

## Importante
El certificado incluido es de prueba. El navegador te mostrará un aviso de seguridad.
Para probar en local:
- entra a la URL
- acepta la excepción de seguridad
- después ya podrás usar la app

## Probar en el móvil
1. Conecta móvil y ordenador a la misma Wi‑Fi.
2. Averigua la IP local del ordenador.
3. Abre en el móvil:
```text
https://IP_DEL_ORDENADOR:3000
```

Ejemplo:
```text
https://192.168.1.34:3000
```

El móvil probablemente avisará de que el certificado no es de confianza. Es normal con este certificado de prueba.

## Flujo rápido

### 1. Inicio de la aplicación
- El usuario accede a la app desde el navegador (HTTPS)
- Se solicitan permisos (ubicación, micrófono, cámara)
- Se inicializa el mapa y los sensores

### 2. Creación de ruta
- El usuario introduce un destino
- Se calcula la ruta mediante servicio externo (OSRM)
- La ruta se dibuja en el mapa

### 3. Inicio de navegación
- Se activa el seguimiento GPS en tiempo real
- Se muestra la posición del usuario en el mapa
- Se actualiza el progreso sobre la ruta

### 4. Monitorización de ruta
- Se calcula continuamente la distancia del usuario a la ruta
- Si se supera un umbral:
  - Se detecta salida de ruta
  - Se recalcula automáticamente desde la posición actual

### 5. Gestión de avisos
- El usuario puede crear avisos por voz (`aviso`)
- El sistema solicita confirmación y mensaje
- El aviso se envía al servidor (Socket.IO)
- Otros usuarios lo reciben en tiempo real

### 6. Filtrado de avisos
- Cada cliente recibe todos los avisos
- Solo se muestran los cercanos a su ruta actual

### 7. Eliminación de avisos
- El usuario puede borrar avisos:
  - por voz (`borrar aviso`) una vez pasados (los suyos y ajenos)
  - desde el panel "Tus avisos" (los suyos)
- El cambio se sincroniza en todos los clientes

### 8. Detector de somnolencia
- El usuario activa el detector desde el panel
- Se accede a la cámara frontal
- Se detecta la cara y los ojos (MediaPipe)
- Se calcula el EAR (apertura de ojos)

### 9. Detección de alerta
- Si los ojos permanecen cerrados un tiempo:
  - Se lanza alerta visual
  - Se reproduce alarma sonora

### 10. Fin de navegación
- El usuario pulsa "Salir de conducción"
- Se detiene el GPS
- Se limpia la ruta y estado
- La app vuelve al estado inicial
