const db = require("../database/query");

async function findAll() {
  return db.all(`
    SELECT id, nombre, descripcion, activo, created_at
    FROM roles
    ORDER BY nombre
  `);
}

async function findById(id) {
  return db.get(
    `
      SELECT id, nombre, descripcion, activo, created_at
      FROM roles
      WHERE id = ?
    `,
    [id]
  );
}

async function findPermissions() {
  return db.all(`
    SELECT id, codigo, modulo, descripcion
    FROM permisos
    ORDER BY modulo, codigo
  `);
}

async function findPermissionsByRoleId(roleId) {
  return db.all(
    `
      SELECT p.id, p.codigo, p.modulo, p.descripcion
      FROM permisos p
      INNER JOIN roles_permisos rp ON rp.permiso_id = p.id
      WHERE rp.role_id = ?
      ORDER BY p.modulo, p.codigo
    `,
    [roleId]
  );
}

async function updatePermissions(roleId, permissionIds) {
  await db.run("DELETE FROM roles_permisos WHERE role_id = ?", [roleId]);

  for (const permissionId of permissionIds) {
    await db.run(
      `
        INSERT INTO roles_permisos (role_id, permiso_id)
        VALUES (?, ?)
        ON CONFLICT (role_id, permiso_id) DO NOTHING
      `,
      [roleId, permissionId]
    );
  }

  await db.run("UPDATE roles SET permisos_configurados = TRUE WHERE id = ?", [roleId]);

  return findPermissionsByRoleId(roleId);
}

module.exports = {
  findAll,
  findById,
  findPermissions,
  findPermissionsByRoleId,
  updatePermissions
};
