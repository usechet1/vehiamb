const crypto = require("crypto");
const env = require("../config/env");

function toBase64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

function sign(value) {
  return crypto
    .createHmac("sha256", env.authSecret)
    .update(value)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createAuthToken(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    nombre: user.nombre,
    rol: user.rol,
    exp: Date.now() + env.authTokenHours * 60 * 60 * 1000
  };

  const encoded = toBase64Url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

// Comparacion en tiempo constante: "!==" sobre strings compara byte a byte y
// corta en el primer caracter distinto, filtrando por timing cuanto de la
// firma esperada acerto un atacante. timingSafeEqual exige buffers del mismo
// largo, por eso se valida el largo antes (con un valor fijo, no derivado de
// la firma recibida, para no reintroducir el mismo problema).
function firmaValida(esperada, recibida) {
  const bufferEsperado = Buffer.from(esperada);
  const bufferRecibido = Buffer.from(recibida);
  if (bufferEsperado.length !== bufferRecibido.length) return false;
  return crypto.timingSafeEqual(bufferEsperado, bufferRecibido);
}

function verifyAuthToken(token) {
  if (!token || !token.includes(".")) return null;

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  if (!firmaValida(sign(encoded), signature)) return null;

  const payload = JSON.parse(fromBase64Url(encoded));
  if (!payload.exp || payload.exp < Date.now()) return null;

  return payload;
}

module.exports = {
  createAuthToken,
  verifyAuthToken
};
