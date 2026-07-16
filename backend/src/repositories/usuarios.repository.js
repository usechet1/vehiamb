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
    u.empresa_id,
    u.created_at,
    r.nombre AS role_nombre,
    e.nombre AS empresa_nombre,
    e.logo_url AS empresa_logo_url,
    e.modulos_deshabilitados AS empresa_modulos_deshabilitados
  FROM usuarios u
  LEFT JOIN roles r ON r.id = u.role_id
  LEFT JOIN empresas e ON e.id = u.empresa_id
`;

// findByEmail NO se filtra por empresa: el email es unico en toda la
// plataforma (una cuenta = una empresa), y el login todavia no sabe a que
// empresa pertenece el usuario hasta despues de encontrarlo por email.
async function findByEmail(email) {
  return db.get(`${USER_SELECT} WHERE LOWER(u.email) = ?`, [email.toLowerCase()]);
}

// findById SI se filtra por empresa cuando se llama para gestion admin
// (ver/editar/desactivar OTRO usuario). Cuando empresaId es null se usa para
// resolver el usuario autenticado a partir del token (getCurrentUser), donde
// todavia no hace falta filtrar porque es siempre "a mi mismo".
async function findById(id, empresaId = null) {
  if (empresaId === null) {
    return db.get(`${USER_SELECT} WHERE u.id = ?`, [id]);
  }
  return db.get(`${USER_SELECT} WHERE u.id = ? AND u.empresa_id = ?`, [id, empresaId]);
}

// Usado para exigir que los usuarios nuevos de una empresa compartan el
// mismo dominio de correo (ver usuarios.service.js: createUser). Se toma del
// usuario mas antiguo de la empresa (normalmente el admin creado por
// create-empresa.js) en vez del correo de quien esta creando el usuario, para
// que tambien funcione bien cuando quien crea es un SuperAdministrador
// operando sobre otra empresa (su propio correo no tiene por que compartir
// dominio con esa empresa).
async function findPrimerEmailPorEmpresa(empresaId) {
  const row = await db.get(
    "SELECT email FROM usuarios WHERE empresa_id = ? ORDER BY created_at ASC, id ASC LIMIT 1",
    [empresaId]
  );
  return row?.email || null;
}

async function findAll(empresaId) {
  return db.all(
    `
    ${USER_SELECT}
    WHERE u.empresa_id = ?
    ORDER BY u.created_at DESC, u.id DESC
  `,
    [empresaId]
  );
}

async function create(user) {
  const result = await db.get(
    `
      INSERT INTO usuarios (nombre, email, password_hash, rol, role_id, activo, empresa_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `,
    [
      user.nombre,
      user.email,
      user.password_hash,
      user.rol,
      user.role_id,
      user.activo,
      user.empresa_id
    ]
  );

  return findById(result.id);
}

async function update(id, user, empresaId) {
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

  values.push(id, empresaId);

  await db.run(
    `
      UPDATE usuarios
      SET ${assignments.join(", ")}
      WHERE id = ? AND empresa_id = ?
    `,
    values
  );

  return findById(id, empresaId);
}

async function setActive(id, active, empresaId) {
  await db.run("UPDATE usuarios SET activo = ? WHERE id = ? AND empresa_id = ?", [active, id, empresaId]);
  return findById(id, empresaId);
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

async function findByPermission(permissionCode, empresaId) {
  return db.all(
    `
      SELECT DISTINCT u.id, u.nombre, u.email
      FROM usuarios u
      INNER JOIN roles r ON r.id = u.role_id
      INNER JOIN roles_permisos rp ON rp.role_id = r.id
      INNER JOIN permisos p ON p.id = rp.permiso_id
      WHERE p.codigo = ?
        AND u.activo = TRUE
        AND r.activo = TRUE
        AND u.empresa_id = ?
    `,
    [permissionCode, empresaId]
  );
}

async function findByRoles(roleNames, empresaId) {
  return db.all(
    `
      SELECT DISTINCT u.id, u.nombre, u.email
      FROM usuarios u
      INNER JOIN roles r ON r.id = u.role_id
      WHERE r.nombre = ANY(?)
        AND u.activo = TRUE
        AND r.activo = TRUE
        AND u.empresa_id = ?
    `,
    [roleNames, empresaId]
  );
}

module.exports = {
  findByEmail,
  findById,
  findAll,
  findPrimerEmailPorEmpresa,
  create,
  update,
  setActive,
  findPermissionsByUserId,
  findByPermission,
  findByRoles
};
