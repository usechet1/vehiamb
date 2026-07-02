const express = require("express");
const router = express.Router();

const repuestosController = require("../controllers/repuestos.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");

// GET listado paginado con busqueda/filtros
router.get("/", requirePermission("inventory.view"), asyncHandler(repuestosController.getRepuestos));

// GET buscador predictivo (autocomplete del formulario de mantenimiento)
router.get("/buscar", requirePermission("inventory.view"), asyncHandler(repuestosController.buscarRepuestos));

// GET repuesto por id
router.get("/:id", requirePermission("inventory.view"), asyncHandler(repuestosController.getRepuestoById));

// POST crear repuesto
router.post("/", requirePermission("inventory.manage"), asyncHandler(repuestosController.createRepuesto));

// PUT editar repuesto
router.put("/:id", requirePermission("inventory.manage"), asyncHandler(repuestosController.updateRepuesto));

// GET disponibilidad (principal + equivalencias con stock) -- usado por el formulario de mantenimiento
router.get("/:id/disponibilidad", requirePermission("inventory.view"), asyncHandler(repuestosController.getDisponibilidad));

// GET/POST/DELETE equivalencias
router.get("/:id/equivalencias", requirePermission("inventory.view"), asyncHandler(repuestosController.getEquivalencias));
router.post("/:id/equivalencias", requirePermission("inventory.manage"), asyncHandler(repuestosController.createEquivalencia));
router.delete(
  "/:id/equivalencias/:equivalenciaId",
  requirePermission("inventory.manage"),
  asyncHandler(repuestosController.deleteEquivalencia)
);

module.exports = router;
