const fs = require("fs/promises");
const path = require("path");
const HttpError = require("../errors/http-error");
const rolesRepository = require("../repositories/roles.repository");
const usuariosRepository = require("../repositories/usuarios.repository");
const conductoresRepository = require("../repositories/conductores.repository");
const logsRegistroRepository = require("../repositories/logs-registro.repository");
const { hashPassword } = require("../utils/password");
const notificacionesService = require("./notificaciones.service");
const db = require("../database/query");

// Fire-and-forget, mismo criterio que las notificaciones de este archivo: un
// fallo al guardar el log de registro nunca debe romper la operacion real.
function registrarEventoUsuario(data) {
  logsRegistroRepository
    .registrar(data)
    .catch((error) => console.error("No fue posible registrar el log de registro:", error.message));
}

const PERMISO_SUPER_ADMIN = "empresas.switch";
const UPLOADS_ROOT = path.resolve(__dirname, "..", "..", "uploads");

// Un usuario con rol Conductor necesita ademas una ficha en "conductores"
// (ver sincronizarFichaConductor mas abajo) -- antes solo se creaba al dar
// de alta desde conductores.html; crear el usuario desde este panel con ese
// mismo rol dejaba la cuenta sin ficha (bug reportado: no aparecia en
// Conductores ni podia usar lo que depende de esa ficha -- licencias,
// inspecciones, resumen del viaje).
const ROL_CONDUCTOR = "Conductor";
const CEDULA_REGEX = /^\d{6,10}$/;
const TELEFONO_REGEX = /^\d{7,10}$/;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

// El checkbox "activo" llega como boolean real en JSON pero como string
// ("true"/"false") cuando el formulario se envia como multipart (necesario
// para poder adjuntar la foto). Boolean("false") seria true por error, asi
// que se compara explicitamente contra el string.
function parseActivo(value) {
  if (value === undefined) return true;
  if (typeof value === "string") return value === "true";
  return Boolean(value);
}

async function eliminarFotoAnterior(fotoUrl) {
  if (!fotoUrl) return;
  try {
    await fs.unlink(path.join(UPLOADS_ROOT, fotoUrl.replace(/^\/uploads[\\/]/, "")));
  } catch (error) {
    // El archivo ya pudo haber sido borrado o movido; no bloquea la actualizacion.
  }
}

function toSafeUser(user) {
  return {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    rol: user.role_nombre || user.rol,
    role_id: user.role_id,
    activo: Boolean(user.activo),
    foto_url: user.foto_url || null,
    foto_posicion: user.foto_posicion || "50% 50%",
    celular: user.celular || null,
    cedula: user.conductor_cedula || null,
    empresa_id: user.empresa_id,
    created_at: user.created_at,
    debe_cambiar_password: Boolean(user.debe_cambiar_password)
  };
}

// Solo digitos (permite que lo escriban con espacios/guiones/+); vacio queda
// como null. Sin validar longitud/pais especifico: el formato E.164 exacto
// que exige la API de WhatsApp se normaliza en notificaciones-whatsapp.channel.js
// al momento de enviar, no aqui.
function normalizeCelular(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits || null;
}

// "foto_posicion" se guarda tal cual como valor de object-position (ej.
// "37% 82%") y se manda de vuelta al frontend para pintarlo como estilo
// inline (ver renderUsers en admin-users.js) -- se valida el formato
// estricto aca, nunca se confia en lo que mande el cliente para algo que
// termina en un atributo style.
const FOTO_POSICION_REGEX = /^(\d{1,3}(?:\.\d+)?)% (\d{1,3}(?:\.\d+)?)%$/;

function normalizeFotoPosicion(value) {
  const match = FOTO_POSICION_REGEX.exec(String(value || "").trim());
  if (!match) return "50% 50%";

  const x = Math.min(100, Math.max(0, Number(match[1])));
  const y = Math.min(100, Math.max(0, Number(match[2])));
  return `${x}% ${y}%`;
}

