# Arquitectura del proyecto RecargasVoltio

## Visión general

RecargasVoltio, también presentado en la interfaz como **RechargeEV** o **RecargasVE**, es una aplicación web sencilla para gestionar vehículos eléctricos pendientes de cargar durante un turno de noche.

La arquitectura está pensada para ser ligera, fácil de mantener y usable desde móvil:

- Frontend estático en `docs/` con HTML, CSS y JavaScript vanilla.
- Servidor Node.js con Express para servir la aplicación y exponer una API auxiliar.
- Persistencia local en el navegador mediante `localStorage`.
- Funcionalidades PWA mediante `manifest.json` y `service-worker.js`.
- Mapa interactivo con Leaflet y OpenStreetMap.
- Consulta meteorológica con Open-Meteo.
- Geocodificación inversa con Nominatim/OpenStreetMap desde el backend.

No utiliza frameworks de frontend ni base de datos externa.

## Stack tecnológico

### Backend

- **Node.js**
- **Express 5**
- Módulos CommonJS (`type: commonjs`)
- API propia para analizar enlaces de Google Maps
- Consumo externo de Nominatim para geocodificación inversa

### Frontend

- **HTML5**
- **CSS3**
- **JavaScript vanilla**
- **Leaflet 1.9.4** cargado desde CDN
- **OpenStreetMap** como proveedor de teselas del mapa
- **Open-Meteo** para predicción de lluvia

### Persistencia

La aplicación guarda datos exclusivamente en `localStorage`, usando claves como:

- `recargasVoltio.vehiculos`: lista actual de vehículos.
- `recargasVoltio.listasGuardadas`: listas históricas guardadas.
- `recargasVoltio.eventosCarga`: eventos estadísticos de vehículos marcados como cargados.

### PWA

La app es instalable como Progressive Web App mediante:

- `docs/manifest.json`
- `docs/service-worker.js`
- `docs/icons/icon-192.png`
- `docs/icons/icon-512.png`

El Service Worker usa una estrategia **Network First** con caché para permitir abrir la aplicación con recursos básicos incluso sin conexión.

## Estructura de carpetas

```text
RecargasVoltio/
├── data/
│   └── vehiculos.json              # Archivo actualmente vacío; la persistencia real está en localStorage
├── docs/
│   ├── contexPersist/
│   │   └── arquitectura.md         # Documento de arquitectura del proyecto
│   ├── icons/
│   │   ├── icon-192.png            # Icono PWA 192x192
│   │   └── icon-512.png            # Icono PWA 512x512
│   ├── app.js                      # Lógica principal del frontend
│   ├── index.html                  # Interfaz y estructura de la aplicación
│   ├── logo-recargas-ev.png        # Logo usado por la UI
│   ├── manifest.json               # Configuración PWA e integración Web Share Target
│   ├── service-worker.js           # Caché, instalación, activación y fetch handler
│   └── styles.css                  # Estilos responsive y tema visual
├── public/
│   └── icons/                      # Copia de iconos públicos
├── .clinerules                     # Reglas y contexto del proyecto
├── .gitignore                      # Exclusiones: node_modules, .env, .DS_Store
├── package.json                    # Scripts y dependencia Express
├── package-lock.json               # Lockfile de npm
├── README.md                       # Documentación funcional del proyecto
└── server.js                       # Servidor Express y API auxiliar
```

## Componentes principales

### 1. Servidor Express (`server.js`)

Responsabilidades:

- Crear la aplicación Express.
- Servir los archivos estáticos ubicados en `docs/`.
- Aceptar cuerpos JSON pequeños con `express.json({ limit: "20kb" })`.
- Restringir CORS de `/api` a los orígenes explícitos de GitHub Pages y Render, con configuración para otros entornos.
- Exponer el endpoint `POST /api/analyze-maps-url`.

Antes del parser JSON de ese endpoint se ejecuta `lib/rate-limit.js`: una ventana fija de 60 segundos admite 20 peticiones por cliente y 60 globales por proceso. Se usa `req.ip`, normalizando IPv4 mapeada y agrupando IPv6 por `/64`. El límite global acota también la memoria del registro de clientes. Los excesos devuelven JSON con estado 429 y `Retry-After`, conservando CORS, antes de iniciar conexiones externas. Las peticiones inválidas consumen cuota; `OPTIONS` y archivos estáticos quedan fuera. No se añaden dependencias ni almacenamiento persistente.

