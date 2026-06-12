# ⚡ RecargasVE

Aplicación web sencilla para llevar el control de vehículos eléctricos pendientes de cargar durante el turno de noche.

Pensada para ser rápida, clara y cómoda de usar desde móvil, con interfaz oscura y botones grandes para consultar, actualizar o borrar vehículos sin complicaciones.

![Node.js](https://img.shields.io/badge/Node.js-Express-22c55e?style=for-the-badge&logo=node.js&logoColor=white)
![Frontend](https://img.shields.io/badge/Frontend-HTML%20%2B%20CSS%20%2B%20JS-facc15?style=for-the-badge)
![Datos](https://img.shields.io/badge/Datos-localStorage-38bdf8?style=for-the-badge)

---

## ✨ Funcionalidades

- Añadir vehículos indicando:
  - matrícula
  - enlace de Google Maps
  - notas opcionales
- Ver todos los vehículos registrados.
- Cambiar el estado de cada vehículo:
  - 🟡 `pendiente`
  - 🔵 `cargando`
  - 🟢 `cargado`
  - 🔴 `incidencia`
- Abrir la ubicación directamente en Google Maps.
- Borrar vehículos cuando ya no sean necesarios.
- Guardado local en el navegador con `localStorage`.
- Diseño responsive pensado para móvil y uso nocturno.

---

## 🖼️ Vista general

La app está organizada en una única pantalla:

1. **Formulario superior** para registrar un vehículo.
2. **Listado de vehículos** con matrícula, estado, notas y acciones rápidas.
3. **Botones grandes** para marcar estados durante el turno.

---

## 🧰 Stack

- **Node.js**
- **Express**
- **HTML**
- **CSS**
- **JavaScript vanilla**
- Persistencia en `localStorage`

No utiliza frameworks de frontend ni base de datos externa. Los datos quedan guardados sólo en el navegador donde se usa la aplicación.

---

## 📁 Estructura del proyecto

```text
RecargasVoltio/
├── public/
│   ├── index.html            # Interfaz principal
│   ├── styles.css            # Estilos responsive y modo oscuro
│   └── app.js                # Lógica del frontend y localStorage
├── .clinerules               # Reglas del proyecto
├── .gitignore
├── package.json
├── package-lock.json
├── README.md
└── server.js                 # Servidor Express para archivos estáticos
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

No hay API de datos ni escritura en archivos JSON. Cada navegador/dispositivo mantiene su propia lista local.

### Ejemplo de vehículo

```json
{
  "id": "uuid-generado",
  "matricula": "1234ABC",
  "mapsUrl": "https://maps.google.com/...",
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
- Enlaces externos con `rel="noopener noreferrer"`.
- Escape de contenido antes de insertarlo en la interfaz.

---

## ✅ Cómo probar manualmente

1. Ejecuta `npm start`.
2. Abre `http://localhost:3000`.
3. Añade un vehículo con matrícula y enlace `https://` de Google Maps.
4. Comprueba que aparece en el listado como `pendiente`.
5. Cambia su estado a `cargando`, `cargado` o `incidencia`.
6. Pulsa **Abrir Maps** para comprobar el enlace.
7. Borra el vehículo y verifica que desaparece.
8. Recarga la página y verifica que los datos siguen apareciendo desde `localStorage`.

---

## 🎯 Objetivo del proyecto

Mantener una herramienta personal, ligera y fiable para gestionar recargas de vehículos eléctricos durante el trabajo, evitando hojas sueltas, notas perdidas o confusiones de estado.

---

## 📌 Notas de desarrollo

- Mantener cambios pequeños y verificables.
- No añadir dependencias npm sin confirmación previa.
- Mantener la persistencia sólo en `localStorage` salvo que se decida lo contrario.
- Priorizar una interfaz clara, responsive y usable de noche.
- Validar siempre los datos antes de guardarlos.
