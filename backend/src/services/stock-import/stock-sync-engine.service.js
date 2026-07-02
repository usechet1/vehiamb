const { computeRowHash } = require("../import/row-hash.util");
const repuestosRepository = require("../../repositories/repuestos.repository");
const repuestosStockRepository = require("../../repositories/repuestos-stock.repository");
const incidenciasRepository = require("../../repositories/incidencias-importacion-stock.repository");
const detalleRepository = require("../../repositories/detalle-importacion-stock.repository");

// El "cambio" de una fila se define por estos campos. codigoInterno queda
// afuera a proposito: es la identidad del registro (mismo criterio que
// numero_factura/fecha_factura en el pipeline de facturas).
const STOCK_HASH_FIELDS = ["nombre", "unidadMedida", "stockFisico", "valorPromedio", "ubicacionOriginal"];

/**
 * Si el mismo codigo_interno aparece mas de una vez en el archivo, se
 * conserva la ultima ocurrencia (se asume la mas reciente en el orden del
 * archivo) y las demas quedan registradas como incidencia, nunca se pierden
 * en silencio. Mismo criterio que deduplicarPorNumeroFactura en facturas.
 */
function deduplicarPorCodigoInterno(candidates) {
  const porCodigo = new Map();

  candidates.forEach((candidate) => {
    if (!porCodigo.has(candidate.codigoInterno)) porCodigo.set(candidate.codigoInterno, []);
    porCodigo.get(candidate.codigoInterno).push(candidate);
  });

  const ganadores = [];
  const incidenciasDuplicados = [];
  const detalleIgnorados = [];

  porCodigo.forEach((ocurrencias) => {
    if (ocurrencias.length === 1) {
      ganadores.push(ocurrencias[0]);
      return;
    }

    const ganador = ocurrencias[ocurrencias.length - 1];
    const descartadas = ocurrencias.slice(0, -1);

    ganadores.push(ganador);

    descartadas.forEach((descartada) => {
      incidenciasDuplicados.push({
        filaExcel: descartada.filaExcel,
        codigoInterno: descartada.codigoInterno,
        tipoIncidencia: "otro",
        descripcion: `Codigo duplicado en el Excel de saldos (fila ${descartada.filaExcel}); se conservo la fila ${ganador.filaExcel} por ser la ultima del archivo.`,
        valorProblematico: descartada.codigoInterno
      });
      detalleIgnorados.push({
        codigoInterno: descartada.codigoInterno,
        accion: "ignorado",
        hashAnterior: null,
        hashNuevo: computeRowHash(descartada, STOCK_HASH_FIELDS)
      });
    });
  });

  return { ganadores, incidenciasDuplicados, detalleIgnorados };
}

