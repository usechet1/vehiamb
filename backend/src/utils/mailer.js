const nodemailer = require("nodemailer");
const env = require("../config/env");

let transporter = null;
let transporterInitIntentado = false;

// Transporter SMTP unico y perezoso, compartido por cualquier correo que
// mande el backend (notificaciones, recuperacion de contrasena). Queda
// inactivo (null) si SMTP_HOST no esta definido, sin romper nada en
// dev/local sin SMTP configurado.
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

module.exports = { getTransporter };