// Un rol inactivo ya no se puede asignar de cero, pero un usuario que ya lo
// tenia asignado (el rol se desactivo despues) debe poder seguir editandose
// -- ej. cambiarle el nombre o reactivarlo -- sin verse forzado a cambiar de
// rol solo para guardar. allowInactiveId permite esa excepcion puntual.
async function resolveRole(roleId, { allowInactiveId = null, callerPermisos = [] } = {}) {
  const role = await rolesRepository.findById(roleId);
  const esElMismoRolActual = allowInactiveId !== null && String(role?.id) === String(allowInactiveId);

  if (!role || (!role.activo && !esElMismoRolActual)) {
    throw new HttpError(400, "Rol inválido");
  }

  // Un rol que otorga "empresas.switch" rompe el aislamiento entre empresas
  // -- solo alguien que ya tiene ese permiso puede asignarlo a otro usuario
  // (o a si mismo editandose), para que un Administrador normal no pueda
  // promoverse a SuperAdministrador desde el panel de Usuarios.
  if (!callerPermisos.includes(PERMISO_SUPER_ADMIN)) {
    const permisosDelRol = await rolesRepository.findPermissionsByRoleId(role.id);
    if (permisosDelRol.some((permiso) => permiso.codigo === PERMISO_SUPER_ADMIN)) {
      throw new HttpError(403, "No tienes permiso para asignar este rol");
    }
  }

  return role;
}

async function validateUserPayload(payload, { isUpdate = false, existingRoleId = null, callerPermisos = [] } = {}) {
  const nombre = String(payload.nombre || "").trim();
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || "");
  const roleId = Number(payload.role_id || payload.roleId || 0);

  if (!nombre || !email || !roleId) {
    throw new HttpError(400, "Nombre, correo y rol son obligatorios");
  }

  if (nombre.length < 4) {
    throw new HttpError(400, "El nombre debe tener al menos 4 caracteres");
  }

  const emailLocalPart = email.split("@")[0];
  if (emailLocalPart.length < 4) {
    throw new HttpError(400, "El usuario debe tener al menos 4 caracteres");
  }

  if (!isUpdate && password.length < 6) {
    throw new HttpError(400, "La contraseña debe tener al menos 6 caracteres");
  }

  if (isUpdate && password && password.length < 6) {
    throw new HttpError(400, "La contraseña debe tener al menos 6 caracteres");
  }

  const role = await resolveRole(roleId, { allowInactiveId: isUpdate ? existingRoleId : null, callerPermisos });
  const celular = normalizeCelular(payload.celular);
  const cedula = String(payload.cedula || "").trim();

  // El resto del formulario (nombre/email/password) es igual para cualquier
  // rol, pero un Conductor necesita cedula y celular validos porque de ahi
  // sale su ficha en "conductores" (ver sincronizarFichaConductor) -- sin
  // esto no hay forma de crear esa ficha.
  if (role.nombre === ROL_CONDUCTOR) {
    if (!CEDULA_REGEX.test(cedula)) {
      throw new HttpError(400, "La cédula es obligatoria y debe tener solo números (6 a 10 dígitos) para el rol Conductor");
    }
    if (!celular || !TELEFONO_REGEX.test(celular)) {
      throw new HttpError(400, "El celular es obligatorio y debe tener solo números (7 a 10 dígitos) para el rol Conductor");
    }
  }

  return {
    nombre,
    email,
    password,
    role_id: role.id,
    rol: role.nombre,
    activo: parseActivo(payload.activo),
    celular,
    cedula: role.nombre === ROL_CONDUCTOR ? cedula : null
  };
}

async function verificarCedulaDisponible(cedula, empresaId, excluirConductorId = null) {
  const conflicto = await conductoresRepository.findByCedula(cedula, empresaId);
  if (conflicto && String(conflicto.id) !== String(excluirConductorId)) {
    throw new HttpError(409, `Ya existe un conductor registrado con la cédula ${cedula}`);
  }
}

// nombre llega combinado ("Juan Carlos Perez"), pero conductores.nombres/
// apellidos son campos separados (ver [[feedback_nombres_apellidos_separados]]).
// Mismo criterio "mejor esfuerzo" que uso la migracion original de esa
// separacion: primera palabra = nombres, resto = apellidos.
function splitNombre(nombreCompleto) {
  const palabras = String(nombreCompleto || "").trim().toUpperCase().split(/\s+/).filter(Boolean);
  return {
    nombres: palabras[0] || "SIN NOMBRE",
    apellidos: palabras.slice(1).join(" ")
  };
}

