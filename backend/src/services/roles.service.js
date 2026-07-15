const HttpError = require("../errors/http-error");
const rolesRepository = require("../repositories/roles.repository");

const PERMISO_SUPER_ADMIN = "empresas.switch";

async function listRoles(callerPermisos = []) {
  const roles = await rolesRepository.findAll();

  const rolesConPermisos = await Promise.all(roles.map(async (role) => ({
    ...role,
    activo: Boolean(role.activo),
    permisos: await rolesRepository.findPermissionsByRoleId(role.id)
  })));

  // Un rol que otorga "empresas.switch" (SuperAdministrador) rompe el
  // aislamiento entre empresas -- solo alguien que ya tiene ese permiso
  // puede verlo/asignarlo, para que un Administrador normal de cualquier
  // empresa no pueda promoverse a si mismo desde el panel de Usuarios.
  if (callerPermisos.includes(PERMISO_SUPER_ADMIN)) return rolesConPermisos;
  return rolesConPermisos.filter((role) => !role.permisos.some((permiso) => permiso.codigo === PERMISO_SUPER_ADMIN));
}

async function listPermissions() {
  return rolesRepository.findPermissions();
}

async function updateRolePermissions(roleId, permissionIds, callerPermisos = []) {
  const role = await rolesRepository.findById(roleId);
  if (!role) {
    throw new HttpError(404, "Rol no encontrado");
  }

  const normalizedIds = [...new Set((permissionIds || [])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0))];

  if (!callerPermisos.includes(PERMISO_SUPER_ADMIN)) {
    const todosLosPermisos = await rolesRepository.findPermissions();
    const permisoSuperAdmin = todosLosPermisos.find((permiso) => permiso.codigo === PERMISO_SUPER_ADMIN);
    if (permisoSuperAdmin && normalizedIds.includes(permisoSuperAdmin.id)) {
      throw new HttpError(403, "No tienes permiso para asignar esta capacidad");
    }
  }

  return rolesRepository.updatePermissions(roleId, normalizedIds);
}

module.exports = {
  listRoles,
  listPermissions,
  updateRolePermissions
};
