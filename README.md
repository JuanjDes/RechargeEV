# ⚡ RecargasVE

Aplicación web sencilla para llevar el control de vehículos eléctricos pendientes de cargar durante el turno de noche.

Pensada para ser rápida, clara y cómoda de usar desde móvil, con interfaz oscura y botones grandes para consultar, actualizar o borrar vehículos sin complicaciones.

![Node.js](https://img.shields.io/badge/Node.js-Express-22c55e?style=for-the-badge&logo=node.js&logoColor=white)
![Frontend](https://img.shields.io/badge/Frontend-HTML%20%2B%20CSS%20%2B%20JS-facc15?style=for-the-badge)
![Datos](https://img.shields.io/badge/Datos-localStorage-38bdf8?style=for-the-badge)
![Mapas](https://img.shields.io/badge/Mapas-Leaflet%20%2B%20OpenStreetMap-22c55e?style=for-the-badge)

---

## ✨ Funcionalidades

- Añadir vehículos indicando:
  - matrícula
  - enlace de Google Maps
  - notas opcionales
- Obtener coordenadas a partir del enlace de Google Maps mediante una API auxiliar.
- Ver los vehículos ubicados en un mapa interactivo con Leaflet y OpenStreetMap.
- Ver todos los vehículos registrados.
- Mostrar u ocultar el listado de vehículos con contador.
- Cambiar el estado de cada vehículo:
  - 🟡 `pendiente`
  - 🔵 `cargando`
  - 🟢 `cargado`
  - 🔴 `incidencia`
- Editar matrícula, enlace de Google Maps y notas de un vehículo existente.
- Abrir la ubicación directamente en Google Maps.
- Borrar vehículos cuando ya no sean necesarios.
- Guardado local en el navegador con `localStorage`.
- Diseño responsive pensado para móvil y uso nocturno.

---

## 🖼️ Vista general

La app está organizada en una única pantalla:

1. **Formulario superior** para registrar un vehículo.
2. **Mapa interactivo** con la posición de los vehículos registrados.
3. **Listado plegable de vehículos** con matrícula, estado, notas y acciones rápidas.
4. **Botones grandes** para editar, abrir Maps, marcar estados o borrar durante el turno.

---

## 🧰 Stack

- **Node.js**
- **Express**
- **HTML**
- **CSS**
- **JavaScript vanilla**
- **Leaflet**
- **OpenStreetMap**
- Persistencia en `localStorage`

No utiliza frameworks de frontend ni base de datos externa. Los datos quedan guardados sólo en el navegador donde se usa la aplicación.

El servidor Express también expone una API auxiliar para analizar enlaces de Google Maps y extraer coordenadas, necesarias para pintar los marcadores en el mapa.

---

## 📁 Estructura del proyecto

```text
RecargasVoltio/
├── docs/
│   ├── index.html            # Interfaz principal
│   ├── styles.css            # Estilos responsive, modo oscuro y mapa
│   └── app.js                # Lógica del frontend, mapa y localStorage
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

---

## Persistencia local

La aplicación guarda los vehículos directamente en `localStorage`, usando la clave:

```text
recargasVoltio.vehiculos
```

No hay API de datos ni escritura en archivos JSON para guardar vehículos. Cada navegador/dispositivo mantiene su propia lista local.

La API del servidor se usa sólo para analizar enlaces de Google Maps y devolver coordenadas; no persiste datos.

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

El servidor incluye un endpoint para resolver enlaces de Google Maps y obtener coordenadas:

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
  "finalUrl": "https://..."
}
```

Esta API sigue redirecciones de URLs cortas de Google Maps e intenta extraer coordenadas tanto de la URL final como del contenido recibido.

---

## ✅ Cómo probar manualmente

1. Ejecuta `npm start`.
2. Abre `http://localhost:3000`.
3. Añade un vehículo con matrícula y enlace `https://` de Google Maps.
4. Comprueba que se obtienen coordenadas y aparece un marcador en el mapa.
5. Despliega el listado y verifica que el vehículo aparece como `pendiente`.
6. Edita el vehículo y comprueba que se actualizan sus datos.
7. Cambia su estado a `cargando`, `cargado` o `incidencia`.
8. Pulsa **Abrir Maps** o **Navegar** en el marcador para comprobar el enlace.
9. Borra el vehículo y verifica que desaparece del listado y del mapa.
10. Recarga la página y verifica que los datos siguen apareciendo desde `localStorage`.

---

## 🎯 Objetivo del proyecto

Mantener una herramienta personal, ligera y fiable para gestionar recargas de vehículos eléctricos durante el trabajo, evitando hojas sueltas, notas perdidas o confusiones de estado.

---

## 📌 Notas de desarrollo

- Mantener cambios pequeños y verificables.
- No añadir dependencias npm sin confirmación previa.
- Mantener la persistencia sólo en `localStorage` salvo que se decida lo contrario.
- Usar la API sólo para análisis de URLs y coordenadas, no para persistencia.
- Priorizar una interfaz clara, responsive y usable de noche.
- Validar siempre los datos antes de guardarlos.
