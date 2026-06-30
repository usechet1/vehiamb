const HttpError = require("../errors/http-error");
const rolesRepository = require("../repositories/roles.repository");

async function listRoles() {
  const roles = await rolesRepository.findAll();

  return Promise.all(roles.map(async (role) => ({
    ...role,
    activo: Boolean(role.activo),
    permisos: await rolesRepository.findPermissionsByRoleId(role.id)
  })));
}

async function listPermissions() {
  return rolesRepository.findPermissions();
}

async function updateRolePermissions(roleId, permissionIds) {
  const role = await rolesRepository.findById(roleId);
  if (!role) {
    throw new HttpError(404, "Rol no encontrado");
  }

  const normalizedIds = [...new Set((permissionIds || [])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0))];

  return rolesRepository.updatePermissions(roleId, normalizedIds);
}

module.exports = {
  listRoles,
  listPermissions,
  updateRolePermissions
};
