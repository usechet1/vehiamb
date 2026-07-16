const rateLimit = require("express-rate-limit");

// Sin este limite, /api/auth/login puede recibir fuerza bruta ilimitada de
// contrasenas (no hay bloqueo de cuenta ni captcha). 10 intentos / 15 min
// por IP alcanza para un usuario real que se equivoca un par de veces, pero
// vuelve inviable un ataque de diccionario.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos de inicio de sesion. Intenta de nuevo en unos minutos." }
});

// Limite general de la API como red de seguridad basica contra scraping o
// abuso automatizado; generoso porque el frontend hace polling normal
// (notificaciones, listados) que no deberia rozar este techo.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Intenta de nuevo en unos minutos." }
});

module.exports = { loginLimiter, apiLimiter };
