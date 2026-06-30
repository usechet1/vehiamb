const rolesService = require("../services/roles.service");
const usuariosService = require("../services/usuarios.service");

exports.getUsuarios = async (req, res) => {
  const usuarios = await usuariosService.listUsers();
  res.json(usuarios);
};

exports.createUsuario = async (req, res) => {
  const usuario = await usuariosService.createUser(req.body);
  res.status(201).json(usuario);
};

exports.updateUsuario = async (req, res) => {
  const usuario = await usuariosService.updateUser(req.params.id, req.body);
  res.json(usuario);
};

exports.setUsuarioActivo = async (req, res) => {
  const usuario = await usuariosService.setUserActive(
    req.params.id,
    req.body.activo,
    req.user.id
  );
  res.json(usuario);
};

exports.getRoles = async (req, res) => {
  const roles = await rolesService.listRoles();
  res.json(roles);
};

exports.getPermisos = async (req, res) => {
  const permisos = await rolesService.listPermissions();
  res.json(permisos);
};

exports.updateRolePermissions = async (req, res) => {
  const permisos = await rolesService.updateRolePermissions(
    req.params.roleId,
    req.body.permission_ids || req.body.permissionIds || []
  );
  res.json(permisos);
};
