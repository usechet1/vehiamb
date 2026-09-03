const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

// Login en dos capas, las dos solo cuentan intentos FALLIDOS
// (skipSuccessfulRequests) -- que varios usuarios reales inicien sesion
// seguido desde la misma IP (oficina/red compartida) nunca debe gastarles
// el cupo a los demas:
//   - loginLimiterPorCuenta: 10 fallos / 15 min por IP+correo. Cada usuario
//     tiene su propio cupo (clave = ip + correo intentado), asi que el
//     usuario que se equivoca no bloquea a sus compañeros -- pero sigue
//     frenando fuerza bruta dirigida a UNA cuenta puntual.
//   - loginLimiterPorIp: 30 fallos / 15 min por IP, sin importar el correo.
//     Sin este, alguien podria probar contraseñas contra muchos correos
//     distintos (uno nuevo cada vez, cada uno con su propio cupo limpio) y
//     esquivar por completo el limite de arriba.
const loginLimiterPorCuenta = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const ipKey = ipKeyGenerator(req.ip);
    return email ? `${ipKey}:${email}` : ipKey;
  },
  message: { error: "Demasiados intentos de inicio de sesion para esta cuenta. Intenta de nuevo en unos minutos." }
});

const loginLimiterPorIp = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "Demasiados intentos de inicio de sesion desde esta red. Intenta de nuevo en unos minutos." }
});

// Recuperacion de contraseña ("olvide-password"/"reset-password") SIEMPRE
// responde 200 (nunca revela si el correo existe en la plataforma) -- con
// skipSuccessfulRequests quedaria practicamente sin limite, asi que aca se
// mantiene el limite simple original: por IP, cuenta cualquier solicitud
// (exitosa o no).
const recuperacionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Intenta de nuevo en unos minutos." }
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

module.exports = { loginLimiterPorCuenta, loginLimiterPorIp, recuperacionLimiter, apiLimiter };