// Crea o actualiza la ficha en "conductores" vinculada a este usuario, para
// que un usuario con rol Conductor creado/editado desde este panel aparezca
// en Conductores igual que uno creado desde alla. Se preserva
// excluir_de_costos de la ficha existente porque ese campo solo se edita
// desde Conductores, no desde aca.
async function sincronizarFichaConductor(usuario, cedula, empresaId, conductorExistente = null) {
  const existente = conductorExistente ?? (await conductoresRepository.findByUsuarioId(usuario.id, empresaId));
  const { nombres, apellidos } = splitNombre(usuario.nombre);

  const datos = {
    nombres,
    apellidos,
    cedula,
    telefono: usuario.celular,
    email: usuario.email,
    estado: usuario.activo ? "activo" : "inactivo",
    excluir_de_costos: existente?.excluir_de_costos || false,
    empresa_id: empresaId,
    usuario_id: usuario.id
  };

  if (existente) {
    await conductoresRepository.update(existente.id, datos, empresaId);
  } else {
    await conductoresRepository.create(datos);
  }
}

async function listUsers(empresaId) {
  const users = await usuariosRepository.findAll(empresaId);
  return users.map(toSafeUser);
}

// Version minima para selectores (ej. "Inspeccionado por" en Seguridad y
// Salud): solo id + nombre de usuarios activos, sin email/rol/celular. A
// diferencia de listUsers, la usa cualquier usuario autenticado -- no exige
// users.manage (ver GET /usuarios/catalogo, montada antes del
// requirePermission("users.manage") global en usuarios.routes.js), porque
// cualquier rol que pueda crear un registro con "quien lo hizo" necesita
// poder listar personas, no solo un Administrador.
async function listUsersCatalogo(empresaId) {
  const users = await usuariosRepository.findAll(empresaId);
  return users.filter((user) => user.activo).map((user) => ({ id: user.id, nombre: user.nombre }));
}

// El email es unico en TODA la plataforma (decision de producto: una cuenta
// = una empresa, el login no pide elegir empresa), asi que la verificacion
// de unicidad de email es deliberadamente global, sin filtrar por empresaId.
async function createUser(payload, file, empresaId, callerPermisos = [], actorUserId = null) {
  const user = await validateUserPayload(payload, { callerPermisos });
  const existing = await usuariosRepository.findByEmail(user.email);

  if (existing) {
    throw new HttpError(409, "Ya existe un usuario con ese correo");
  }

  // Se valida la cedula ANTES de crear la cuenta para no dejarla huerfana
  // (sin ficha) si la cedula ya esta en uso -- mismo orden que
  // createConductor en conductores.service.js.
  if (user.rol === ROL_CONDUCTOR) {
    await verificarCedulaDisponible(user.cedula, empresaId);
  }

  const created = await usuariosRepository.create({
    ...user,
    password_hash: await hashPassword(user.password),
    foto_url: file ? `/uploads/usuarios/${file.filename}` : null,
    foto_posicion: normalizeFotoPosicion(payload.foto_posicion),
    empresa_id: empresaId
  });

  if (user.rol === ROL_CONDUCTOR) {
    try {
      await sincronizarFichaConductor(created, user.cedula, empresaId);
    } catch (error) {
      // No dejar una cuenta Conductor sin ficha si la sincronizacion falla
      // -- mismo criterio de rollback que createConductor.
      await db.run("DELETE FROM usuarios WHERE id = ?", [created.id]).catch(() => {});
      throw error;
    }
  }

  const safeUser = toSafeUser(created);

  notificacionesService.notificarUsuarioCreado(safeUser).catch((error) => {
    console.error("No fue posible notificar la creacion de usuario:", error.message);
  });

  registrarEventoUsuario({
    usuario_afectado_id: safeUser.id,
    actor_usuario_id: actorUserId,
    empresa_id: empresaId,
    evento: "creado",
    detalle: { rol: safeUser.rol }
  });

  return safeUser;
}

