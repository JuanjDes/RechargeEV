# ⚡ RecargasVE

Aplicación web sencilla para llevar el control de vehículos eléctricos pendientes de cargar durante el turno de noche.

Pensada para ser rápida, clara y cómoda de usar desde móvil, con interfaz oscura y botones grandes para consultar, actualizar o borrar vehículos sin complicaciones.

![Node.js](https://img.shields.io/badge/Node.js-Express-22c55e?style=for-the-badge&logo=node.js&logoColor=white)
![Frontend](https://img.shields.io/badge/Frontend-HTML%20%2B%20CSS%20%2B%20JS-facc15?style=for-the-badge)
![Datos](https://img.shields.io/badge/Datos-localStorage-38bdf8?style=for-the-badge)
![Mapas](https://img.shields.io/badge/Mapas-Leaflet%20%2B%20OpenStreetMap-22c55e?style=for-the-badge)
![Meteo](https://img.shields.io/badge/Meteo-Open--Meteo-0ea5e9?style=for-the-badge)
![PWA](https://img.shields.io/badge/PWA-Instalable-7c3aed?style=for-the-badge)
![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub%20Pages-111827?style=for-the-badge&logo=github&logoColor=white)

---

## ✨ Funcionalidades

- Añadir vehículos indicando:
  - matrícula
  - enlace de Google Maps
  - notas opcionales
- Obtener coordenadas a partir del enlace de Google Maps mediante una API auxiliar.
- Obtener dirección postal, código postal y localidad/zona mediante geocodificación inversa.
- Ver los vehículos ubicados en un mapa interactivo con Leaflet y OpenStreetMap.
- Ver todos los vehículos registrados.
- Mostrar u ocultar el listado de vehículos con contador.
- Ver dirección, CP y localidad en la tarjeta de cada vehículo cuando estén disponibles.
- Ordenar manualmente los vehículos por cercanía usando tu ubicación actual:
  - primero el vehículo más cercano a tu posición,
  - después el más cercano al vehículo anterior,
  - y así sucesivamente.
- Calcular el tiempo estimado para traer todos los vehículos a una posición base:
  - seleccionando como base una de las direcciones de la lista;
  - estimando ida y vuelta desde la base a cada vehículo;
  - sumando 5 minutos por cada cambio de coche;
  - ajustando la velocidad media estimada en km/h.
- Consultar la probabilidad de lluvia en tu ubicación actual para el turno de 22:00 a 06:00:
  - mediante el botón **Meteorología**;
  - solicitando permiso de ubicación al navegador;
  - mostrando la probabilidad máxima y media del turno;
  - incluyendo un desglose por horas;
  - usando Open-Meteo sin necesidad de API key.
- Cambiar el estado de cada vehículo:
  - 🟡 `pendiente`
  - 🔵 `cargando`
  - 🟢 `cargado`
  - 🔴 `incidencia`
- Editar matrícula, enlace de Google Maps y notas de un vehículo existente.
- Abrir la ubicación directamente en Google Maps.
- Recibir enlaces compartidos desde Google Maps cuando la app está instalada como PWA.
- Borrar vehículos cuando ya no sean necesarios.
- Borrar todos los vehículos de una sola vez con confirmación previa.
- Guardar la lista actual completa con fecha y hora para consultarla después.
- Ver, restaurar o borrar listas históricas guardadas.
- Preparar la lista actual para compartirla con otro dispositivo mediante un texto JSON portable.
- Importar una lista recibida pegando el texto exportado o seleccionando un archivo `.json`.
- Fusionar listas importadas evitando duplicados, o reemplazar la lista actual previa confirmación.
- Guardado local en el navegador con `localStorage`.
- Instalable como PWA con `manifest.json` y Service Worker.
- Carga básica offline de la interfaz mediante caché local.
- Avisos visibles dentro de la app para modo offline, errores de red y acciones que requieren internet.
- Preparada para publicarse desde la carpeta `docs/` en GitHub Pages.
- Diseño responsive pensado para móvil y uso nocturno.

---

## 🖼️ Vista general

La app está organizada en una única pantalla:

1. **Botón Meteorología** para consultar la probabilidad de lluvia del turno de 22:00 a 06:00.
2. **Formulario superior** para registrar un vehículo.
3. **Mapa interactivo** con la posición de los vehículos registrados.
4. **Listado plegable de vehículos** con matrícula, estado, notas, dirección, CP/localidad, ordenación por cercanía y acciones rápidas.
5. **Panel de transferencia de listas** para copiar, descargar, pegar o importar una lista de vehículos entre dispositivos.
6. **Histórico de listas guardadas** con fecha/hora de creación, consulta de vehículos, restauración y borrado.
7. **Botones grandes** para editar, abrir Maps, marcar estados, guardar listas, compartir/importar listas, borrar un vehículo o borrar todos durante el turno.

---

## 🧰 Stack

- **Node.js**
- **Express**
- **HTML**
- **CSS**
- **JavaScript vanilla**
- **Leaflet**
- **OpenStreetMap**
- **Nominatim / OpenStreetMap** para geocodificación inversa
- **Open-Meteo** para previsión meteorológica por horas
- **Geolocation API** del navegador para consultar datos según la ubicación actual
- Persistencia en `localStorage`
- **PWA estándar** con `manifest.json` y `service-worker.js`
- **GitHub Pages** como despliegue estático desde `docs/`

No utiliza frameworks de frontend ni base de datos externa. Los datos quedan guardados sólo en el navegador donde se usa la aplicación.

El servidor Express también expone una API auxiliar para analizar enlaces de Google Maps, extraer coordenadas y obtener datos de dirección postal mediante geocodificación inversa, necesarios para pintar los marcadores en el mapa y mostrar la ubicación de forma legible.

---

## 📁 Estructura del proyecto

```text
RecargasVoltio/
├── docs/
│   ├── index.html            # Interfaz principal
│   ├── styles.css            # Estilos responsive, modo oscuro, mapa y avisos PWA/offline
│   ├── app.js                # Lógica del frontend, mapa, localStorage y registro del Service Worker
│   ├── manifest.json         # Manifiesto PWA instalable
│   ├── service-worker.js     # Caché básica, activación y estrategia Network First
│   └── icons/
│       ├── icon-192.png      # Icono PWA 192x192
│       └── icon-512.png      # Icono PWA 512x512
├── .clinerules               # Reglas del proyecto
├── .gitignore
├── package.json
├── package-lock.json
├── README.md
└── server.js                 # Servidor Express y API de análisis de URLs de Maps
```

---

## 🚀 Instalación y uso

### 1. Instalar dependencias

```bash
npm install
```

### 2. Arrancar la aplicación

```bash
npm start
```

También puedes usar:

```bash
npm run dev
```

### 3. Abrir en el navegador

```text
http://localhost:3000
```

### Probar la versión estática de `docs/`

Para probar la misma carpeta pensada para GitHub Pages puedes levantar un servidor local desde `docs`:

```bash
cd docs
python -m http.server 8080
```

Y abrir:

```text
http://localhost:8080/
```

> Importante: no abras `index.html` directamente con `file://`, porque el Service Worker y algunas capacidades PWA requieren HTTP/HTTPS.

---

## 📲 PWA instalable

La aplicación está preparada como **Progressive Web App** bajo el nombre **RechargeEV**.

Archivos principales:

- `docs/manifest.json`
- `docs/service-worker.js`
- `docs/icons/icon-192.png`
- `docs/icons/icon-512.png`

El manifiesto define:

- `name`: `RechargeEV`
- `short_name`: `RechargeEV`
- `start_url`: `./index.html`
- `scope`: `./`
- `display`: `standalone`
- iconos de `192x192` y `512x512`
- `share_target` mediante `GET` y `application/x-www-form-urlencoded` para recibir `title`, `text` y `url`, abriendo `./index.html`

### Compartir desde Google Maps

Cuando la PWA está instalada en un navegador compatible, puede aparecer como destino al usar **Compartir** desde Google Maps.

Flujo previsto:

1. Abre una ubicación en Google Maps.
2. Pulsa **Compartir**.
3. Selecciona **RechargeEV** como destino.
4. La app se abrirá y precargará automáticamente el campo **Enlace de Google Maps**.
5. Introduce la matrícula y pulsa **Añadir vehículo**.

La app revisa los campos compartidos `url`, `text` y `title`, ya que Google Maps puede enviar el enlace en ubicaciones distintas según el dispositivo o navegador. No se crea el vehículo automáticamente porque la matrícula sigue siendo obligatoria y el análisis de coordenadas requiere conexión.

`index.html` enlaza el manifiesto con ruta relativa:

```html
<link rel="manifest" href="./manifest.json" />
```

`app.js` registra el Service Worker con ruta relativa compatible con GitHub Pages:

```js
navigator.serviceWorker.register("./service-worker.js")
```

---

## 📴 Funcionamiento offline

El Service Worker crea una caché llamada:

```text
rechargeev-v3
```

Y precachea los recursos básicos de la app:

- `index.html`
- `styles.css`
- `app.js`
- `manifest.json`
- `icons/icon-192.png`
- `icons/icon-512.png`

La estrategia de red es **Network First**:

1. Intenta obtener el recurso desde la red.
2. Si la red responde correctamente, guarda una copia en caché.
3. Si la red falla, devuelve la copia cacheada cuando exista.

El Service Worker sólo gestiona peticiones `GET`. Las peticiones `POST`, `PUT`, `PATCH` o `DELETE` no se cachean.

### Limitaciones offline

La app puede abrir la interfaz básica sin conexión, pero hay funciones que siguen necesitando internet:

- Añadir un vehículo o cambiar su enlace de Google Maps requiere llamar al backend para analizar la URL y obtener coordenadas.
- El mapa usa Leaflet y teselas externas de OpenStreetMap; sin conexión puede verse limitado o incompleto.
- La geocodificación inversa también depende de servicios externos.
- La consulta de meteorología requiere internet, permiso de ubicación y disponibilidad del servicio externo Open-Meteo.

Para evitar errores técnicos como `Failed to fetch`, la interfaz muestra mensajes visibles cuando:

- no hay conexión;
- una acción requiere internet;
- se restaura la conexión;
- ocurre un error de red o validación.

---

## 🌍 Publicación en GitHub Pages

La app está preparada para publicarse desde la carpeta `docs/`.

Configuración recomendada en GitHub:

1. Subir el proyecto al repositorio.
2. Ir a **Settings > Pages**.
3. En **Build and deployment**, seleccionar:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` o `master`
   - **Folder**: `/docs`
4. Guardar los cambios.

GitHub Pages publicará una URL similar a:

```text
https://TU_USUARIO.github.io/NOMBRE_REPOSITORIO/
```

GitHub Pages sirve por HTTPS, requisito necesario para Service Workers y PWAs instalables.

Después de publicar, conviene revisar en DevTools > **Application**:

- Manifest cargado correctamente.
- Service Worker registrado y activo.
- Cache Storage con `rechargeev-v3`.
- Opción de instalación disponible en el navegador.

Si se publica una nueva versión y el navegador conserva datos antiguos, puede ser útil usar:

- **Unregister Service Worker**
- **Clear site data**

---

## Persistencia local

La aplicación guarda los vehículos directamente en `localStorage`, usando la clave:

```text
recargasVoltio.vehiculos
```

Las listas históricas guardadas se almacenan en otra clave de `localStorage`:

```text
recargasVoltio.listasGuardadas
```

Cada lista guardada contiene un identificador, la fecha/hora `createdAt` y una copia completa de los vehículos que estaban en la lista activa en ese momento. Consultar una lista guardada no modifica la lista actual. Si se usa **Restaurar como actual**, la aplicación pide confirmación y sustituye la lista activa por una copia de esa lista histórica.

No hay API de datos ni escritura en archivos JSON para guardar vehículos. Cada navegador/dispositivo mantiene su propia lista local.

La API del servidor se usa sólo para analizar enlaces de Google Maps y devolver coordenadas; no persiste datos.

### Transferencia de listas entre dispositivos

La app permite pasar la lista actual de vehículos a otro dispositivo con la misma aplicación sin usar cuentas, base de datos ni sincronización automática.

El botón **Compartir** prepara un paquete JSON portable con esta estructura general:

```json
{
  "app": "RechargeEV",
  "type": "vehicles-list",
  "version": 1,
  "exportedAt": "2026-01-01T00:00:00.000Z",
  "vehicles": []
}
```

En móviles/PWA algunos navegadores bloquean el diálogo nativo de compartir o la descarga automática con errores como `Permission denied`. Para evitarlo, la app no abre `navigator.share()` automáticamente. En su lugar muestra un **panel de transferencia** dentro de la propia interfaz:

- **Copiar texto**: copia el JSON para pegarlo en WhatsApp, correo, notas u otra app.
- **Descargar JSON**: genera un archivo `.json` como alternativa.
- Si el portapapeles también está bloqueado, el texto queda visible y seleccionado para poder copiarlo manualmente.

En el otro dispositivo, el botón **Importar** abre el mismo panel en modo importación:

- se puede pegar el texto recibido y pulsar **Importar texto**;
- o seleccionar un archivo `.json` con **Elegir archivo**.

Al importar, la app valida que el contenido sea una lista exportada por RechargeEV y pregunta qué hacer:

- **Aceptar**: reemplaza la lista actual por la lista importada.
- **Cancelar**: añade los vehículos importados a la lista actual evitando duplicados por matrícula y enlace de Google Maps.

Esta transferencia crea una copia puntual de la lista. No mantiene sincronización continua entre dispositivos.

## Ordenación por cercanía

El listado incluye el botón **Ordenar por cercanía**. Al pulsarlo, la aplicación solicita permiso para obtener tu ubicación actual mediante la API de geolocalización del navegador.

Con esa posición inicial, los vehículos se ordenan usando un criterio de **vecino más cercano**:

1. Se selecciona primero el vehículo más cercano a tu ubicación.
2. Después se selecciona el vehículo no visitado más cercano al vehículo anterior.
3. El proceso se repite hasta ordenar toda la lista.

Cuando se aplica este orden, cada tarjeta muestra una distancia aproximada:

- `desde tu posición` para el primer vehículo.
- `desde el vehículo anterior` para los siguientes.

Los vehículos sin coordenadas válidas se mantienen al final del listado como **Sin coordenadas**.

Esta ordenación sólo cambia la vista actual: no reescribe el orden guardado en `localStorage`. Si se rechaza el permiso de ubicación o el navegador no puede obtenerla, se muestra un aviso y la lista permanece sin cambios.

## Meteorología del turno

El botón **Meteorología**, situado al principio de la pantalla, abre un panel para consultar la probabilidad de lluvia durante el turno nocturno:

```text
de 22:00 a 06:00
```

Al pulsarlo, la app solicita la ubicación actual mediante la API de geolocalización del navegador y consulta la previsión horaria en **Open-Meteo**. No requiere API key ni configuración adicional.

El panel muestra:

- cabecera centrada con el título **Probabilidad de lluvia**;
- botón **Cerrar** debajo de la cabecera;
- horario del turno debajo del botón;
- tarjeta resumen con sólo dos datos:
  - **Máxima** probabilidad de lluvia del turno;
  - **Media** de probabilidad de lluvia del turno;
- desglose por horas entre las 22:00 y las 06:00.

La tarjeta de resumen mantiene **Máxima** y **Media** centradas y en una sola línea para facilitar la lectura rápida desde móvil.

Esta función requiere conexión a internet y permiso de ubicación. Si el permiso se rechaza, no hay conexión o el servicio meteorológico no responde, la app muestra un aviso visible dentro de la interfaz.


## Tiempo estimado desde posición base

El listado incluye el botón **Tiempo base**. Esta opción permite elegir uno de los vehículos/direcciones guardados como **posición base** y estimar cuánto se tardaría en traer el resto de vehículos hasta esa base para cargarlos.

El cálculo usa las coordenadas ya guardadas en cada vehículo y una velocidad media configurable, por defecto **30 km/h**. Para cada vehículo distinto de la base se estima:

```text
ida base → vehículo + 5 min de cambio + vuelta vehículo → base
```

La app muestra:

- vehículo elegido como base;
- número de vehículos incluidos;
- distancia total estimada de ida/vuelta;
- tiempo estimado de conducción;
- tiempo total de cambios, sumando 5 minutos por vehículo;
- tiempo total estimado;
- desglose por vehículo.

Los vehículos sin coordenadas válidas no se incluyen en el cálculo y se muestran en un aviso dentro del panel. La estimación es aproximada porque usa distancia geográfica entre coordenadas, no rutas reales ni tráfico.

### Ejemplo de vehículo

```json
{
  "id": "uuid-generado",
  "matricula": "1234ABC",
  "mapsUrl": "https://maps.google.com/...",
  "coordinates": {
    "lat": 40.4168,
    "lng": -3.7038
  },
  "address": {
    "road": "Calle de ejemplo",
    "houseNumber": "10",
    "postcode": "28013",
    "locality": "Madrid",
    "city": "Madrid",
    "province": "Comunidad de Madrid",
    "country": "España",
    "displayName": "Calle de ejemplo, 10, 28013 Madrid, España"
  },
  "estado": "pendiente",
  "notas": "Cargar antes de las 06:00",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

---

## 🛡️ Seguridad y validaciones

El frontend aplica validaciones básicas para mantener la app segura y sencilla:

- Limpieza y recorte de textos recibidos.
- Matrículas convertidas a mayúsculas.
- Estados limitados a valores permitidos.
- Enlaces obligados a empezar por `https://`.
- Validación de formato de URL en backend antes de analizarla.
- Coordenadas limitadas a rangos válidos de latitud y longitud.
- Enlaces externos con `rel="noopener noreferrer"`.
- Escape de contenido antes de insertarlo en la interfaz.

---

## 🌐 API auxiliar

El servidor incluye un endpoint para resolver enlaces de Google Maps, obtener coordenadas y consultar una dirección postal aproximada mediante Nominatim / OpenStreetMap:

```text
POST /api/analyze-maps-url
```

Entrada esperada:

```json
{
  "url": "https://maps.google.com/..."
}
```

Respuesta cuando encuentra coordenadas:

```json
{
  "found": true,
  "coordinates": {
    "lat": 40.4168,
    "lng": -3.7038
  },
  "address": {
    "road": "Calle de ejemplo",
    "houseNumber": "10",
    "postcode": "28013",
    "locality": "Madrid",
    "suburb": "",
    "neighbourhood": "",
    "quarter": "",
    "cityDistrict": "Centro",
    "city": "Madrid",
    "province": "Comunidad de Madrid",
    "country": "España",
    "displayName": "Calle de ejemplo, 10, Centro, 28013 Madrid, España",
    "rawAddress": {}
  },
  "finalUrl": "https://..."
}
```

Esta API sigue redirecciones de URLs cortas de Google Maps, intenta extraer coordenadas tanto de la URL final como del contenido recibido y, si las encuentra, hace geocodificación inversa para devolver datos de dirección. La dirección puede ser parcial o `null` si el servicio externo no devuelve información útil.

---

## ✅ Cómo probar manualmente

1. Ejecuta `npm start`.
2. Abre `http://localhost:3000`.
3. Añade un vehículo con matrícula y enlace `https://` de Google Maps.
4. Comprueba que se obtienen coordenadas y aparece un marcador en el mapa.
5. Despliega el listado y verifica que el vehículo aparece como `pendiente`.
6. Comprueba que, si la geocodificación inversa devuelve datos, se muestran dirección, CP y localidad/zona en la tarjeta.
7. Edita el vehículo y comprueba que se actualizan sus datos, incluida la dirección si cambia el enlace de Maps.
8. Cambia su estado a `cargando`, `cargado` o `incidencia`.
9. Pulsa **Meteorología**, acepta el permiso de ubicación y comprueba que aparece el panel con **Máxima**, **Media** y desglose horario de lluvia.
10. Cierra el panel con **Cerrar** y verifica que vuelve a ocultarse correctamente.
11. Opcionalmente rechaza el permiso de ubicación o prueba sin conexión para comprobar que aparece un mensaje de error claro.
12. Pulsa **Ordenar por cercanía**, acepta el permiso de ubicación y comprueba que la lista se reordena mostrando distancias aproximadas.
13. Pulsa **Tiempo base**, selecciona un vehículo como base y comprueba que se muestra el tiempo total estimado con 5 minutos de cambio por cada vehículo incluido.
14. Cambia la velocidad media estimada y verifica que se recalculan los tiempos.
15. Pulsa **Abrir Maps** o **Navegar** en el marcador para comprobar el enlace.
16. Borra un vehículo y verifica que desaparece del listado y del mapa.
17. Pulsa **Guardar lista** y comprueba que aparece una entrada en **Listas guardadas** con fecha/hora y número de vehículos.
18. Despliega la lista guardada y verifica que se pueden consultar sus vehículos sin modificar la lista activa.
19. Usa **Restaurar como actual**, confirma la acción y comprueba que la lista activa vuelve a tener los vehículos guardados.
20. Borra una lista guardada y verifica que desaparece del histórico.
21. Pulsa **Compartir** y comprueba que aparece el panel de transferencia con el JSON de la lista actual.
22. Usa **Copiar texto** y pega el contenido en otra app, por ejemplo WhatsApp o notas.
23. Pulsa **Importar**, pega ese texto en el panel y usa **Importar texto**.
24. Comprueba que la app permite reemplazar la lista actual o añadir los vehículos sin duplicados.
25. Opcionalmente usa **Descargar JSON** y luego **Elegir archivo** para validar la importación desde archivo.
26. Usa **Borrar Todos**, confirma la acción y comprueba que se vacía el listado.
27. Recarga la página y verifica que los datos siguen apareciendo desde `localStorage` cuando no se han borrado.
28. Abre DevTools > **Application** y comprueba que el manifiesto y el Service Worker se cargan correctamente.
29. Comprueba que existe la caché `rechargeev-v3` en **Cache Storage**.
30. Activa modo offline, recarga la app y verifica que la interfaz básica sigue cargando.
31. En modo offline, intenta añadir un vehículo y comprueba que aparece un mensaje visible indicando que se necesita internet para analizar enlaces de Google Maps.
32. Abre el mapa en modo offline y verifica que aparece el aviso de mapa limitado sin conexión.
33. Vuelve a online y comprueba que aparece el mensaje de conexión restaurada.
34. Con la PWA instalada, comparte una ubicación desde Google Maps hacia **RechargeEV** y comprueba que se precarga el campo **Enlace de Google Maps**.

---

## 🎯 Objetivo del proyecto

Mantener una herramienta personal, ligera y fiable para gestionar recargas de vehículos eléctricos durante el trabajo, evitando hojas sueltas, notas perdidas o confusiones de estado.

---

## 📌 Notas de desarrollo

- Mantener cambios pequeños y verificables.
- No añadir dependencias npm sin confirmación previa.
- Mantener la persistencia sólo en `localStorage` salvo que se decida lo contrario.
- Usar la API sólo para análisis de URLs y coordenadas, no para persistencia.
- Tratar la dirección obtenida por geocodificación inversa como información auxiliar que puede ser parcial.
- Priorizar una interfaz clara, responsive y usable de noche.
- Validar siempre los datos antes de guardarlos.
- Mantener rutas relativas (`./...`) en `manifest.json`, `index.html`, `app.js` y `service-worker.js` para conservar compatibilidad con GitHub Pages.
- Evitar abrir `navigator.share()` automáticamente para exportar listas, porque en algunos móviles/PWA puede fallar con `Permission denied`; priorizar el panel manual con texto visible y seleccionable.
- Si cambian los assets importantes de la PWA, incrementar la versión de caché, por ejemplo de `rechargeev-v2` a `rechargeev-v3`.
- Recordar que el backend externo sigue siendo necesario para analizar URLs de Google Maps; la PWA no puede crear coordenadas nuevas completamente offline.
