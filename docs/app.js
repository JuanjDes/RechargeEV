const vehicleForm = document.getElementById("vehicleForm");
const vehicleList = document.getElementById("vehicleList");
const vehiclesToggle = document.getElementById("vehiclesToggle");
const vehiclesCount = document.getElementById("vehiclesCount");
const mapToggle = document.getElementById("mapToggle");
const mapContent = document.getElementById("mapContent");
const vehicleSubmitButton = document.getElementById("vehicleSubmitButton");
const cancelEditButton = document.getElementById("cancelEditButton");
const STORAGE_KEY = "recargasVoltio.vehiculos";
const MAPS_ANALYSIS_API_URL = "https://rechargeev-backend.onrender.com/api/analyze-maps-url";
const ALLOWED_STATES = ["pendiente", "cargando", "cargado", "incidencia"];
const DEFAULT_MAP_CENTER = [40.4168, -3.7038];
const DEFAULT_MAP_ZOOM = 6;
let editingVehicleId = null;
let vehiclesMap = null;
let markersLayer = null;

// Limpia textos de usuario y limita su tamaño antes de guardarlos.
function cleanText(value, maxLength = 300) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

// Genera un identificador único para cada vehículo.
function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Lee los vehículos guardados en localStorage de forma segura.
function readVehicles() {
  const storedVehicles = localStorage.getItem(STORAGE_KEY);

  if (!storedVehicles) return [];

  try {
    const vehicles = JSON.parse(storedVehicles);
    return Array.isArray(vehicles) ? vehicles : [];
  } catch {
    return [];
  }
}

// Persiste toda la lista en localStorage.
function writeVehicles(vehicles) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles));
}

// Busca un vehículo concreto dentro del almacenamiento local.
function findVehicleById(id) {
  return readVehicles().find((item) => item.id === id);
}

// Cambia el formulario entre modo creación y edición.
function setFormMode(mode) {
  const isEditing = mode === "edit";
  vehicleSubmitButton.textContent = isEditing ? "Guardar cambios" : "Añadir vehículo";
  cancelEditButton.hidden = !isEditing;
}

// Limpia el formulario y vuelve al modo creación.
function resetVehicleForm() {
  editingVehicleId = null;
  vehicleForm.reset();
  setFormMode("create");
}

// Valida, obtiene coordenadas y añade un nuevo vehículo a la lista local.
async function createVehicle(vehicle) {
  const matricula = cleanText(vehicle.matricula, 20).toUpperCase();
  const mapsUrl = cleanText(vehicle.mapsUrl, 500);
  const notas = cleanText(vehicle.notas, 500);

  if (!matricula || !mapsUrl) {
    throw new Error("Matrícula y enlace de Google Maps son obligatorios");
  }

  if (!mapsUrl.startsWith("https://")) {
    throw new Error("El enlace debe empezar por https://");
  }

  const mapsAnalysis = await analyzeMapsUrl(mapsUrl);
  const vehicles = readVehicles();
  const now = new Date().toISOString();
  const newVehicle = {
    id: createId(),
    matricula,
    mapsUrl,
    coordinates: mapsAnalysis.coordinates,
    address: mapsAnalysis.address,
    estado: "pendiente",
    notas,
    createdAt: now,
    updatedAt: now,
  };

  vehicles.push(newVehicle);
  writeVehicles(vehicles);

  return newVehicle;
}

// Actualiza solo los campos recibidos de un vehículo existente.
async function updateVehicle(id, data) {
  const vehicles = readVehicles();
  const vehicle = vehicles.find((item) => item.id === id);

  if (!vehicle) {
    throw new Error("Vehículo no encontrado");
  }

  if (data.estado !== undefined) {
    if (!ALLOWED_STATES.includes(data.estado)) {
      throw new Error("Estado no válido");
    }
    vehicle.estado = data.estado;
  }

  if (data.notas !== undefined) {
    vehicle.notas = cleanText(data.notas, 500);
  }

  if (data.matricula !== undefined) {
    const matricula = cleanText(data.matricula, 20).toUpperCase();

    if (!matricula) {
      throw new Error("La matrícula es obligatoria");
    }

    vehicle.matricula = matricula;
  }

  if (data.mapsUrl !== undefined) {
    const mapsUrl = cleanText(data.mapsUrl, 500);
    const mapsUrlChanged = mapsUrl !== vehicle.mapsUrl;

    if (!mapsUrl) {
      throw new Error("El enlace de Google Maps es obligatorio");
    }

    if (!mapsUrl.startsWith("https://")) {
      throw new Error("El enlace debe empezar por https://");
    }

    if (mapsUrlChanged || !isValidCoordinates(vehicle.coordinates) || !hasAddressData(vehicle.address)) {
      const mapsAnalysis = await analyzeMapsUrl(mapsUrl);
      vehicle.coordinates = mapsAnalysis.coordinates;
      vehicle.address = mapsAnalysis.address;
    }

    vehicle.mapsUrl = mapsUrl;
  }

  vehicle.updatedAt = new Date().toISOString();
  writeVehicles(vehicles);

  return vehicle;
}