Express usa `trust proxy=0` en local y, como configuración inicial, `1` si `RENDER=true`. `TRUST_PROXY_HOPS` permite indicar de 0 a 5 saltos; debe corresponder a la cadena real de proxies, que se debe verificar al desplegar. Nunca se toma sin validar la primera IP de `X-Forwarded-For`. Las pruebas cubren cabeceras suplantadas con cero y un salto. Los contadores se reinician al reiniciar el proceso y no se comparten entre instancias; usuarios bajo una IP pública común comparten cuota.

`lib/api-http.js` centraliza CORS y los errores. La lista predeterminada de producción contiene `https://juanjdes.github.io` y `https://rechargeev-backend.onrender.com`; en desarrollo añade localhost/127.0.0.1 en los puertos 3000 y 8080. `CORS_ALLOWED_ORIGINS` sustituye la lista con orígenes exactos separados por comas. No se permiten comodines, rutas ni credenciales. CORS se ejecuta antes de la cuota y del parser JSON; las peticiones sin Origin siguen permitidas y sujetas a la cuota, porque CORS no es autenticación.

Los errores se serializan como `{ found: false, code, message }` y, en el 429, `retryAfter`. El manejador final de Express convierte errores del parser y fallos internos en mensajes controlados, sin trazas ni datos recibidos. Los fallos externos conservan 502/504; un análisis sin coordenadas conserva HTTP 200 y añade `COORDINATES_NOT_FOUND`. CORS también se aplica a respuestas de error para orígenes autorizados. Se admiten POST y preflight OPTIONS con Content-Type, se expone Retry-After y se deshabilita la caché de las respuestas de API. No se habilitan cookies/credenciales. El frontend maneja respuestas HTML o JSON incompleto con mensajes legibles.

Las conexiones salientes se realizan mediante `lib/safe-http.js`, usando `node:https`, `node:dns/promises` y `node:net`, sin dependencias nuevas. El módulo valida una lista explícita de dominios/rutas de Maps y cada redirección, comprueba todas las IP resueltas y fija la conexión a una IP pública validada conservando TLS/SNI. No se reutilizan conexiones de un agente compartido ni se realiza una segunda resolución DNS al conectar.

Los límites están centralizados en `LIMITS`: cinco redirecciones, 15 segundos para toda la operación, 2 MiB para Maps y 256 KiB para Nominatim; este último tiene además 5 segundos y no admite redirecciones. Se cuentan los bytes descargados y se abortan conexiones que exceden el plazo o tamaño. La espera de DNS también expira; una resolución tardía no abre una conexión. Las URLs que ya incluyen coordenadas evitan la descarga de Maps.

Se admiten las variantes `.com` y `.es` enumeradas en el README y los enlaces cortos de Maps. Los destinos de consentimiento y otros dominios regionales se rechazan. `test/safe-http.test.js` verifica estas reglas y la respuesta de la API con servicios externos simulados; se ejecuta mediante `npm test`.

Los enlaces con un identificador `!1s0x…:0x…` se resuelven con `lib/maps-place.js`: una vez validada la URL, `getMapsPage` permite detener la descarga mediante `stopAtUrl`. El servidor convierte la segunda parte del identificador a CID con `BigInt` y consulta una URL construida en `https://www.google.com/maps/embed`. Así evita descargar una página normal que puede devolver un mapa genérico o pedir consentimiento. La nueva consulta conserva todas las validaciones del cliente HTTP y comparte el plazo total de la operación.

El contenido de `initEmbed` se interpreta con `JSON.parse`, sin ejecutar JavaScript externo. Se busca el registro del identificador exacto y se validan sus coordenadas; el centro del mapa y los lugares distintos se descartan. Si Google cambia ese formato o no devuelve el lugar, el análisis devuelve `found: false`. `test/maps-place.test.js` cubre el parser y la suite HTTP comprueba el flujo completo con respuestas simuladas de enlaces móviles.

#### Endpoint `POST /api/analyze-maps-url`

Este endpoint recibe una URL de Google Maps y devuelve, cuando es posible:

- Si se encontraron coordenadas.
- Coordenadas `lat` y `lng`.
- URL final tras seguir redirecciones.
- Dirección postal aproximada obtenida por geocodificación inversa.

Flujo interno:

1. Valida que el cuerpo contenga `url`.
2. Comprueba que la URL sea válida, use HTTPS y pertenezca a los dominios y rutas permitidos.
3. Resuelve enlaces cortos comprobando cada redirección y la IP pública de cada conexión, dentro de los límites de tiempo y tamaño.
4. Intenta extraer coordenadas desde la URL final.
5. Si no las encuentra, busca coordenadas dentro del HTML recibido.
6. Si encuentra coordenadas, consulta Nominatim para obtener datos de dirección.
7. Devuelve una respuesta JSON al frontend.

Funciones relevantes:

