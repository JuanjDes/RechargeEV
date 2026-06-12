const vehicleForm = document.getElementById("vehicleForm");
const vehicleList = document.getElementById("vehicleList");
const vehiclesToggle = document.getElementById("vehiclesToggle");
const vehiclesCount = document.getElementById("vehiclesCount");
const vehicleSubmitButton = document.getElementById("vehicleSubmitButton");
const cancelEditButton = document.getElementById("cancelEditButton");
const STORAGE_KEY = "recargasVoltio.vehiculos";
const ALLOWED_STATES = ["pendiente", "cargando", "cargado", "incidencia"];
let editingVehicleId = null;

function cleanText(value, maxLength = 300) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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

function writeVehicles(vehicles) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles));
}

function findVehicleById(id) {
  return readVehicles().find((item) => item.id === id);
}

function setFormMode(mode) {
  const isEditing = mode === "edit";
  vehicleSubmitButton.textContent = isEditing ? "Guardar cambios" : "Añadir vehículo";
  cancelEditButton.hidden = !isEditing;
}

function resetVehicleForm() {
  editingVehicleId = null;
  vehicleForm.reset();
  setFormMode("create");
}

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

function deleteVehicle(id) {
  const vehicles = readVehicles();
  const filteredVehicles = vehicles.filter((item) => item.id !== id);

  if (filteredVehicles.length === vehicles.length) {
    throw new Error("Vehículo no encontrado");
  }

  writeVehicles(filteredVehicles);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}

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

function loadVehicles() {
  try {
    const vehicles = readVehicles();
    renderVehicles(vehicles);
  } catch (error) {
    vehicleList.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
  }
}

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

vehiclesToggle.addEventListener("click", () => {
  const isExpanded = vehiclesToggle.getAttribute("aria-expanded") === "true";

  vehiclesToggle.setAttribute("aria-expanded", String(!isExpanded));
  vehicleList.hidden = isExpanded;
});

loadVehicles();