// Elimina un vehículo por id y guarda la lista resultante.
function deleteVehicle(id) {
  const vehicles = readVehicles();
  const filteredVehicles = vehicles.filter((item) => item.id !== id);

  if (filteredVehicles.length === vehicles.length) {
    throw new Error("Vehículo no encontrado");
  }

  writeVehicles(filteredVehicles);
}

// Escapa datos de usuario antes de insertarlos con innerHTML.
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}

// Comprueba que las coordenadas recibidas sean utilizables por Leaflet.
function isValidCoordinates(coordinates) {
  return (
    coordinates &&
    Number.isFinite(coordinates.lat) &&
    Number.isFinite(coordinates.lng) &&
    coordinates.lat >= -90 &&
    coordinates.lat <= 90 &&
    coordinates.lng >= -180 &&
    coordinates.lng <= 180
  );
}

// Comprueba que la dirección tenga al menos un dato útil para mostrar.
function hasAddressData(address) {
  return Boolean(address && (address.road || address.postcode || address.displayName));
}

// Formatea la calle/dirección principal para mostrarla en la tarjeta.
function formatStreetAddress(address) {
  if (!hasAddressData(address)) return "";

  const streetParts = [address.road, address.houseNumber].filter(Boolean);

  if (streetParts.length > 0) {
    return streetParts.join(", ");
  }

  return address.displayName || "";
}

// Elige el campo más útil de Nominatim para mostrar como localidad/zona.
function formatLocality(address) {
  if (!address) return "";

  return (
    address.locality ||
    address.suburb ||
    address.neighbourhood ||
    address.quarter ||
    address.cityDistrict ||
    address.city ||
    ""
  );
}

// Pide al backend que resuelva la URL de Maps y devuelva coordenadas y dirección postal.
async function analyzeMapsUrl(mapsUrl) {
  const response = await fetch(MAPS_ANALYSIS_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: mapsUrl }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "No se pudo analizar la URL");
  }

  if (!result.found || !isValidCoordinates(result.coordinates)) {
    throw new Error(result.message || "No se pudieron obtener coordenadas de esta URL de Google Maps");
  }

  return {
    coordinates: result.coordinates,
    address: result.address || null,
  };
}

// Crea el mapa una sola vez y prepara la capa de marcadores.
function initMap() {
  vehiclesMap = L.map("vehiclesMap").setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
  markersLayer = L.layerGroup().addTo(vehiclesMap);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap",
    maxZoom: 19,
  }).addTo(vehiclesMap);
}

// Fuerza a Leaflet a recalcular el tamaño real del contenedor.
function refreshMapSize() {
  if (!vehiclesMap) return;

  setTimeout(() => {
    vehiclesMap.invalidateSize();
  }, 100);
}

// Redibuja todos los marcadores a partir de los vehículos guardados.
function renderVehicleMarkers(vehicles) {
  if (!markersLayer) return;

  markersLayer.clearLayers();

  const vehiclesWithCoordinates = vehicles.filter((vehicle) => isValidCoordinates(vehicle.coordinates));

  vehiclesWithCoordinates.forEach((vehicle) => {
    const popupContent = `
      <strong>${escapeHtml(vehicle.matricula)}</strong><br>
      ${escapeHtml(vehicle.notas || "Sin notas")}<br>
      <a class="popup-maps-link" href="${escapeHtml(vehicle.mapsUrl)}" target="_blank" rel="noopener noreferrer">
        Navegar
      </a>
    `;

    L.marker([vehicle.coordinates.lat, vehicle.coordinates.lng])
      .bindPopup(popupContent)
      .addTo(markersLayer);
  });

  if (vehiclesWithCoordinates.length > 0) {
    const bounds = L.latLngBounds(
      vehiclesWithCoordinates.map((vehicle) => [vehicle.coordinates.lat, vehicle.coordinates.lng])
    );

    vehiclesMap.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
  } else {
    vehiclesMap.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
  }
}

