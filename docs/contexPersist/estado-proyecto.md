# RechargeEV

## Objetivo

PWA para gestionar vehículos eléctricos que deben cargarse durante una jornada o turno de trabajo, especialmente pensada para uso móvil durante el turno de noche.

La aplicación permite registrar vehículos pendientes, consultar su ubicación, cambiar su estado, guardar listas, compartir datos entre dispositivos y trabajar con una interfaz sencilla y rápida.

## Stack

- HTML/CSS/JavaScript vanilla
- PWA instalable
- `localStorage` para persistencia local
- Backend Node.js/Express desplegable en Render
- API auxiliar `POST /api/analyze-maps-url`
- Leaflet + OpenStreetMap para mapas
- Open-Meteo para meteorología
- Nominatim/OpenStreetMap para geocodificación inversa
- Despliegue estático compatible con GitHub Pages desde `docs/`

## Funcionalidades actuales

- Lista de vehículos.
- Alta de vehículos con matrícula.
- Enlace de Google Maps por vehículo.
- Notas opcionales.
- Estados de vehículo:
  - pendiente
  - cargando
  - cargado
  - incidencia
- Edición de vehículos existentes.
- Borrado individual de vehículos.
- Borrado completo de la lista con confirmación.
- Obtención de coordenadas desde enlaces de Google Maps mediante backend auxiliar.
- Resolución de enlaces compartidos con identificador de lugar y sin coordenadas explícitas mediante el mapa incrustado de Google, verificando que las coordenadas pertenecen al lugar solicitado.
- Obtención de dirección postal aproximada mediante geocodificación inversa.
- Protección de conexiones del backend: dominios/rutas permitidos, validación de cada redirección, bloqueo de IP internas y conexión fijada a una IP pública validada, con límites de tiempo y descarga para Maps y Nominatim.
- Limitación de abuso en el endpoint de Maps: 20 peticiones por IP/red IPv6 y 60 globales por minuto y proceso, con respuesta 429 y tiempo de espera. Contadores en memoria; configuración de proxies documentada para verificar al desplegar en Render.
- CORS restringido a orígenes explícitos de Pages/Render, configurable mediante `CORS_ALLOWED_ORIGINS`, con desarrollo local separado. Errores de API uniformes en JSON sin detalles internos y mensajes legibles ante respuestas incompletas del servidor.
- Pruebas automáticas de seguridad y compatibilidad del backend mediante `npm test`, sin servicios externos reales.
- Visualización de vehículos en mapa con Leaflet.
- Apertura directa de ubicaciones en Google Maps.
- Ordenación manual por cercanía usando geolocalización del navegador.
- Estimación de tiempo desde una posición base.
- Guardado de listas históricas.
- Restauración y borrado de listas guardadas.
- Listas guardadas en una pantalla independiente (`#listas-guardadas`), con contador, Volver y navegación Atrás/Adelante. Acceso mediante un botón circular de archivo junto a los de sol y barras; al restaurar una lista se regresa a la pantalla principal.
- Exportación/importación de listas mediante texto JSON portable.
- Importación desde archivo JSON.
- Estadísticas de vehículos cargados por día, semana, mes o año en una pantalla independiente (`#estadisticas`), con botón Volver y navegación Atrás/Adelante, conservando el formulario al regresar.
- Registro automático de eventos cuando un vehículo pasa a estado `cargado`.
- Consulta de probabilidad de lluvia para el turno de 22:00 a 06:00 en una pantalla independiente (`#meteorologia`), con botón Volver y navegación Atrás/Adelante, conservando el formulario al regresar.
- PWA instalable.
- Service Worker con caché básica y estrategia Network First.
- Recepción de enlaces compartidos desde Google Maps mediante Web Share Target.
- Interfaz responsive orientada a móvil.
- Diseño oscuro adecuado para uso nocturno.

## Funcionalidades en desarrollo

- Puntos fijos de carga.
- Optimización de rutas.
- Asignación de vehículos a puntos de carga.
- Dos vehículos por punto de carga.
- Máximo aproximado de 400-500 m andando.
- Flujo pensado para un único operario.
- Mejora del cálculo de tiempos de recogida y desplazamiento.
- Priorización de vehículos según cercanía, estado y disponibilidad de puntos.
- Posible visualización de puntos de carga en el mapa.

## Restricciones

- Mantener compatibilidad móvil.
- No romper la PWA.
- Evitar dependencias innecesarias.
- Mantener la aplicación sencilla y fácil de entender.
- Priorizar cambios pequeños y verificables.
- Mantener la persistencia principal en `localStorage`, salvo petición explícita.
- No añadir base de datos externa sin decisión previa.
- No añadir dependencias npm sin confirmación.
- Validar y limpiar los datos introducidos por el usuario.
- Evitar guardar datos sensibles innecesarios.
- Mantener compatibilidad con despliegue estático desde `docs/`.

## Estado general

El proyecto funciona como una PWA ligera con frontend estático y un backend auxiliar para tareas de análisis de enlaces de Google Maps y geocodificación.

La aplicación no depende de una base de datos central: cada navegador conserva sus propios datos en `localStorage`. Para mover información entre dispositivos se usa exportación/importación de listas.

El siguiente bloque importante de evolución es incorporar lógica de puntos fijos de carga y optimización operativa para decidir dónde dejar cada vehículo, teniendo en cuenta distancia andando, capacidad de los puntos y trabajo de un único operario.
