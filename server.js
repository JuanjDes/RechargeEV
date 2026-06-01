const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, "data", "vehiculos.json");
const DATA_DIR = path.dirname(DATA_FILE);

app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

// Leer datos
async function readVehicles() {
  try {
    const data = await fs.readFile(DATA_FILE, "utf8");
    const trimmedData = data.trim();

    if (!trimmedData) return [];

    const vehicles = JSON.parse(trimmedData);
    return Array.isArray(vehicles) ? vehicles : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

// Guardar datos
async function writeVehicles(vehicles) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(vehicles, null, 2), "utf8");
}

// Validar texto
function cleanText(value, maxLength = 300) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

// GET todos los vehículos
app.get("/api/vehiculos", async (req, res) => {
  try {
    const vehicles = await readVehicles();
    res.json(vehicles);
  } catch {
    res.status(500).json({ error: "Error al leer los vehículos" });
  }
});

// POST crear vehículo
app.post("/api/vehiculos", async (req, res) => {
  try {
    const matricula = cleanText(req.body.matricula, 20).toUpperCase();
    const mapsUrl = cleanText(req.body.mapsUrl, 500);
    const notas = cleanText(req.body.notas, 500);

    if (!matricula || !mapsUrl) {
      return res.status(400).json({
        error: "Matrícula y enlace de Google Maps son obligatorios",
      });
    }

    if (!mapsUrl.startsWith("https://")) {
      return res.status(400).json({
        error: "El enlace debe empezar por https://",
      });
    }

    const vehicles = await readVehicles();

    const newVehicle = {
      id: crypto.randomUUID(),
      matricula,
      mapsUrl,
      estado: "pendiente",
      notas,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vehicles.push(newVehicle);
    await writeVehicles(vehicles);

    res.status(201).json(newVehicle);
  } catch {
    res.status(500).json({ error: "Error al crear el vehículo" });
  }
});

// PATCH actualizar vehículo
app.patch("/api/vehiculos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const vehicles = await readVehicles();

    const vehicle = vehicles.find((item) => item.id === id);

    if (!vehicle) {
      return res.status(404).json({ error: "Vehículo no encontrado" });
    }

    const allowedStates = ["pendiente", "cargando", "cargado", "incidencia"];

    if (req.body.estado !== undefined) {
      if (!allowedStates.includes(req.body.estado)) {
        return res.status(400).json({ error: "Estado no válido" });
      }
      vehicle.estado = req.body.estado;
    }

    if (req.body.notas !== undefined) {
      vehicle.notas = cleanText(req.body.notas, 500);
    }

    if (req.body.matricula !== undefined) {
      vehicle.matricula = cleanText(req.body.matricula, 20).toUpperCase();
    }

    if (req.body.mapsUrl !== undefined) {
      const mapsUrl = cleanText(req.body.mapsUrl, 500);

      if (!mapsUrl.startsWith("https://")) {
        return res.status(400).json({
          error: "El enlace debe empezar por https://",
        });
      }

      vehicle.mapsUrl = mapsUrl;
    }

    vehicle.updatedAt = new Date().toISOString();

    await writeVehicles(vehicles);

    res.json(vehicle);
  } catch {
    res.status(500).json({ error: "Error al actualizar el vehículo" });
  }
});

// DELETE borrar vehículo
app.delete("/api/vehiculos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const vehicles = await readVehicles();

    const filteredVehicles = vehicles.filter((item) => item.id !== id);

    if (filteredVehicles.length === vehicles.length) {
      return res.status(404).json({ error: "Vehículo no encontrado" });
    }

    await writeVehicles(filteredVehicles);

    res.json({ message: "Vehículo borrado correctamente" });
  } catch {
    res.status(500).json({ error: "Error al borrar el vehículo" });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor funcionando en http://localhost:${PORT}`);
});