const db = require("../database/query");

const CREATE_FIELDS = ["empresa_id", "usuario_id", "metodo", "ruta", "status_code", "mensaje", "stack", "ip"];

async function registrar(log) {
  const values = CREATE_FIELDS.map((field) => log[field] ?? null);
  const placeholders = CREATE_FIELDS.map(() => "?").join(", ");

  return db.run(`INSERT INTO logs_errores (${CREATE_FIELDS.join(", ")}) VALUES (${placeholders})`, values);
}

async function findAll({ page = 1, limit = 20, status_code: statusCode, desde, hasta, search } = {}, empresaId) {
  const conditions = ["l.empresa_id = ?"];
  const values = [empresaId];

  if (statusCode) {
    conditions.push("l.status_code = ?");
    values.push(statusCode);
  }

  if (desde) {
    conditions.push("l.creado_en >= ?");
    values.push(desde);
  }

  if (hasta) {
    conditions.push("l.creado_en < (?::date + INTERVAL '1 day')");
    values.push(hasta);
  }

  if (search) {
    conditions.push("(l.ruta ILIKE ? OR l.mensaje ILIKE ?)");
    values.push(`%${search}%`, `%${search}%`);
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;
  const offset = (Math.max(1, page) - 1) * limit;
  const joinClause = "FROM logs_errores l LEFT JOIN usuarios u ON u.id = l.usuario_id";

  const rowsPromise = db.all(
    `
      SELECT l.*, u.nombre AS usuario_nombre
      ${joinClause}
      ${whereClause}
      ORDER BY l.creado_en DESC, l.id DESC
      LIMIT ? OFFSET ?
    `,
    [...values, limit, offset]
  );

  const totalPromise = db.get(`SELECT COUNT(*) AS total ${joinClause} ${whereClause}`, values);

  const [rows, totalRow] = await Promise.all([rowsPromise, totalPromise]);

  return {
    items: rows,
    page,
    limit,
    total: Number(totalRow?.total || 0),
    totalPages: Math.max(1, Math.ceil(Number(totalRow?.total || 0) / limit))
  };
}

async function contarErroresPorDia(desde, hasta, empresaId) {
  return db.all(
    `
      SELECT DATE(creado_en) AS fecha, COUNT(*) AS total
      FROM logs_errores
      WHERE empresa_id = ? AND creado_en >= ? AND creado_en < (?::date + INTERVAL '1 day')
      GROUP BY DATE(creado_en)
      ORDER BY fecha ASC
    `,
    [empresaId, desde, hasta]
  );
}

module.exports = { registrar, findAll, contarErroresPorDia };
