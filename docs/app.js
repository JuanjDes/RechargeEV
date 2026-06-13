const vehicleForm = document.getElementById("vehicleForm");
const vehicleList = document.getElementById("vehicleList");
const vehiclesToggle = document.getElementById("vehiclesToggle");
const vehiclesCount = document.getElementById("vehiclesCount");
const vehicleSubmitButton = document.getElementById("vehicleSubmitButton");
const cancelEditButton = document.getElementById("cancelEditButton");
const analyzeMapsUrlButton = document.getElementById("analyzeMapsUrlButton");
const mapsUrlAnalysisResult = document.getElementById("mapsUrlAnalysisResult");
const STORAGE_KEY = "recargasVoltio.vehiculos";
const MAPS_ANALYSIS_API_URL = "https://rechargeev-backend.onrender.com/api/analyze-maps-url";
const ALLOWED_STATES = ["pendiente", "cargando", "cargado", "incidencia"];
let editingVehicleId = null;

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

// Valida y añade un nuevo vehículo a la lista local.
function createVehicle(vehicle) {
  const matricula = cleanText(vehicle.matricula, 20).toUpperCase();
  const mapsUrl = cleanText(vehicle.mapsUrl, 500);
  const notas = cleanText(vehicle.notas, 500);

  if (!matricula || !mapsUrl) {
    throw new Error("Matrícula y enlace de Google Maps son obligatorios");
  }

  if (!mapsUrl.startsWith("https://")) {
    throw new Error("El enlace debe empezar por https://");
  }

  const vehicles = readVehicles();
  const now = new Date().toISOString();
  const newVehicle = {
    id: createId(),
    matricula,
    mapsUrl,
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
function updateVehicle(id, data) {
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

    if (!mapsUrl) {
      throw new Error("El enlace de Google Maps es obligatorio");
    }

    if (!mapsUrl.startsWith("https://")) {
      throw new Error("El enlace debe empezar por https://");
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

// Muestra el resultado del análisis de Google Maps.
function showMapsAnalysisResult(message, type = "info") {
  mapsUrlAnalysisResult.className = `analysis-result ${type}`;
  mapsUrlAnalysisResult.textContent = message;
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
  } catch (error) {
    vehicleList.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
  }
}

// Alta o edición de vehículo desde el formulario principal.
vehicleForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const matricula = document.getElementById("matricula").value.trim();
  const mapsUrl = document.getElementById("mapsUrl").value.trim();
  const notas = document.getElementById("notas").value.trim();

  try {
    if (editingVehicleId) {
      updateVehicle(editingVehicleId, { matricula, mapsUrl, notas });
    } else {
      createVehicle({ matricula, mapsUrl, notas });
    }

    resetVehicleForm();
    loadVehicles();
  } catch (error) {
    alert(error.message);
  }
});

cancelEditButton.addEventListener("click", () => {
  resetVehicleForm();
});

// Envía la URL al backend de Render para extraer coordenadas.
analyzeMapsUrlButton.addEventListener("click", async () => {
  const mapsUrl = document.getElementById("mapsUrl").value.trim();

  if (!mapsUrl) {
    showMapsAnalysisResult("Pega primero una URL de Google Maps en el formulario.", "error");
    return;
  }

  analyzeMapsUrlButton.disabled = true;
  showMapsAnalysisResult("Analizando URL... Render Free puede tardar unos segundos si estaba dormido.", "loading");

  try {
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

    if (!result.found || !result.coordinates) {
      showMapsAnalysisResult(result.message || "No se encontraron coordenadas en la URL analizada.", "error");
      return;
    }

    showMapsAnalysisResult(
      `Coordenadas encontradas: Latitud ${result.coordinates.lat}, Longitud ${result.coordinates.lng}`,
      "success"
    );
  } catch (error) {
    showMapsAnalysisResult(error.message, "error");
  } finally {
    analyzeMapsUrlButton.disabled = false;
  }
});

// Gestiona acciones de cada tarjeta usando delegación de eventos.
vehicleList.addEventListener("click", (event) => {
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
      updateVehicle(id, {
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

loadVehicles();