async function updateUser(id, payload, file, empresaId, callerPermisos = [], actorUserId = null) {
  const existing = await usuariosRepository.findById(id, empresaId);
  if (!existing) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  const user = await validateUserPayload(payload, { isUpdate: true, existingRoleId: existing.role_id, callerPermisos });
  const sameEmailUser = await usuariosRepository.findByEmail(user.email);

  if (sameEmailUser && String(sameEmailUser.id) !== String(id)) {
    throw new HttpError(409, "Ya existe un usuario con ese correo");
  }

  // Se busca la ficha existente (si la hay) y se valida la cedula ANTES de
  // tocar la cuenta -- incluye el caso de un usuario que ya era Conductor
  // pero quedo sin ficha por el bug (ver createUser): guardar de nuevo aca
  // la crea.
  let conductorExistente = null;
  if (user.rol === ROL_CONDUCTOR) {
    conductorExistente = await conductoresRepository.findByUsuarioId(id, empresaId);
    await verificarCedulaDisponible(user.cedula, empresaId, conductorExistente?.id);
  }

  const fotoUrl = file ? `/uploads/usuarios/${file.filename}` : existing.foto_url;
  // Si el payload no trae foto_posicion (ej. se edito solo el nombre, sin
  // tocar el encuadre de la foto), se conserva la que ya tenia -- si no,
  // cualquier edicion no relacionada le resetearia el encuadre al centro.
  const fotoPosicion = payload.foto_posicion
    ? normalizeFotoPosicion(payload.foto_posicion)
    : (existing.foto_posicion || "50% 50%");

  const updated = await usuariosRepository.update(
    id,
    {
      ...user,
      foto_url: fotoUrl,
      foto_posicion: fotoPosicion,
      password_hash: user.password ? await hashPassword(user.password) : null
    },
    empresaId
  );

  if (file && existing.foto_url) {
    await eliminarFotoAnterior(existing.foto_url);
  }

  if (user.rol === ROL_CONDUCTOR) {
    await sincronizarFichaConductor(updated, user.cedula, empresaId, conductorExistente);
  }

  const safeUser = toSafeUser(updated);

  if (String(existing.role_id) !== String(safeUser.role_id)) {
    notificacionesService.notificarPermisosActualizados(safeUser).catch((error) => {
      console.error("No fue posible notificar el cambio de permisos:", error.message);
    });

    registrarEventoUsuario({
      usuario_afectado_id: safeUser.id,
      actor_usuario_id: actorUserId,
      empresa_id: empresaId,
      evento: "rol_cambiado",
      detalle: { rol_anterior: existing.rol, rol_nuevo: safeUser.rol }
    });
  }

  const camposModificados = {};
  if (existing.nombre !== safeUser.nombre) camposModificados.nombre = { anterior: existing.nombre, nuevo: safeUser.nombre };
  if ((existing.celular || null) !== (safeUser.celular || null)) {
    camposModificados.celular = { anterior: existing.celular, nuevo: safeUser.celular };
  }
  if (Boolean(existing.activo) !== safeUser.activo) {
    camposModificados.activo = { anterior: Boolean(existing.activo), nuevo: safeUser.activo };
  }
  if (file) camposModificados.foto = { actualizada: true };

  if (Object.keys(camposModificados).length) {
    registrarEventoUsuario({
      usuario_afectado_id: safeUser.id,
      actor_usuario_id: actorUserId,
      empresa_id: empresaId,
      evento: "editado",
      detalle: camposModificados
    });
  }

  return safeUser;
}

async function setUserActive(id, active, currentUserId, empresaId) {
  if (String(id) === String(currentUserId) && !active) {
    throw new HttpError(400, "No puedes desactivar tu propio usuario");
  }

  const existing = await usuariosRepository.findById(id, empresaId);
  if (!existing) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  const updated = await usuariosRepository.setActive(id, Boolean(active), empresaId);
  const safeUser = toSafeUser(updated);

  registrarEventoUsuario({
    usuario_afectado_id: safeUser.id,
    actor_usuario_id: currentUserId,
    empresa_id: empresaId,
    evento: active ? "activado" : "desactivado"
  });

  return safeUser;
}

module.exports = {
  listUsers,
  listUsersCatalogo,
  createUser,
  updateUser,
  setUserActive,
  toSafeUser
};
