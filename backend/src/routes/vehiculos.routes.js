const express = require("express");
const router = express.Router();

const vehiculosController = require("../controllers/vehiculos.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");
const uploadVehiculo = require("../middlewares/upload-vehiculo");
const compressImage = require("../middlewares/compress-image");

// GET todos los vehículos (con busqueda, filtros, orden y paginacion)
router.get("/", requirePermission("vehicles.view"), asyncHandler(vehiculosController.getVehiculos));

// GET catalogo de marcas registradas (para el filtro dinamico)
router.get("/catalogos/marcas", requirePermission("vehicles.view"), asyncHandler(vehiculosController.getMarcas));

// GET listado completo sin paginar (usado por selectores de otros modulos)
router.get("/catalogos/lista", requirePermission("vehicles.view"), asyncHandler(vehiculosController.getVehiculosCatalogo));

// GET vehículo por id
router.get("/:id", requirePermission("vehicles.view"), asyncHandler(vehiculosController.getVehiculoById));

// POST crear vehículo
router.post(
  "/",
  requirePermission("vehicles.create"),
  uploadVehiculo.single("imagen"),
  asyncHandler(compressImage),
  asyncHandler(vehiculosController.createVehiculo)
);

// PUT editar vehículo
router.put(
  "/:id",
  requirePermission("vehicles.edit"),
  uploadVehiculo.single("imagen"),
  asyncHandler(compressImage),
  asyncHandler(vehiculosController.updateVehiculo)
);

// PATCH cambio rapido de estado del vehículo
router.patch("/:id/estado", requirePermission("vehicles.edit"), asyncHandler(vehiculosController.updateEstadoVehiculo));

// DELETE vehículo por id
router.delete("/:id", requirePermission("vehicles.delete"), asyncHandler(vehiculosController.deleteVehiculo));

// GET/PUT repuestos sugeridos por vehiculo + tipo de mantenimiento
router.get("/:id/repuestos-sugeridos", requirePermission("vehicles.view"), asyncHandler(vehiculosController.getRepuestosSugeridos));
router.put(
  "/:id/repuestos-sugeridos",
  requirePermission("vehicles.edit"),
  asyncHandler(vehiculosController.updateRepuestosSugeridos)
);

module.exports = router;