// Pinta la lista completa de vehículos en pantalla.
function renderVehicles(vehicles) {
  vehiclesCount.textContent = vehicles.length;
  vehicleList.innerHTML = "";

  if (vehicles.length === 0) {
    vehicleList.innerHTML = `<p class="empty">No hay vehículos todavía.</p>`;
    return;
  }

  vehicles.forEach((vehicle) => {
    const card = document.createElement("article");
    card.className = "vehicle-card";
    const streetAddress = formatStreetAddress(vehicle.address);
    const postcode = vehicle.address?.postcode || "";
    const locality = formatLocality(vehicle.address);
    const postcodeLocality = [postcode, locality].filter(Boolean).join(" · ");
    const addressHtml = hasAddressData(vehicle.address)
      ? `
          <p class="vehicle-address">
            ${streetAddress ? `<span><strong>Dirección:</strong> ${escapeHtml(streetAddress)}</span>` : ""}
            ${postcodeLocality ? `<span><strong>CP / Localidad:</strong> ${escapeHtml(postcodeLocality)}</span>` : ""}
          </p>
        `
      : "";

    card.innerHTML = `
      <details class="vehicle-actions-dropdown">
        <summary>
          <div class="vehicle-summary">
            <h3>${escapeHtml(vehicle.matricula)}</h3>
            <span class="vehicle-status-toggle">
              <span class="estado ${escapeHtml(vehicle.estado)}">${escapeHtml(vehicle.estado)}</span>
              <span class="dropdown-arrow" aria-hidden="true">▼</span>
            </span>
          </div>
          <p>${escapeHtml(vehicle.notas || "Sin notas")}</p>
          ${addressHtml}
        </summary>

        <div class="actions">
          <a href="${escapeHtml(vehicle.mapsUrl)}" target="_blank" rel="noopener noreferrer">
            Abrir Maps
          </a>

          <button data-id="${vehicle.id}" data-estado="cargando">Cargando</button>
          <button data-id="${vehicle.id}" data-estado="cargado">Cargado</button>
          <button data-id="${vehicle.id}" data-estado="incidencia">Incidencia</button>
          <button class="edit" data-id="${vehicle.id}" data-edit="true">Editar</button>
          <button class="delete" data-id="${vehicle.id}" data-delete="true">Borrar</button>
        </div>
      </details>
    `;

    vehicleList.appendChild(card);
  });
}

// Carga los vehículos guardados y actualiza la interfaz.
function loadVehicles() {
  try {
    const vehicles = readVehicles();
    renderVehicles(vehicles);
    renderVehicleMarkers(vehicles);
  } catch (error) {
    vehicleList.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
  }
}

// Alta o edición de vehículo desde el formulario principal.
vehicleForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const matricula = document.getElementById("matricula").value.trim();
  const mapsUrl = document.getElementById("mapsUrl").value.trim();
  const notas = document.getElementById("notas").value.trim();

  try {
    vehicleSubmitButton.disabled = true;
    vehicleSubmitButton.textContent = "Obteniendo ubicación...";

    if (editingVehicleId) {
      await updateVehicle(editingVehicleId, { matricula, mapsUrl, notas });
    } else {
      await createVehicle({ matricula, mapsUrl, notas });
    }

    resetVehicleForm();
    loadVehicles();
  } catch (error) {
    alert(error.message);
  } finally {
    vehicleSubmitButton.disabled = false;
    setFormMode(editingVehicleId ? "edit" : "create");
  }
});

cancelEditButton.addEventListener("click", () => {
  resetVehicleForm();
});

// Gestiona acciones de cada tarjeta usando delegación de eventos.
vehicleList.addEventListener("click", async (event) => {
  const button = event.target.closest("button");

  if (!button) return;

  const id = button.dataset.id;

  try {
    if (button.dataset.edit === "true") {
      const vehicle = findVehicleById(id);

      if (!vehicle) {
        throw new Error("Vehículo no encontrado");
      }

      editingVehicleId = id;
      document.getElementById("matricula").value = vehicle.matricula;
      document.getElementById("mapsUrl").value = vehicle.mapsUrl;
      document.getElementById("notas").value = vehicle.notas || "";
      setFormMode("edit");
      vehicleForm.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (button.dataset.delete === "true") {
      const confirmDelete = confirm("¿Borrar este vehículo?");
      if (!confirmDelete) return;

      deleteVehicle(id);
    } else {
      await updateVehicle(id, {
        estado: button.dataset.estado,
      });
    }

    loadVehicles();
  } catch (error) {
    alert(error.message);
  }
});

// Muestra u oculta la lista de vehículos.
vehiclesToggle.addEventListener("click", () => {
  const isExpanded = vehiclesToggle.getAttribute("aria-expanded") === "true";

  vehiclesToggle.setAttribute("aria-expanded", String(!isExpanded));
  vehicleList.hidden = isExpanded;
});

// Muestra u oculta el mapa de vehículos.
mapToggle.addEventListener("click", () => {
  const isExpanded = mapToggle.getAttribute("aria-expanded") === "true";

  mapToggle.setAttribute("aria-expanded", String(!isExpanded));
  mapContent.hidden = isExpanded;

  if (!isExpanded) {
    refreshMapSize();
  }
});

initMap();
loadVehicles();
refreshMapSize();
window.addEventListener("resize", refreshMapSize);
