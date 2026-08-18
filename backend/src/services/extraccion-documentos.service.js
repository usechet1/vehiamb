const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const HttpError = require("../errors/http-error");
const { PDFParse, PasswordException } = require("pdf-parse");
const Tesseract = require("tesseract.js");
const vehiculosRepository = require("../repositories/vehiculos.repository");
const env = require("../config/env");

// tesseract.js descarga el modelo de idioma (spa.traineddata, ~3.4MB) la
// primera vez que corre -- con cachePath fijo se guarda ahi y se reutiliza
// en cada request en vez de bajarlo cada vez. Si la carpeta no existe de
// antemano, el intento de guardarlo falla en silencio (queda funcionando
// igual, solo sin persistir), asi que se crea aqui, mismo patron que
// uploadDir en upload-documento.js.
const TESSERACT_CACHE_PATH = path.resolve(__dirname, "..", "..", "tesseract-cache");
fs.mkdirSync(TESSERACT_CACHE_PATH, { recursive: true });

const PLACA_REGEX = /\b([A-Z]{3}\d{3})\b/;

function convertirFechaConBarras(fecha) {
  // "2027/08/06" -> "2027-08-06" (formato que espera /api/automation/documentos)
  return fecha ? fecha.replace(/\//g, "-") : null;
}

function conCamposFaltantes(campos) {
  const camposFaltantes = ["placa", "numero_documento", "fecha_expedicion", "fecha_vencimiento"]
    .filter((campo) => !campos[campo]);

  return { ...campos, campos_faltantes: camposFaltantes };
}

// El PDF de SOAT vuelca primero todos los VALORES en el orden visual de las
// celdas de la tabla (fechas, luego placa, etc.) y mucho mas abajo, aparte,
// un bloque con todas las ETIQUETAS en el mismo orden -- no son pares
// "etiqueta: valor" contiguos como en un formulario normal. La primera linea
// trae las 3 fechas del formulario (FECHA DE EXPEDICION, VIGENCIA DESDE,
// VIGENCIA HASTA) ya en formato YYYY-MM-DD. Se usa VIGENCIA DESDE/HASTA (no
// la fecha de expedicion literal) como fecha_expedicion/fecha_vencimiento en
// VehiAmb, siguiendo el mismo criterio que ya tienen documentos SOAT
// cargados a mano anteriormente.
function extraerCamposSoat(texto) {
  const fechas = texto.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})/m);
  const placa = texto.match(PLACA_REGEX);
  // No. de poliza: una tira de digitos larga (12-16), no coincide con
  // ningun otro campo del formulario (telefono/cedula del tomador son de 10,
  // el total a pagar y las tarifas son mas cortos).
  const numeroPoliza = texto.match(/\b(\d{12,16})\b/);

  return conCamposFaltantes({
    placa: placa ? placa[1] : null,
    numero_documento: numeroPoliza ? numeroPoliza[1] : null,
    fecha_expedicion: fechas ? fechas[2] : null,
    fecha_vencimiento: fechas ? fechas[3] : null
  });
}

// Texto OCR (Tesseract) de la RTM -- formato nacional RUNT, igual sin
// importar el CDA que la expida. A diferencia del SOAT, aca si vienen pares
// "etiqueta: valor" reconocibles, aunque el OCR meta ruido en otras zonas de
// la foto (logos, QR).
function extraerCamposTecnomecanica(textoOcr) {
  const numero = textoOcr.match(/No\.?\s*(\d{6,10})/);
  const fechaExpedicion = textoOcr.match(/Fecha de expedici[oó]n:?\s*(\d{4}\/\d{2}\/\d{2})/i);
  const fechaVencimiento = textoOcr.match(/Fecha de vencimiento:?\s*(\d{4}\/\d{2}\/\d{2})/i);
  const placa = textoOcr.match(new RegExp(`PLACA:?\\s*${PLACA_REGEX.source}`, "i")) || textoOcr.match(PLACA_REGEX);

  return conCamposFaltantes({
    placa: placa ? placa[1] : null,
    numero_documento: numero ? numero[1] : null,
    fecha_expedicion: convertirFechaConBarras(fechaExpedicion ? fechaExpedicion[1] : null),
    fecha_vencimiento: convertirFechaConBarras(fechaVencimiento ? fechaVencimiento[1] : null)
  });
}