async function procesarLote(candidatesLote, importacionId, bodegaId, contexto) {
  const codigos = candidatesLote.map((c) => c.codigoInterno);
  const repuestosExistentes = await repuestosRepository.findByCodigosInternos(codigos);
  const stockExistente = await repuestosStockRepository.findByRepuestoIds(
    [...repuestosExistentes.values()].map((r) => r.id)
  );

  const detalles = [];
  const incidencias = [];
  let nuevos = 0;
  let actualizados = 0;
  let omitidos = 0;
  let errores = 0;

  for (const candidate of candidatesLote) {
    try {
      const hashNuevo = computeRowHash(candidate, STOCK_HASH_FIELDS);
      const existente = repuestosExistentes.get(candidate.codigoInterno);

      if (!existente) {
        const repuestoCreado = await repuestosRepository.create({
          codigo_interno: candidate.codigoInterno,
          nombre: candidate.nombre,
          categoria: "otros",
          marca: null,
          referencia: null,
          unidad_medida: candidate.unidadMedida,
          valor_promedio: candidate.valorPromedio,
          estado: "activo",
          observaciones: null
        });

        await repuestosStockRepository.upsertStock(repuestoCreado.id, bodegaId, {
          stockFisico: candidate.stockFisico,
          ubicacionOriginal: candidate.ubicacionOriginal,
          hashFila: hashNuevo
        });

        if (candidate.stockFisico !== 0) {
          await repuestosStockRepository.insertMovimiento({
            repuestoId: repuestoCreado.id,
            bodegaId,
            tipoMovimiento: "ajuste",
            cantidad: candidate.stockFisico,
            stockResultante: candidate.stockFisico,
            motivo: "Carga inicial desde importacion de stock",
            referenciaTipo: "importacion_stock",
            referenciaId: importacionId,
            usuarioId: null
          });
        }

        detalles.push({
          repuestoId: repuestoCreado.id,
          codigoInterno: candidate.codigoInterno,
          accion: "creado",
          hashAnterior: null,
          hashNuevo
        });
        nuevos += 1;
        continue;
      }

      const stockRow = stockExistente.get(existente.id);
      const hashAnterior = stockRow?.hash_fila ?? null;

      if (hashAnterior !== null && hashAnterior === hashNuevo) {
        detalles.push({
          repuestoId: existente.id,
          codigoInterno: candidate.codigoInterno,
          accion: "omitido",
          hashAnterior,
          hashNuevo
        });
        omitidos += 1;
        continue;
      }

      await repuestosRepository.updateDatosImportados(existente.id, {
        nombre: candidate.nombre,
        unidad_medida: candidate.unidadMedida,
        valor_promedio: candidate.valorPromedio
      });

      await repuestosStockRepository.upsertStock(existente.id, bodegaId, {
        stockFisico: candidate.stockFisico,
        ubicacionOriginal: candidate.ubicacionOriginal,
        hashFila: hashNuevo
      });

      const stockAnterior = Number(stockRow?.stock_fisico ?? 0);
      if (stockAnterior !== candidate.stockFisico) {
        await repuestosStockRepository.insertMovimiento({
          repuestoId: existente.id,
          bodegaId,
          tipoMovimiento: "ajuste",
          cantidad: candidate.stockFisico - stockAnterior,
          stockResultante: candidate.stockFisico,
          motivo: "Actualizacion de saldo por importacion de stock",
          referenciaTipo: "importacion_stock",
          referenciaId: importacionId,
          usuarioId: null
        });
      }

      detalles.push({
        repuestoId: existente.id,
        codigoInterno: candidate.codigoInterno,
        accion: "actualizado",
        hashAnterior,
        hashNuevo
      });
      actualizados += 1;
    } catch (error) {
      errores += 1;
      incidencias.push({
        filaExcel: candidate.filaExcel,
        codigoInterno: candidate.codigoInterno,
        tipoIncidencia: "otro",
        descripcion: `Error inesperado procesando la fila: ${error.message}`,
        valorProblematico: null
      });
      detalles.push({ codigoInterno: candidate.codigoInterno, accion: "error", hashAnterior: null, hashNuevo: null });
      console.error(`[StockSyncEngine] error en repuesto ${candidate.codigoInterno} (fila ${candidate.filaExcel}):`, error);
    }
  }

  contexto.totalNuevos += nuevos;
  contexto.totalActualizados += actualizados;
  contexto.totalOmitidos += omitidos;
  contexto.totalErrores += errores;
  contexto.detalles.push(...detalles);
  contexto.incidencias.push(...incidencias);
}

/**
 * Punto de entrada: recibe los candidatos ya filtrados por StockExcelParser
 * y decide, fila por fila, si crea, actualiza u omite -- nunca borra y
 * recarga todo.
 */
async function sincronizar({ candidates, parseErrors, importacionId }) {
  const bodega = await repuestosStockRepository.findBodegaPrincipal();
  if (!bodega) {
    throw new Error('No existe la bodega "PRINCIPAL". Revisa el seed inicial de la tabla bodegas.');
  }

  const { ganadores, incidenciasDuplicados, detalleIgnorados } = deduplicarPorCodigoInterno(candidates);

  const contexto = {
    totalNuevos: 0,
    totalActualizados: 0,
    totalOmitidos: 0,
    totalErrores: parseErrors.length,
    detalles: [...detalleIgnorados],
    incidencias: [...incidenciasDuplicados]
  };

  parseErrors.forEach((error) => {
    contexto.incidencias.push(error);
    contexto.detalles.push({ codigoInterno: error.codigoInterno || "(vacio)", accion: "error", hashAnterior: null, hashNuevo: null });
  });

  const BATCH_SIZE = 500;
  for (let i = 0; i < ganadores.length; i += BATCH_SIZE) {
    await procesarLote(ganadores.slice(i, i + BATCH_SIZE), importacionId, bodega.id, contexto);
  }

  if (contexto.detalles.length) await detalleRepository.createMany(importacionId, contexto.detalles);
  if (contexto.incidencias.length) await incidenciasRepository.createMany(importacionId, contexto.incidencias);

  const totalLeidos = parseErrors.length + incidenciasDuplicados.length + ganadores.length;

  return {
    totalLeidos,
    totalNuevos: contexto.totalNuevos,
    totalActualizados: contexto.totalActualizados,
    totalOmitidos: contexto.totalOmitidos,
    totalErrores: contexto.totalErrores
  };
}

module.exports = { sincronizar };
