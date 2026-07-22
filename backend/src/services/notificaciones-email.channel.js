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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatFechaCorreo(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// Bloque adicional para el correo de "inspeccion_con_hallazgos": el resto de
// tipos de notificacion se resuelven con un solo parrafo (notificacion.mensaje),
// pero este es el unico que en la practica reemplaza la necesidad de entrar
// a la plataforma -- el conductor no siempre esta cerca para preguntarle
// detalles, asi que Administrador/Operador deben poder ver de una vez que
// fallo, con que comentario, la foto y donde quedo el vehiculo.
function construirDetalleInspeccion(detalle) {
  if (!detalle) return "";

  const filas = [];
  if (detalle.vehiculo_placa) {
    filas.push(`<strong>Vehículo:</strong> ${escapeHtml(detalle.vehiculo_marca)} ${escapeHtml(detalle.vehiculo_modelo)} (${escapeHtml(detalle.vehiculo_placa)})`);
  }
  if (detalle.conductor_nombre) {
    filas.push(`<strong>Conductor:</strong> ${escapeHtml(detalle.conductor_nombre)}`);
  }
  if (detalle.fecha) {
    filas.push(`<strong>Fecha:</strong> ${escapeHtml(formatFechaCorreo(detalle.fecha))}`);
  }

  const datosBasicos = filas.length
    ? `<p style="color: #303947; line-height: 1.6; margin: 12px 0;">${filas.join("<br>")}</p>`
    : "";

  const itemsMal = detalle.items_mal || [];
  const listaItems = itemsMal.length
    ? `
      <div style="margin: 16px 0;">
        <p style="color: #18202b; font-weight: bold; margin: 0 0 8px;">Ítems en mal estado:</p>
        <ul style="margin: 0; padding-left: 20px; color: #303947; line-height: 1.6;">
          ${itemsMal.map((item) => `
            <li style="margin-bottom: 6px;">
              <strong>${escapeHtml(item.label)}</strong>
              ${item.comentario ? ` — ${escapeHtml(item.comentario)}` : ""}
              ${item.foto_url ? ` (<a href="${env.appBaseUrl}${item.foto_url}" style="color: #b21f2d;">ver foto</a>)` : ""}
            </li>
          `).join("")}
        </ul>
      </div>
    `
    : "";

  const ubicacion = (detalle.latitud != null && detalle.longitud != null)
    ? `<p style="margin: 12px 0;"><a href="https://www.google.com/maps?q=${detalle.latitud},${detalle.longitud}" style="color: #b21f2d;">📍 Ver ubicación donde se registró la inspección</a></p>`
    : "";

  return `${datosBasicos}${listaItems}${ubicacion}`;
}

function construirCorreo(notificacion) {
  const defaults = notifConfig.tipoConfig(notificacion.tipo);
  const prioridad = notifConfig.PRIORIDADES[notifConfig.normalizarPrioridad(notificacion.prioridad || defaults.prioridad)];
  const categoria = notifConfig.CATEGORIAS[notificacion.categoria || defaults.categoria];
  const titulo = notificacion.titulo || defaults.titulo;
  const enlace = construirEnlace(notificacion);

  let payload = null;
  if (notificacion.accion_payload) {
    try {
      payload = JSON.parse(notificacion.accion_payload);
    } catch (error) {
      payload = null;
    }
  }

  const detalleHtml = notificacion.tipo === "inspeccion_con_hallazgos"
    ? construirDetalleInspeccion(payload?.detalle_inspeccion)
    : "";

  return {
    subject: `${prioridad.icono} ${titulo} - VehiAmb`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <p style="color: #697386; font-size: 12px; text-transform: uppercase; margin-bottom: 4px;">
          ${categoria.icono} ${categoria.label} &middot; ${prioridad.label}
        </p>
        <h2 style="color: #18202b; margin: 0 0 12px;">${titulo}</h2>
        <p style="color: #303947; line-height: 1.5;">${notificacion.mensaje}</p>
        ${detalleHtml}
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
