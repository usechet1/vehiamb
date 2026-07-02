const crypto = require("crypto");

// Campos que definen si una fila "cambio". numero_factura y fecha_factura
// quedan afuera a proposito: son la identidad del registro, nunca cambian
// una vez creado (si cambiaran, series otro registro, no una actualizacion).
const HASH_FIELDS = [
  "valorFactura",
  "sala",
  "pesoKg",
  "combustiblePesos",
  "combustibleGalones",
  "almuerzos",
  "peajes",
  "parqueaderos",
  "vehiculoRaw",
  "conductorNombre",
  "fechaEnvio",
  "observaciones"
];

// "fields" es opcional para no romper a los llamadores existentes (facturas
// vehiculares): si no se pasa, usa HASH_FIELDS. Otros pipelines de
// importacion (ej. stock de repuestos) pasan su propia lista de campos para
// reusar esta misma utilidad de hashing sin duplicar la logica SHA-256.
function computeRowHash(record, fields = HASH_FIELDS) {
  const payload = fields.map((field) => String(record[field] ?? "")).join("|");
  return crypto.createHash("sha256").update(payload).digest("hex");
}

module.exports = { computeRowHash, HASH_FIELDS };