// El PDF real de RTM (certificado RUNT) tambien vuelca las dos fechas
// separadas de sus etiquetas, en una linea propia mas abajo -- a diferencia
// del SOAT, aca SI coincide el orden (primera fecha = expedicion, segunda =
// vencimiento), confirmado contra un certificado real. Numero y placa si
// quedan pegados a su etiqueta, asi que esos se leen igual que en OCR.
function extraerCamposTecnomecanicaPdf(texto) {
  const numero = texto.match(/No\.?\s*(\d{6,10})/);
  const fechas = texto.match(/^(\d{4}\/\d{2}\/\d{2})\s+(\d{4}\/\d{2}\/\d{2})/m);
  const placa = texto.match(new RegExp(`PLACA:?\\s*${PLACA_REGEX.source}`, "i")) || texto.match(PLACA_REGEX);

  return conCamposFaltantes({
    placa: placa ? placa[1] : null,
    numero_documento: numero ? numero[1] : null,
    fecha_expedicion: convertirFechaConBarras(fechas ? fechas[1] : null),
    fecha_vencimiento: convertirFechaConBarras(fechas ? fechas[2] : null)
  });
}

async function leerTextoPdf(buffer, password) {
  const parser = new PDFParse({ data: buffer, password });
  try {
    const resultado = await parser.getText();
    return resultado.text;
  } finally {
    await parser.destroy();
  }
}

async function extraerDesdeSoatPdf(buffer) {
  try {
    return extraerCamposSoat(await leerTextoPdf(buffer));
  } catch (error) {
    if (!(error instanceof PasswordException)) {
      throw new HttpError(400, "No fue posible leer el archivo como PDF");
    }
  }

  // El PDF viene protegido -- en la practica casi siempre la clave que
  // ponen las aseguradoras/CDA es la placa del vehiculo, asi que se prueba
  // la placa de cada vehiculo de la flota como contraseña hasta que una
  // funcione, en vez de rendirse de una vez.
  const vehiculos = await vehiculosRepository.findAllSimple(env.automationEmpresaId);
  for (const vehiculo of vehiculos) {
    if (!vehiculo.placa) continue;
    try {
      return extraerCamposSoat(await leerTextoPdf(buffer, vehiculo.placa));
    } catch (error) {
      // Sigue intentando con la siguiente placa.
    }
  }

  throw new HttpError(400, "El PDF está protegido con contraseña y no se pudo abrir con ninguna placa de la flota");
}

// Algunos CDA mandan la RTM como PDF con texto real (certificado generado
// por RUNT) en vez de una foto -- se reutiliza el mismo lector de texto que
// SOAT, pero contra extraerCamposTecnomecanicaPdf (ver arriba), que maneja
// el layout propio de este PDF en vez del de OCR.
async function extraerDesdeTecnomecanicaPdf(buffer) {
  try {
    return extraerCamposTecnomecanicaPdf(await leerTextoPdf(buffer));
  } catch (error) {
    throw new HttpError(400, "No fue posible leer el archivo como PDF");
  }
}

async function extraerDesdeTecnomecanicaImagen(buffer) {
  // Una imagen corrupta/truncada hace que tesseract.js falle dentro de un
  // worker_thread de una forma que NO se puede atrapar con try/catch (sale
  // como excepcion no capturada y tumba todo el proceso, no solo este
  // request) -- se valida la imagen con sharp primero (rechazo normal y
  // atrapable) para nunca llegarle a Tesseract un archivo que no puede leer.
  try {
    await sharp(buffer).metadata();
  } catch (error) {
    throw new HttpError(400, "El archivo no es una imagen válida o está dañado");
  }

  let resultado;
  try {
    resultado = await Tesseract.recognize(buffer, "spa", { cachePath: TESSERACT_CACHE_PATH });
  } catch (error) {
    throw new HttpError(400, "No fue posible leer el texto de la imagen");
  }

  return extraerCamposTecnomecanica(resultado.data.text);
}

module.exports = {
  extraerCamposSoat,
  extraerCamposTecnomecanica,
  extraerCamposTecnomecanicaPdf,
  extraerDesdeSoatPdf,
  extraerDesdeTecnomecanicaPdf,
  extraerDesdeTecnomecanicaImagen
};
