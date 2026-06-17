const vehicleForm = document.getElementById("vehicleForm");
const vehicleList = document.getElementById("vehicleList");
const vehiclesToggle = document.getElementById("vehiclesToggle");
const vehiclesCount = document.getElementById("vehiclesCount");
const deleteAllVehiclesButton = document.getElementById("deleteAllVehiclesButton");
const sortByDistanceButton = document.getElementById("sortByDistanceButton");
const mapToggle = document.getElementById("mapToggle");
const mapContent = document.getElementById("mapContent");
const vehicleSubmitButton = document.getElementById("vehicleSubmitButton");
const cancelEditButton = document.getElementById("cancelEditButton");
const STORAGE_KEY = "recargasVoltio.vehiculos";
const MAPS_ANALYSIS_API_URL = "https://rechargeev-backend.onrender.com/api/analyze-maps-url";
const ALLOWED_STATES = ["pendiente", "cargando", "cargado", "incidencia"];
const STATE_COLORS = {
  pendiente: "#facc15",
  cargando: "#38bdf8",
  cargado: "#22c55e",
  incidencia: "#ef4444",
};
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

// Elimina todos los vehículos guardados de una sola vez.
function deleteAllVehicles() {
  writeVehicles([]);
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

// Convierte grados a radianes para calcular distancias geográficas.
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

// Calcula la distancia aproximada en kilómetros entre dos coordenadas lat/lng.
function calculateDistanceKm(origin, destination) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(destination.lat - origin.lat);
  const dLng = toRadians(destination.lng - origin.lng);
  const originLat = toRadians(origin.lat);
  const destinationLat = toRadians(destination.lat);

  const haversineValue =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(originLat) * Math.cos(destinationLat) * Math.sin(dLng / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversineValue), Math.sqrt(1 - haversineValue));
}

// Formatea una distancia para mostrarla de forma legible en la tarjeta.
function formatDistanceKm(distanceKm) {
  if (!Number.isFinite(distanceKm)) return "";

  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }

  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`;
}

// Pide al navegador la ubicación actual solo cuando el usuario pulsa ordenar.
function getCurrentUserCoordinates() {
  if (!navigator.geolocation) {
    return Promise.reject(new Error("Tu navegador no permite obtener la ubicación actual"));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        if (!isValidCoordinates(coordinates)) {
          reject(new Error("No se pudo obtener una ubicación válida"));
          return;
        }

        resolve(coordinates);
      },
      () => reject(new Error("No se pudo obtener tu ubicación. Revisa los permisos del navegador.")),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  });
}

// Ordena creando una ruta: primero el más cercano al usuario y después el más cercano al anterior.
function sortVehiclesByNearestRoute(vehicles, startCoordinates) {
  const pendingVehicles = vehicles
    .filter((vehicle) => isValidCoordinates(vehicle.coordinates))
    .map((vehicle) => ({ ...vehicle }));
  const vehiclesWithoutCoordinates = vehicles
    .filter((vehicle) => !isValidCoordinates(vehicle.coordinates))
    .map((vehicle) => ({ ...vehicle, routeDistanceKm: null, routeDistanceLabel: "Sin coordenadas" }));
  const orderedVehicles = [];
  let currentCoordinates = startCoordinates;

  while (pendingVehicles.length > 0) {
    let nearestIndex = 0;
    let nearestDistanceKm = calculateDistanceKm(currentCoordinates, pendingVehicles[0].coordinates);

    for (let index = 1; index < pendingVehicles.length; index += 1) {
      const distanceKm = calculateDistanceKm(currentCoordinates, pendingVehicles[index].coordinates);

      if (distanceKm < nearestDistanceKm) {
        nearestIndex = index;
        nearestDistanceKm = distanceKm;
      }
    }

    const [nearestVehicle] = pendingVehicles.splice(nearestIndex, 1);
    orderedVehicles.push({
      ...nearestVehicle,
      routeDistanceKm: nearestDistanceKm,
      routeDistanceLabel: orderedVehicles.length === 0 ? "desde posición" : "desde anterior",
    });
    currentCoordinates = nearestVehicle.coordinates;
  }

  return [...orderedVehicles, ...vehiclesWithoutCoordinates];
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

// Crea un marcador con el mismo color visual que el estado del vehículo.
function createVehicleMarkerIcon(estado) {
  const markerColor = STATE_COLORS[estado] || STATE_COLORS.pendiente;

  return L.divIcon({
    className: "vehicle-map-marker-wrapper",
    html: `<span class="vehicle-map-marker" style="--marker-color: ${markerColor}"></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
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

    L.marker([vehicle.coordinates.lat, vehicle.coordinates.lng], {
      icon: createVehicleMarkerIcon(vehicle.estado),
    })
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
  deleteAllVehiclesButton.hidden = vehicles.length === 0;
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
            ${postcodeLocality ? `<span><strong>CP/Local :</strong> ${escapeHtml(postcodeLocality)}</span>` : ""}
          </p>
        `
      : "";
    const routeDistanceHtml = Number.isFinite(vehicle.routeDistanceKm)
      ? `
          <p class="vehicle-route-distance">
            <strong>Distancia:</strong> ${escapeHtml(formatDistanceKm(vehicle.routeDistanceKm))}
            ${escapeHtml(vehicle.routeDistanceLabel || "")}
          </p>
        `
      : vehicle.routeDistanceLabel
        ? `
            <p class="vehicle-route-distance vehicle-route-distance-muted">
              ${escapeHtml(vehicle.routeDistanceLabel)}
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
          ${routeDistanceHtml}
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
    vehicleSubmitButton.textContent = "Ubicación...";

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

deleteAllVehiclesButton.addEventListener("click", (event) => {
  event.stopPropagation();

  const confirmDelete = confirm("¿Borrar todos los vehículos?");
  if (!confirmDelete) return;

  deleteAllVehicles();
  resetVehicleForm();
  loadVehicles();
});

deleteAllVehiclesButton.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;

  event.preventDefault();
  deleteAllVehiclesButton.click();
});

sortByDistanceButton.addEventListener("click", async (event) => {
  event.stopPropagation();

  try {
    sortByDistanceButton.setAttribute("aria-disabled", "true");
    sortByDistanceButton.textContent = "Ubicación...";

    const vehicles = readVehicles();

    if (vehicles.length === 0) {
      return;
    }

    const userCoordinates = await getCurrentUserCoordinates();
    const sortedVehicles = sortVehiclesByNearestRoute(vehicles, userCoordinates);
    renderVehicles(sortedVehicles);
    renderVehicleMarkers(sortedVehicles);
  } catch (error) {
    alert(error.message);
  } finally {
    sortByDistanceButton.removeAttribute("aria-disabled");
    sortByDistanceButton.textContent = "Ordenar";
  }
});

sortByDistanceButton.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;

  event.preventDefault();
  sortByDistanceButton.click();
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