- `extractCoordinates(text)`: detecta coordenadas en URLs o texto HTML mediante expresiones regulares.
- `reverseGeocodeCoordinates(coordinates)`: consulta Nominatim/OpenStreetMap.
- `buildAddressPayload(nominatimResult)`: normaliza los campos de dirección.
- `buildMapsAnalysisResponse(coordinates, finalUrl)`: compone la respuesta final.

### 2. Frontend estático (`docs/index.html`)

Define la estructura visual de la aplicación:

- Cabecera con logo.
- Pantalla independiente de meteorología, accesible mediante `#meteorologia` y con botón Volver.
- Pantalla independiente de estadísticas, accesible mediante `#estadisticas` y con botón Volver.
- Formulario para añadir o editar vehículos.
- Sección desplegable de mapa.
- Sección de listado de vehículos.
- Herramientas para ordenar por distancia, estimar tiempos, guardar, compartir e importar listas.
- Sección de listas guardadas.

Carga dependencias externas y locales:

- Leaflet CSS desde CDN.
- `manifest.json` para PWA.
- `styles.css` para estilos propios.
- Leaflet JS desde CDN.
- `app.js` para la lógica de la aplicación.

### 3. Lógica de cliente (`docs/app.js`)

Es el núcleo de la aplicación en navegador.

Responsabilidades principales:

- Leer y escribir vehículos en `localStorage`.
- Crear, editar, borrar y listar vehículos.
- Gestionar estados de vehículo:
  - `pendiente`
  - `cargando`
  - `cargado`
  - `incidencia`
- Registrar eventos de carga para estadísticas.
- Guardar y restaurar listas históricas.
- Exportar/importar listas en JSON portable.
- Integrarse con Web Share Target para recibir enlaces compartidos desde Google Maps.
- Llamar a la API auxiliar de análisis de URLs de Maps.
- Renderizar marcadores en el mapa con Leaflet.
- Ordenar vehículos por cercanía usando geolocalización del navegador.
- Estimar tiempo de recogida desde una base seleccionada.
- Consultar previsión de lluvia con Open-Meteo.
- Registrar el Service Worker.

La navegación a Meteorología y Estadísticas usa los fragmentos `#meteorologia` y `#estadisticas` y el historial del navegador, sin recargar el documento. `homeScreen`, `weatherPanel` y `statsPanel` son las tres vistas principales; sólo una está visible. Comparten las funciones de navegación `openAppScreen`, `closeAppScreen` y `syncAppScreen`. Al volver se conservan el formulario y los paneles de la sesión y se descartan las respuestas meteorológicas pendientes. Las entradas directas a ambas rutas también ofrecen regreso a la pantalla principal. Los filtros y el cálculo de estadísticas siguen utilizando los eventos locales existentes.

Constantes importantes:

```js
STORAGE_KEY = "recargasVoltio.vehiculos"
SAVED_LISTS_STORAGE_KEY = "recargasVoltio.listasGuardadas"
CHARGE_EVENTS_STORAGE_KEY = "recargasVoltio.eventosCarga"
MAPS_ANALYSIS_API_URL = "https://rechargeev-backend.onrender.com/api/analyze-maps-url"
WEATHER_FORECAST_API_URL = "https://api.open-meteo.com/v1/forecast"
```

### 4. Estilos (`docs/styles.css`)

Contiene el diseño visual de la app:

- Interfaz responsive orientada a móvil.
- Tema oscuro cómodo para uso nocturno.
- Botones grandes y accesibles.
- Tarjetas para formularios, listados, paneles y mapa.
- Estilos para estados de vehículos, mensajes, paneles desplegables y elementos PWA.

### 5. PWA (`docs/manifest.json` y `docs/service-worker.js`)

#### `manifest.json`

Configura la instalación de la aplicación como PWA:

- Nombre: `RechargeEV`
- `display: standalone`
- `start_url: ./index.html`
- `scope: ./`
- Iconos de 192x192 y 512x512
- `share_target` con método GET para recibir `title`, `text` y `url`

El `share_target` permite que la app instalada aparezca como destino al compartir enlaces desde Google Maps.

#### `service-worker.js`

Define:

- Nombre de caché: `rechargeev-v6`.
- App shell con archivos básicos:
  - `index.html`
  - `styles.css`
  - `app.js`
  - `manifest.json`
  - iconos PWA
- Evento `install` para precachear recursos.
- Evento `activate` para borrar cachés antiguas.
- Evento `fetch` para aplicar estrategia Network First en peticiones GET.

## Flujo de datos principal

### Alta de vehículo

