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

function computeRowHash(record) {
  const payload = HASH_FIELDS.map((field) => String(record[field] ?? "")).join("|");
  return crypto.createHash("sha256").update(payload).digest("hex");
}

module.exports = { computeRowHash, HASH_FIELDS };
