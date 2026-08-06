const crypto = require("crypto");

// Token de un solo uso para "olvide mi contrasena": alta entropia (32 bytes),
// no se hashea con scrypt (a diferencia de password.js) porque no es un
// secreto de baja entropia elegido por una persona -- un hash rapido basta y
// evita una demora innecesaria en cada solicitud.
function generarTokenReset() {
  return crypto.randomBytes(32).toString("hex");
}

function hashTokenReset(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

module.exports = { generarTokenReset, hashTokenReset };
