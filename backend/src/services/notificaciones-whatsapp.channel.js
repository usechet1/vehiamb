const env = require("../config/env");
const usuariosRepository = require("../repositories/usuarios.repository");
const notifConfig = require("../config/notificaciones.config");

// Misma idea que ACCION_RUTAS en notificaciones-email.channel.js, pero aqui
// solo se necesita la ruta relativa (sin dominio): el boton de la plantilla
// de WhatsApp tiene la URL base fija ("https://.../") y esto se envia como
// el sufijo dinamico.
const ACCION_RUTAS = {
  ver_vehiculo: (payload) => `vehiculo.html?id=${payload?.vehiculo_id}`,
  ver_mantenimiento: () => "mantenimientos.html",
  renovar_documento: () => "documentos.html",
  ver_usuario: () => "admin-usuarios.html",
  ver_repuesto: () => "repuestos.html"
};

function debeEnviarPorPrioridad(prioridad) {
  const minimo = notifConfig.ordenPrioridad(env.whatsappAlertPrioridadMinima);
  return notifConfig.ordenPrioridad(prioridad) <= minimo;
}

function construirRutaRelativa(notificacion) {
  if (!notificacion.accion_tipo || !ACCION_RUTAS[notificacion.accion_tipo]) {
    return "notificaciones.html";
  }

  let payload = null;
  if (notificacion.accion_payload) {
    try {
      payload = JSON.parse(notificacion.accion_payload);
    } catch (error) {
      payload = null;
    }
  }

  return ACCION_RUTAS[notificacion.accion_tipo](payload);
}

// El campo "celular" se guarda tal cual lo escribe el administrador (ver
// admin-users.js, placeholder "Ej: 3168310623"): solo digitos, sin indicativo
// de pais la mayoria de las veces. La API de WhatsApp exige el numero
// completo sin "+" (ej. "573168310623"), asi que se asume Colombia (57) si
// el numero quedo con la longitud tipica de un celular local (10 digitos).
function normalizarCelular(celular) {
  const digitos = String(celular || "").replace(/\D/g, "");
  if (!digitos) return null;
  if (digitos.length === 10) return `57${digitos}`;
  return digitos;
}

/**
 * Canal de WhatsApp. Se registra en CHANNELS (notificaciones.service.js) y se
 * dispara para toda notificacion creada. Queda inactivo por completo si no
 * hay WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID configurados, y solo
 * envia para prioridad alta/critica (configurable via
 * WHATSAPP_ALERT_PRIORIDAD_MINIMA), mismo criterio que el canal de email.
 *
 * La plantilla ("notify_v2") tiene header/footer fijos, 3 variables en el
 * cuerpo (nombre del usuario, titulo, mensaje) y un boton de URL dinamica.
 */
async function whatsappChannel(notificacion) {
  try {
    if (!env.whatsappToken || !env.whatsappPhoneNumberId) return;
    if (!debeEnviarPorPrioridad(notificacion.prioridad)) return;

    const usuario = await usuariosRepository.findById(notificacion.usuario_id, notificacion.empresa_id);
    const celular = normalizarCelular(usuario?.celular);
    if (!celular) return;

    const defaults = notifConfig.tipoConfig(notificacion.tipo);
    const titulo = notificacion.titulo || defaults.titulo;
    const rutaRelativa = construirRutaRelativa(notificacion);

    const url = `https://graph.facebook.com/${env.whatsappApiVersion}/${env.whatsappPhoneNumberId}/messages`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.whatsappToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: celular,
        type: "template",
        template: {
          name: env.whatsappTemplateName,
          language: { code: env.whatsappTemplateLang },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: usuario?.nombre || "" },
                { type: "text", text: titulo },
                { type: "text", text: notificacion.mensaje }
              ]
            },
            {
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [{ type: "text", text: rutaRelativa }]
            }
          ]
        }
      })
    });

    if (!response.ok) {
      const detalle = await response.text().catch(() => "");
      console.error(`Error enviando WhatsApp (HTTP ${response.status}):`, detalle);
    }
  } catch (error) {
    console.error("Error enviando notificacion por WhatsApp:", error.message);
  }
}

module.exports = whatsappChannel;
