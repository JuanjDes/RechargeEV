const vehicleForm = document.getElementById("vehicleForm");
const vehicleList = document.getElementById("vehicleList");

async function getVehicles() {
  const response = await fetch("/api/vehiculos");

  if (!response.ok) {
    throw new Error("No se pudieron cargar los vehículos");
  }

  return response.json();
}

async function createVehicle(vehicle) {
  const response = await fetch("/api/vehiculos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(vehicle),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Error al crear vehículo");
  }

  return response.json();
}

async function updateVehicle(id, data) {
  const response = await fetch(`/api/vehiculos/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Error al actualizar vehículo");
  }

  return response.json();
}

async function deleteVehicle(id) {
  const response = await fetch(`/api/vehiculos/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Error al borrar vehículo");
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}

function renderVehicles(vehicles) {
  vehicleList.innerHTML = "";

  if (vehicles.length === 0) {
    vehicleList.innerHTML = `<p class="empty">No hay vehículos todavía.</p>`;
    return;
  }

  vehicles.forEach((vehicle) => {
    const card = document.createElement("article");
    card.className = "vehicle-card";

    card.innerHTML = `
      <h3>${escapeHtml(vehicle.matricula)}</h3>
      <span class="estado ${escapeHtml(vehicle.estado)}">${escapeHtml(vehicle.estado)}</span>
      <p>${escapeHtml(vehicle.notas || "Sin notas")}</p>

      <div class="actions">
        <a href="${escapeHtml(vehicle.mapsUrl)}" target="_blank" rel="noopener noreferrer">
          Abrir Maps
        </a>

        <button data-id="${vehicle.id}" data-estado="cargando">Cargando</button>
        <button data-id="${vehicle.id}" data-estado="cargado">Cargado</button>
        <button data-id="${vehicle.id}" data-estado="incidencia">Incidencia</button>
        <button class="delete" data-id="${vehicle.id}" data-delete="true">Borrar</button>
      </div>
    `;

    vehicleList.appendChild(card);
  });
}

async function loadVehicles() {
  try {
    const vehicles = await getVehicles();
    renderVehicles(vehicles);
  } catch (error) {
    vehicleList.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
  }
}

vehicleForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const matricula = document.getElementById("matricula").value.trim();
  const mapsUrl = document.getElementById("mapsUrl").value.trim();
  const notas = document.getElementById("notas").value.trim();

  try {
    await createVehicle({ matricula, mapsUrl, notas });
    vehicleForm.reset();
    await loadVehicles();
  } catch (error) {
    alert(error.message);
  }
});

vehicleList.addEventListener("click", async (event) => {
  const button = event.target.closest("button");

  if (!button) return;

  const id = button.dataset.id;

  try {
    if (button.dataset.delete === "true") {
      const confirmDelete = confirm("¿Borrar este vehículo?");
      if (!confirmDelete) return;

      await deleteVehicle(id);
    } else {
      await updateVehicle(id, {
        estado: button.dataset.estado,
      });
    }

    await loadVehicles();
  } catch (error) {
    alert(error.message);
  }
});

loadVehicles();