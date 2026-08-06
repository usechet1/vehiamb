const HttpError = require("../errors/http-error");
const usuariosRepository = require("../repositories/usuarios.repository");
const logsAccesoRepository = require("../repositories/logs-acceso.repository");
const passwordResetTokensRepository = require("../repositories/password-reset-tokens.repository");
const { verifyPassword, hashPassword } = require("../utils/password");
const { createAuthToken, verifyAuthToken } = require("../utils/token");
const { generarTokenReset, hashTokenReset } = require("../utils/reset-token");
const { getTransporter } = require("../utils/mailer");
const env = require("../config/env");

const RESET_TOKEN_VIGENCIA_HORAS = 1;

// Fire-and-forget: un fallo al guardar el log de acceso nunca puede romper
// el login (mismo criterio que notificarUsuarioCreado en usuarios.service.js).
function registrarAcceso(data) {
  logsAccesoRepository
    .registrar(data)
    .catch((error) => console.error("No fue posible registrar el log de acceso:", error.message));
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
    empresa_id: user.empresa_id,
    empresa_nombre: user.empresa_nombre,
    empresa_logo_url: user.empresa_logo_url,
    permisos: user.permisos || [],
    debe_cambiar_password: Boolean(user.debe_cambiar_password)
  };
}

// Los modulos deshabilitados son un ajuste POR EMPRESA (no por rol, que es
// catalogo global): permiten venderle a una empresa un subconjunto de la app
// sin duplicar roles. Se restan de los permisos ya resueltos por rol, asi
// que tanto el sidebar (oculta el boton) como cada requirePermission() del
// backend (bloquea el endpoint) quedan protegidos con este unico filtro.
function aplicarModulosDeshabilitados(permisos, modulosDeshabilitados) {
  if (!Array.isArray(modulosDeshabilitados) || !modulosDeshabilitados.length) return permisos;
  const deshabilitados = new Set(modulosDeshabilitados);
  return permisos.filter((codigo) => !deshabilitados.has(codigo));
}

async function enrichUser(user) {
  const permisosDelRol = await usuariosRepository.findPermissionsByUserId(user.id);
  const permisos = aplicarModulosDeshabilitados(permisosDelRol, user.empresa_modulos_deshabilitados);
  return toSafeUser({ ...user, permisos });
}

async function login(payload, meta = {}) {
  const email = String(payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "");
  const { ip = null, userAgent = null } = meta;

  if (!email || !password) {
    throw new HttpError(400, "Correo y contrasena son obligatorios");
  }

  const user = await usuariosRepository.findByEmail(email);
  if (!user) {
    registrarAcceso({ email_intentado: email, resultado: "credenciales_invalidas", ip, user_agent: userAgent });
    throw new HttpError(401, "Credenciales invalidas");
  }

  if (!user.activo) {
    registrarAcceso({
      usuario_id: user.id,
      empresa_id: user.empresa_id,
      email_intentado: email,
      resultado: "usuario_inactivo",
      ip,
      user_agent: userAgent
    });
    throw new HttpError(401, "Credenciales invalidas");
  }

  const validPassword = await verifyPassword(password, user.password_hash);
  if (!validPassword) {
    registrarAcceso({
      usuario_id: user.id,
      empresa_id: user.empresa_id,
      email_intentado: email,
      resultado: "credenciales_invalidas",
      ip,
      user_agent: userAgent
    });
    throw new HttpError(401, "Credenciales invalidas");
  }

  registrarAcceso({
    usuario_id: user.id,
    empresa_id: user.empresa_id,
    email_intentado: email,
    resultado: "exitoso",
    ip,
    user_agent: userAgent
  });

  return {
    token: createAuthToken(user),
    user: await enrichUser(user)
  };
}

async function getCurrentUser(authToken) {
  const payload = verifyAuthToken(authToken);
  if (!payload?.sub) {
    throw new HttpError(401, "Sesión inválida o expirada");
  }

  const user = await usuariosRepository.findById(payload.sub);
  if (!user || !user.activo) {
    throw new HttpError(401, "Sesión inválida o expirada");
  }

  return enrichUser(user);
}

