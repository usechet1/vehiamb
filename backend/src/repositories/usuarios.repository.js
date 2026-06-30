const db = require("../database/query");

const USER_SELECT = `
  SELECT
    u.id,
    u.nombre,
    u.email,
    u.password_hash,
    u.rol,
    u.role_id,
    u.activo,
    u.created_at,
    r.nombre AS role_nombre
  FROM usuarios u
  LEFT JOIN roles r ON r.id = u.role_id
`;

async function findByEmail(email) {
  return db.get(`${USER_SELECT} WHERE LOWER(u.email) = ?`, [email.toLowerCase()]);
}

async function findById(id) {
  return db.get(`${USER_SELECT} WHERE u.id = ?`, [id]);
}

async function findAll() {
  return db.all(`
    ${USER_SELECT}
    ORDER BY u.created_at DESC, u.id DESC
  `);
}

async function create(user) {
  const result = await db.get(
    `
      INSERT INTO usuarios (nombre, email, password_hash, rol, role_id, activo)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING id
    `,
    [
      user.nombre,
      user.email,
      user.password_hash,
      user.rol,
      user.role_id,
      user.activo
    ]
  );

  return findById(result.id);
}

async function update(id, user) {
  const assignments = [
    "nombre = ?",
    "email = ?",
    "rol = ?",
    "role_id = ?",
    "activo = ?"
  ];
  const values = [
    user.nombre,
    user.email,
    user.rol,
    user.role_id,
    user.activo
  ];

  if (user.password_hash) {
    assignments.push("password_hash = ?");
    values.push(user.password_hash);
  }

  values.push(id);

  await db.run(
    `
      UPDATE usuarios
      SET ${assignments.join(", ")}
      WHERE id = ?
    `,
    values
  );

  return findById(id);
}

async function setActive(id, active) {
  await db.run("UPDATE usuarios SET activo = ? WHERE id = ?", [active, id]);
  return findById(id);
}

async function findPermissionsByUserId(userId) {
  const permissions = await db.all(
    `
      SELECT DISTINCT p.codigo
      FROM usuarios u
      INNER JOIN roles r ON r.id = u.role_id
      INNER JOIN roles_permisos rp ON rp.role_id = r.id
      INNER JOIN permisos p ON p.id = rp.permiso_id
      WHERE u.id = ?
        AND u.activo = TRUE
        AND r.activo = TRUE
      ORDER BY p.codigo
    `,
    [userId]
  );

  return permissions.map((permission) => permission.codigo);
}

module.exports = {
  findByEmail,
  findById,
  findAll,
  create,
  update,
  setActive,
  findPermissionsByUserId
};
