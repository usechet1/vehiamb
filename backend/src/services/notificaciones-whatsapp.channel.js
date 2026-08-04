const env = require("../config/env");
const usuariosRepository = require("../repositories/usuarios.repository");
const vehiculosRepository = require("../repositories/vehiculos.repository");
const notifConfig = require("../config/notificaciones.config");

const SIN_DATO = "-";

function debeEnviarPorPrioridad(prioridad) {
  const minimo = notifConfig.ordenPrioridad(env.whatsappAlertPrioridadMinima);
  return notifConfig.ordenPrioridad(prioridad) <= minimo;
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

// fecha_infraccion llega desde accion_payload ya como string ISO (paso por
// JSON.stringify/parse en notificaciones.service.js, que serializa los Date
// de Postgres a ISO), asi que se recorta directo sin pasar por Date/zona
// horaria.
function formatFechaComparendo(value) {
  if (!value) return "";
  const [anio, mes, dia] = String(value).slice(0, 10).split("-");
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : "";
}

// Tipos de notificacion que usan la plantilla especifica ("simit_comparendo_v1"):
// su encabezado ("Nuevo comparendo detectado en SIMIT") es texto fijo del
// disenio aprobado en Meta, no una variable, asi que solo sirve para alertas
// de SIMIT. El resto de tipos (documentos, mantenimientos, inspecciones,
// etc.) usa la plantilla generica ("notify_v2", ver construirMensajeGenerico
// y enviarPlantillaGenerica mas abajo).
const TIPOS_SIMIT = new Set(["simit_multa_detectada", "simit_estado_cambiado"]);

// La plantilla tiene 7 variables de texto en el cuerpo: {{1}} nombre del
// destinatario, {{2}} vehiculo, {{3}} resumen, {{4}} numero de comparendo,
// {{5}} conductor, {{6}} fecha, {{7}} descripcion. Cuando un campo no aplica
// (ej. mas de un comparendo nuevo a la vez) se manda SIN_DATO ("-") porque
// Meta rechaza parametros vacios. Meta tambien rechaza (HTTP 400, error
// 132018) cualquier "\n"/tab literal en una variable -- probamos el truco de
// reemplazarlo por U+2028 (line separator) para simular el salto, pero
// WhatsApp lo renderiza como un caracter roto ("◊◊"), no como salto de
// linea, asi que todo texto libre va en una sola linea, separando cada dato
// con " - " y cada comparendo con " | ".
//
// "resumen" viene de accion_payload.resumen (ver simit.service.js
// notificarNovedades), sin repetir el vehiculo porque ya va aparte en {{2}}.
// Notificaciones de SIMIT creadas antes de que se agregara ese campo caen al
// mensaje completo (con algo de redundancia, pero sin quedar vacias).

// Cuando varios comparendos llegan en una misma notificacion, conductor y
// fecha solo tienen un valor claro si TODOS los comparendos comparten el
// mismo dato -- si no, se avisa que hay varios en vez de mostrar el de uno
// solo arbitrariamente.
function valorComunOFallback(valores, fallback) {
  const unicos = new Set(valores.filter(Boolean));
  if (unicos.size === 0) return SIN_DATO;
  if (unicos.size === 1) return [...unicos][0];
  return fallback;
}

function construirDetalleWhatsapp(notificacion) {
  let payload = null;
  if (notificacion.accion_payload) {
    try {
      payload = JSON.parse(notificacion.accion_payload);
    } catch (error) {
      payload = null;
    }
  }

  const detalle = {
    resumen: payload?.resumen || notificacion.mensaje,
    comparendoNumero: SIN_DATO,
    conductor: SIN_DATO,
    fecha: SIN_DATO,
    descripcion: SIN_DATO
  };

  const comparendos = payload?.detalle_comparendos || [];
  if (!comparendos.length) return detalle;

  detalle.conductor = valorComunOFallback(comparendos.map((item) => item.conductor), "Varios");
  detalle.fecha = valorComunOFallback(
    comparendos.map((item) => formatFechaComparendo(item.fecha_infraccion)),
    "Varias fechas"
  );

  if (comparendos.length === 1) {
    detalle.comparendoNumero = comparendos[0].numero_comparendo || SIN_DATO;
    detalle.descripcion = comparendos[0].descripcion || SIN_DATO;
    return detalle;
  }

  detalle.comparendoNumero = `Varios (${comparendos.length})`;
  detalle.descripcion = comparendos
    .map((item, indice) => {
      const fecha = formatFechaComparendo(item.fecha_infraccion);
      const partes = [`${indice + 1}) Comparendo ${item.numero_comparendo || "sin número"}`];
      if (fecha) partes.push(`Fecha: ${fecha}`);
      if (item.descripcion) partes.push(`Descripción: ${item.descripcion}`);
      return partes.join(" - ");
    })
    .join(" | ");
  return detalle;
}

async function resolverVehiculoLabel(vehiculoId, empresaId) {
  if (!vehiculoId) return SIN_DATO;
  const vehiculo = await vehiculosRepository.findById(vehiculoId, empresaId);
  if (!vehiculo) return SIN_DATO;
  return vehiculo.placa || SIN_DATO;
}

// Para "inspeccion_con_hallazgos" se le agrega al mensaje un listado de
// detalle (igual que ya hace notificaciones-email.channel.js en HTML). La
// plantilla generica solo tiene una variable de texto libre para el mensaje,
// y Meta rechaza (HTTP 400, error 132018) cualquier "\n"/tab literal en esa
// variable, asi que se arma todo en una sola linea, separando cada item con
// " | " (mismo criterio que construirDetalleWhatsapp para SIMIT).
function construirMensajeGenerico(notificacion) {
  if (notificacion.tipo !== "inspeccion_con_hallazgos") return notificacion.mensaje;

  let payload = null;
  if (notificacion.accion_payload) {
    try {
      payload = JSON.parse(notificacion.accion_payload);
    } catch (error) {
      payload = null;
    }
  }

  const itemsMal = payload?.detalle_inspeccion?.items_mal || [];
  if (!itemsMal.length) return notificacion.mensaje;

  const listado = itemsMal
    .map((item) => `${item.label}${item.comentario ? ` (${item.comentario})` : ""}`)
    .join(" | ");

  return `${notificacion.mensaje} Ítems en mal estado: ${listado}.`;
}

async function enviarPlantilla(templateName, templateLang, celular, parametros) {
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
        name: templateName,
        language: { code: templateLang },
        components: [{ type: "body", parameters: parametros }]
      }
    })
  });

  const cuerpo = await response.text().catch(() => "");

  if (!response.ok) {
    console.error(`Error enviando WhatsApp (HTTP ${response.status}) a ${celular} via "${templateName}":`, cuerpo);
    return;
  }

  // Log tambien en el caso exitoso: la respuesta trae el "wamid" (message id,
  // util para buscar el mensaje en el registro de Meta) y el "wa_id" resuelto
  // para el numero (contacts[0].wa_id) -- si Meta no devuelve ese campo o
  // devuelve uno distinto al numero enviado, es señal de que el numero no
  // resolvio a una cuenta de WhatsApp valida, aunque el HTTP haya sido 200.
  console.log(`WhatsApp enviado a ${celular} via "${templateName}":`, cuerpo);
}

