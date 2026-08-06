const db = require("../database/query");

const CREATE_FIELDS = ["usuario_afectado_id", "actor_usuario_id", "empresa_id", "evento", "detalle"];

async function registrar(log) {
  const values = CREATE_FIELDS.map((field) =>
    field === "detalle" ? (log.detalle ? JSON.stringify(log.detalle) : null) : log[field] ?? null
  );
  const placeholders = CREATE_FIELDS.map(() => "?").join(", ");

  return db.run(`INSERT INTO logs_registro (${CREATE_FIELDS.join(", ")}) VALUES (${placeholders})`, values);
}

async function findAll({ page = 1, limit = 20, evento, desde, hasta, search } = {}, empresaId) {
  const conditions = ["l.empresa_id = ?"];
  const values = [empresaId];

  if (evento) {
    conditions.push("l.evento = ?");
    values.push(evento);
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
    conditions.push("(afectado.nombre ILIKE ? OR actor.nombre ILIKE ?)");
    values.push(`%${search}%`, `%${search}%`);
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;
  const offset = (Math.max(1, page) - 1) * limit;
  const joinClause = `
    FROM logs_registro l
    LEFT JOIN usuarios afectado ON afectado.id = l.usuario_afectado_id
    LEFT JOIN usuarios actor ON actor.id = l.actor_usuario_id
  `;

  const rowsPromise = db.all(
    `
      SELECT l.*, afectado.nombre AS usuario_afectado_nombre, actor.nombre AS actor_nombre
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

module.exports = { registrar, findAll };
