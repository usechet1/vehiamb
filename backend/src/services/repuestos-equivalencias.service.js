const HttpError = require("../errors/http-error");
const repuestosRepository = require("../repositories/repuestos.repository");
const equivalenciasRepository = require("../repositories/repuestos-equivalencias.repository");

async function listarEquivalencias(repuestoId, empresaId) {
  await getRepuestoOFallar(repuestoId, empresaId);
  return equivalenciasRepository.findByRepuestoPrincipal(repuestoId, empresaId);
}

async function getRepuestoOFallar(id, empresaId) {
  const repuesto = await repuestosRepository.findById(id, empresaId);
  if (!repuesto) throw new HttpError(404, "Repuesto no encontrado");
  return repuesto;
}

async function crearEquivalencia(repuestoPrincipalId, payload, empresaId) {
  const equivalenteId = Number(payload.repuesto_equivalente_id);
  if (!equivalenteId) {
    throw new HttpError(400, "repuesto_equivalente_id es obligatorio");
  }

  if (equivalenteId === Number(repuestoPrincipalId)) {
    throw new HttpError(400, "Un repuesto no puede ser equivalente de si mismo");
  }

  const [principal, equivalente] = await Promise.all([
    getRepuestoOFallar(repuestoPrincipalId, empresaId),
    getRepuestoOFallar(equivalenteId, empresaId)
  ]);

  if (principal.categoria !== equivalente.categoria) {
    throw new HttpError(
      400,
      `Las equivalencias solo pueden ser de la misma categoria (${principal.categoria} != ${equivalente.categoria})`
    );
  }

  const prioridad = payload.prioridad
    ? Number(payload.prioridad)
    : (await equivalenciasRepository.findMaxPrioridad(repuestoPrincipalId, empresaId)) + 1;

  try {
    return await equivalenciasRepository.create({
      repuesto_principal_id: Number(repuestoPrincipalId),
      repuesto_equivalente_id: equivalenteId,
      prioridad,
      empresa_id: empresaId
    });
  } catch (error) {
    if (error.code === "23505") {
      throw new HttpError(409, "Esa equivalencia ya esta registrada");
    }
    throw error;
  }
}

async function eliminarEquivalencia(repuestoPrincipalId, equivalenciaId, empresaId) {
  const equivalencia = await equivalenciasRepository.findById(equivalenciaId, empresaId);

  if (!equivalencia || Number(equivalencia.repuesto_principal_id) !== Number(repuestoPrincipalId)) {
    throw new HttpError(404, "Equivalencia no encontrada");
  }

  await equivalenciasRepository.remove(equivalenciaId, empresaId);
}

/**
 * Disponibilidad de un repuesto para usar en un mantenimiento: si el
 * principal tiene stock, se usa; si no, se listan las equivalencias con
 * stock disponible, ordenadas por prioridad (seccion "Uso durante el
 * mantenimiento" del pedido original).
 */
async function consultarDisponibilidad(repuestoId, empresaId) {
  const principal = await getRepuestoOFallar(repuestoId, empresaId);
  const equivalencias = await equivalenciasRepository.findByRepuestoPrincipal(repuestoId, empresaId);

  return {
    principal: {
      id: principal.id,
      codigo_interno: principal.codigo_interno,
      nombre: principal.nombre,
      stock_disponible: Number(principal.stock_disponible ?? 0)
    },
    equivalencias: equivalencias
      .map((eq) => ({
        id: eq.repuesto_equivalente_id,
        codigo_interno: eq.codigo_interno,
        nombre: eq.nombre,
        prioridad: eq.prioridad,
        stock_disponible: Number(eq.stock_disponible ?? 0)
      }))
      .filter((eq) => eq.stock_disponible > 0)
  };
}

module.exports = { listarEquivalencias, crearEquivalencia, eliminarEquivalencia, consultarDisponibilidad };