// Plantilla especifica de SIMIT ("simit_comparendo_v1"): header/footer fijos,
// 7 variables en el cuerpo (ver construirDetalleWhatsapp) y un boton de URL
// fija (no acepta parametros: Meta rechaza el envio si se le manda un
// componente "button" para esta plantilla).
async function enviarPlantillaSimit(notificacion, usuario, celular) {
  const limpiar = (texto) => String(texto ?? SIN_DATO).replace(/[\n\t]+/g, " ") || SIN_DATO;

  const vehiculoLabel = await resolverVehiculoLabel(notificacion.vehiculo_id, notificacion.empresa_id);
  const detalle = construirDetalleWhatsapp(notificacion);

  await enviarPlantilla(env.whatsappTemplateName, env.whatsappTemplateLang, celular, [
    { type: "text", text: limpiar(usuario?.nombre) },
    { type: "text", text: limpiar(vehiculoLabel) },
    { type: "text", text: limpiar(detalle.resumen) },
    { type: "text", text: limpiar(detalle.comparendoNumero) },
    { type: "text", text: limpiar(detalle.conductor) },
    { type: "text", text: limpiar(detalle.fecha) },
    { type: "text", text: limpiar(detalle.descripcion) }
  ]);
}

// Plantilla generica ("notify_v2"): header/footer fijos, 3 variables en el
// cuerpo (nombre del usuario, titulo, mensaje) y un boton de URL fija (mismas
// restricciones que la de SIMIT). Cubre todo lo que no sea SIMIT: documentos,
// mantenimientos, inspecciones, etc.
async function enviarPlantillaGenerica(notificacion, usuario, celular) {
  const defaults = notifConfig.tipoConfig(notificacion.tipo);
  const titulo = notificacion.titulo || defaults.titulo;
  const mensaje = construirMensajeGenerico(notificacion).replace(/[\n\t]+/g, " ");

  await enviarPlantilla(env.whatsappTemplateNameGenerico, env.whatsappTemplateLangGenerico, celular, [
    { type: "text", text: usuario?.nombre || "" },
    { type: "text", text: titulo },
    { type: "text", text: mensaje }
  ]);
}

/**
 * Canal de WhatsApp. Se registra en CHANNELS (notificaciones.service.js) y se
 * dispara para toda notificacion creada: los tipos en TIPOS_SIMIT usan la
 * plantilla especifica de SIMIT, el resto usa la plantilla generica. Queda
 * inactivo por completo si no hay WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID
 * configurados, y solo envia para prioridad alta/critica (configurable via
 * WHATSAPP_ALERT_PRIORIDAD_MINIMA), mismo criterio que el canal de email.
 */
async function whatsappChannel(notificacion) {
  try {
    if (!env.whatsappToken || !env.whatsappPhoneNumberId) return;
    if (!debeEnviarPorPrioridad(notificacion.prioridad)) return;

    const usuario = await usuariosRepository.findById(notificacion.usuario_id, notificacion.empresa_id);
    const celular = normalizarCelular(usuario?.celular);
    if (!celular) return;

    if (TIPOS_SIMIT.has(notificacion.tipo)) {
      await enviarPlantillaSimit(notificacion, usuario, celular);
    } else {
      await enviarPlantillaGenerica(notificacion, usuario, celular);
    }
  } catch (error) {
    console.error("Error enviando notificacion por WhatsApp:", error.message);
  }
}

module.exports = whatsappChannel;