```text
Usuario introduce matrícula + URL de Google Maps + notas
        ↓
app.js valida y limpia los datos
        ↓
app.js llama a /api/analyze-maps-url usando MAPS_ANALYSIS_API_URL
        ↓
server.js sigue redirecciones y extrae coordenadas
        ↓
server.js consulta Nominatim para dirección postal
        ↓
app.js crea el objeto vehículo
        ↓
localStorage guarda la lista actualizada
        ↓
UI y mapa se vuelven a renderizar
```

### Cambio de estado a cargado

```text
Usuario cambia estado del vehículo a cargado
        ↓
app.js actualiza el vehículo en localStorage
        ↓
app.js registra evento de carga del día si no existe duplicado
        ↓
Pantalla de estadísticas puede mostrar el conteo por día, semana, mes o año
```

### Compartir/importar lista

```text
Usuario exporta lista
        ↓
app.js genera JSON portable con appId, tipo y versión
        ↓
Usuario copia texto o descarga archivo
        ↓
Otro dispositivo importa el JSON
        ↓
app.js valida estructura y restaura/mezcla vehículos en localStorage
```

### Uso como PWA compartiendo desde Google Maps

```text
Usuario comparte una ubicación desde Google Maps
        ↓
Sistema abre RechargeEV como Web Share Target
        ↓
index.html recibe parámetros title/text/url
        ↓
app.js detecta y extrae el enlace de Google Maps
        ↓
Formulario se precarga con la URL
        ↓
Usuario añade matrícula y guarda el vehículo
```

## Integraciones externas

### Leaflet + OpenStreetMap

Se usa para mostrar vehículos con coordenadas sobre un mapa interactivo en el navegador.

### Google Maps

La app no usa una API oficial de Google Maps. Recibe enlaces compartidos o pegados por el usuario y el backend intenta extraer coordenadas desde la URL final o el HTML obtenido.

### Nominatim/OpenStreetMap

El backend usa Nominatim para convertir coordenadas en información postal legible:

- calle
- número
- código postal
- barrio/zona
- ciudad/localidad
- provincia
- país

### Open-Meteo

El frontend consulta Open-Meteo directamente para obtener probabilidad de lluvia durante el turno de 22:00 a 06:00.

## Modelo de datos conceptual

### Vehículo

Un vehículo gestionado por la app contiene conceptualmente:

```text
id                Identificador único
matricula         Matrícula introducida por el usuario
mapsUrl           Enlace de Google Maps
notas             Texto opcional
estado            pendiente | cargando | cargado | incidencia
createdAt         Fecha de creación
updatedAt         Fecha de última actualización
coordinates       Coordenadas lat/lng si se pudieron obtener
address           Dirección postal normalizada si está disponible
```

### Evento de carga

Registro usado para estadísticas:

```text
id o clave interna
matricula
vehicleId
fecha/día del evento
createdAt
```

### Lista guardada

Instantánea de la lista actual:

```text
id
name o fecha visible
createdAt
vehicles[]
```

## Despliegue y ejecución

### Desarrollo local con backend

```bash
npm install
npm start
```

La aplicación queda disponible en:

```text
http://localhost:3000
```

### Servir sólo la versión estática

```bash
cd docs
python -m http.server 8080
```

Disponible en:

```text
http://localhost:8080/
```

Desde localhost/127.0.0.1 el frontend usa el backend local en el puerto 3000; para analizar enlaces con el servidor estático de 8080 también debe estar arrancado `npm start`. La versión publicada conserva la URL del backend de Render.

### GitHub Pages

La carpeta `docs/` está preparada para despliegue estático en GitHub Pages.

## Consideraciones de seguridad y mantenimiento

- La persistencia se mantiene en el navegador, no en servidor.
- No se guardan datos sensibles innecesarios.
- El backend limita el tamaño del JSON recibido a `20kb`.
- Se validan URLs y se exige HTTPS en el endpoint de análisis.
- Los datos introducidos por el usuario deben limpiarse y validarse antes de guardarse o mostrarse.
- El proyecto prioriza cambios pequeños y mantenibles.
- No se deben añadir dependencias npm sin confirmación previa.

## Decisiones arquitectónicas relevantes

1. **Frontend sin framework**: reduce complejidad y facilita el despliegue como sitio estático.
2. **Persistencia en localStorage**: suficiente para uso personal/laboral local, sin infraestructura de base de datos.
3. **Backend mínimo**: sólo resuelve tareas que el frontend no puede hacer de forma fiable, como seguir redirecciones y geocodificar.
4. **PWA instalable**: permite uso cómodo desde móvil e integración con compartir desde Google Maps.
5. **`docs/` como raíz estática**: facilita publicar en GitHub Pages.
6. **APIs externas sin clave para mapa y meteorología**: Leaflet/OpenStreetMap y Open-Meteo reducen dependencias de servicios de pago.