// Usado tanto para el cambio forzado en el primer login (contrasena
// temporal puesta por un Administrador) como para un cambio voluntario mas
// adelante -- en ambos casos exige la contrasena actual, para que una
// sesion abierta que alguien mas encuentre no alcance para tomarse la
// cuenta sin conocerla.
async function cambiarPassword(userId, payload) {
  const passwordActual = String(payload.password_actual || "");
  const passwordNueva = String(payload.password_nueva || "");

  if (!passwordActual || !passwordNueva) {
    throw new HttpError(400, "La contraseña actual y la nueva son obligatorias");
  }

  if (passwordNueva.length < 6) {
    throw new HttpError(400, "La nueva contraseña debe tener al menos 6 caracteres");
  }

  const user = await usuariosRepository.findById(userId);
  if (!user) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  const passwordValida = await verifyPassword(passwordActual, user.password_hash);
  if (!passwordValida) {
    throw new HttpError(401, "La contraseña actual no es correcta");
  }

  const updated = await usuariosRepository.setPassword(userId, await hashPassword(passwordNueva));
  return enrichUser(updated);
}

function construirCorreoRecuperacion(nombre, enlace) {
  return {
    subject: "Recupera tu contraseña - VehiAmb",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #18202b; margin: 0 0 12px;">Recupera tu contraseña</h2>
        <p style="color: #303947; line-height: 1.5;">
          Hola ${nombre ? nombre : ""}, recibimos una solicitud para restablecer tu contraseña en VehiAmb.
          Este enlace es válido por ${RESET_TOKEN_VIGENCIA_HORAS} hora(s).
        </p>
        <a href="${enlace}" style="display: inline-block; margin-top: 16px; padding: 10px 18px; background: #b21f2d; color: #fff; border-radius: 6px; text-decoration: none; font-weight: bold;">
          Restablecer contraseña
        </a>
        <p style="color: #8b95a6; font-size: 12px; margin-top: 20px;">
          Si tú no pediste este cambio, puedes ignorar este correo -- tu contraseña actual sigue funcionando.
        </p>
      </div>
    `
  };
}

// Siempre resuelve sin lanzar error y con el mismo mensaje generico en el
// controller, exista o no el correo -- de lo contrario este endpoint se
// podria usar para averiguar que correos estan registrados en la plataforma.
async function solicitarRecuperacionPassword(email) {
  const normalizado = String(email || "").trim().toLowerCase();
  if (!normalizado) return;

  const user = await usuariosRepository.findByEmail(normalizado);
  if (!user || !user.activo) return;

  const smtp = getTransporter();
  if (!smtp) {
    console.error("No se pudo enviar el correo de recuperacion: SMTP no esta configurado");
    return;
  }

  await passwordResetTokensRepository.invalidarPendientesDeUsuario(user.id);

  const token = generarTokenReset();
  const expiraEn = new Date(Date.now() + RESET_TOKEN_VIGENCIA_HORAS * 60 * 60 * 1000);

  await passwordResetTokensRepository.crear({
    usuario_id: user.id,
    token_hash: hashTokenReset(token),
    expira_en: expiraEn
  });

  const enlace = `${env.appBaseUrl}/restablecer-password.html?token=${token}`;
  const { subject, html } = construirCorreoRecuperacion(user.nombre, enlace);

  try {
    await smtp.sendMail({ from: env.smtpFrom, to: user.email, subject, html });
  } catch (error) {
    console.error("Error enviando correo de recuperacion de contraseña:", error.message);
  }
}

async function restablecerPassword(token, passwordNueva) {
  const passwordLimpia = String(passwordNueva || "");
  if (!token || !passwordLimpia) {
    throw new HttpError(400, "Token y nueva contraseña son obligatorios");
  }

  if (passwordLimpia.length < 6) {
    throw new HttpError(400, "La nueva contraseña debe tener al menos 6 caracteres");
  }

  const registro = await passwordResetTokensRepository.findVigentePorHash(hashTokenReset(token));
  if (!registro) {
    throw new HttpError(400, "El enlace ya no es válido. Solicita uno nuevo.");
  }

  await usuariosRepository.setPassword(registro.usuario_id, await hashPassword(passwordLimpia));
  await passwordResetTokensRepository.marcarUsado(registro.id);
}

module.exports = {
  login,
  getCurrentUser,
  aplicarModulosDeshabilitados,
  cambiarPassword,
  solicitarRecuperacionPassword,
  restablecerPassword
};
