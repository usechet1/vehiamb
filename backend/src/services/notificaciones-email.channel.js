const nodemailer = require("nodemailer");
const env = require("../config/env");
const usuariosRepository = require("../repositories/usuarios.repository");
const notifConfig = require("../config/notificaciones.config");

// Mismo mapeo que ACCIONES en frontend/assets/js/shared/notificaciones-config.js:
// cada accion_tipo resuelve a la pagina de destino dentro de la app. Se
// mantiene una copia aqui porque el email se arma en el servidor, sin acceso
// al bundle de frontend.
const ACCION_RUTAS = {
  ver_vehiculo: (payload) => `vehiculo.html?id=${payload?.vehiculo_id}`,
  ver_mantenimiento: () => "mantenimientos.html",
  renovar_documento: () => "documentos.html",
  ver_usuario: () => "admin-usuarios.html",
  ver_repuesto: () => "repuestos.html"
};

let transporter = null;
let transporterInitIntentado = false;

function getTransporter() {
  if (!env.smtpHost) return null;
  if (transporter || transporterInitIntentado) return transporter;

  transporterInitIntentado = true;
  transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined
  });

  return transporter;
}

function debeEnviarPorPrioridad(prioridad) {
  const minimo = notifConfig.ordenPrioridad(env.emailAlertPrioridadMinima);
  return notifConfig.ordenPrioridad(prioridad) <= minimo;
}

function construirEnlace(notificacion) {
  if (!notificacion.accion_tipo || !ACCION_RUTAS[notificacion.accion_tipo]) {
    return `${env.appBaseUrl}/notificaciones.html`;
  }

  let payload = null;
  if (notificacion.accion_payload) {
    try {
      payload = JSON.parse(notificacion.accion_payload);
    } catch (error) {
      payload = null;
    }
  }

  return `${env.appBaseUrl}/${ACCION_RUTAS[notificacion.accion_tipo](payload)}`;
}

function construirCorreo(notificacion) {
  const defaults = notifConfig.tipoConfig(notificacion.tipo);
  const prioridad = notifConfig.PRIORIDADES[notifConfig.normalizarPrioridad(notificacion.prioridad || defaults.prioridad)];
  const categoria = notifConfig.CATEGORIAS[notificacion.categoria || defaults.categoria];
  const titulo = notificacion.titulo || defaults.titulo;
  const enlace = construirEnlace(notificacion);

  return {
    subject: `${prioridad.icono} ${titulo} - VehiAmb`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <p style="color: #697386; font-size: 12px; text-transform: uppercase; margin-bottom: 4px;">
          ${categoria.icono} ${categoria.label} &middot; ${prioridad.label}
        </p>
        <h2 style="color: #18202b; margin: 0 0 12px;">${titulo}</h2>
        <p style="color: #303947; line-height: 1.5;">${notificacion.mensaje}</p>
        <a href="${enlace}" style="display: inline-block; margin-top: 16px; padding: 10px 18px; background: #b21f2d; color: #fff; border-radius: 6px; text-decoration: none; font-weight: bold;">
          Ver en VehiAmb
        </a>
      </div>
    `
  };
}

/**
 * Canal de email. Se registra en CHANNELS (notificaciones.service.js) y se
 * dispara para toda notificacion creada. Queda inactivo por completo si no
 * hay SMTP_HOST configurado, y solo envia para prioridad alta/critica
 * (configurable via EMAIL_ALERT_PRIORIDAD_MINIMA) para no saturar el correo
 * con avisos que ya se ven en el centro de notificaciones in-app.
 */
async function emailChannel(notificacion) {
  try {
    const smtp = getTransporter();
    if (!smtp) return;
    if (!debeEnviarPorPrioridad(notificacion.prioridad)) return;

    const usuario = await usuariosRepository.findById(notificacion.usuario_id, notificacion.empresa_id);
    if (!usuario?.email) return;

    const { subject, html } = construirCorreo(notificacion);

    await smtp.sendMail({
      from: env.smtpFrom,
      to: usuario.email,
      subject,
      html
    });
  } catch (error) {
    console.error("Error enviando notificacion por email:", error.message);
  }
}

module.exports = emailChannel;
