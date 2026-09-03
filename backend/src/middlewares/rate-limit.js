const { rateLimit } = require("express-rate-limit");

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

module.exports = { apiLimiter };
