require("dotenv").config({ quiet: true });

const DEFAULT_DEV_AUTH_SECRET = "vehiamb-dev-secret";
const DEFAULT_DEV_ADMIN_PASSWORD = "Admin123*";
const nodeEnv = process.env.NODE_ENV || "development";

// En produccion no se acepta el secreto/clave de desarrollo: ambos son
// publicos en el repo (.env.example), asi que quedarse con el default fuera
// de "development" permite forjar tokens validos para cualquier usuario o
// entrar con la clave del admin semilla. Falla rapido en el arranque en vez
// de exponer un bypass de autenticacion silencioso.
if (nodeEnv === "production") {
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET === DEFAULT_DEV_AUTH_SECRET) {
    throw new Error(
      "AUTH_SECRET debe definirse en produccion con un valor propio (no el de .env.example). " +
      "Generar uno con: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
    );
  }

  if (!process.env.SEED_ADMIN_PASSWORD || process.env.SEED_ADMIN_PASSWORD === DEFAULT_DEV_ADMIN_PASSWORD) {
    throw new Error("SEED_ADMIN_PASSWORD debe definirse en produccion con un valor propio (no el de .env.example).");
  }
}

const env = {
  nodeEnv,
  port: Number(process.env.PORT || 3000),
  corsOrigin: process.env.CORS_ORIGIN || "*",
  dbClient: process.env.DB_CLIENT || "postgres",
  databaseUrl: process.env.DATABASE_URL || "postgres://vehiamb:vehiamb_dev@localhost:5432/vehiamb",
  authSecret: process.env.AUTH_SECRET || DEFAULT_DEV_AUTH_SECRET,
  authTokenHours: Number(process.env.AUTH_TOKEN_HOURS || 12),
  seedAdminName: process.env.SEED_ADMIN_NAME || "Administrador VehiAmb",
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL || "admin@vehiamb.local",
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || DEFAULT_DEV_ADMIN_PASSWORD,
  seedAdminRole: process.env.SEED_ADMIN_ROLE || "Administrador",
  excelFilePath: process.env.EXCEL_FILE_PATH || "",
  excelRetryAttempts: Number(process.env.EXCEL_RETRY_ATTEMPTS || 3),
  excelRetryDelayMs: Number(process.env.EXCEL_RETRY_DELAY || 5000),
  importSchedule: process.env.IMPORT_SCHEDULE || "0 2 * * *",
  importTimezone: process.env.IMPORT_TIMEZONE || "America/Bogota",
  gastosSyncSchedule: process.env.GASTOS_SYNC_SCHEDULE || "0 */4 * * *",
  stockExcelFilePath: process.env.STOCK_EXCEL_FILE_PATH || "",
  stockImportSchedule: process.env.STOCK_IMPORT_SCHEDULE || "0 3 * * *",
  stockImportTimezone: process.env.STOCK_IMPORT_TIMEZONE || process.env.IMPORT_TIMEZONE || "America/Bogota",
  configExcelFilePath: process.env.CONFIG_EXCEL_FILE_PATH || "",
  configSyncSchedule: process.env.CONFIG_SYNC_SCHEDULE || "0 4 * * *",

  // Canal de email para notificaciones (ver notificaciones-email.channel.js).
  // Se activa solo si SMTP_HOST esta definido; sin eso el canal queda
  // silenciosamente inactivo (no rompe nada en dev/local sin SMTP).
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  smtpFrom: process.env.SMTP_FROM || "VehiAmb <notificaciones@vehiamb.local>",
  // Prioridad minima que dispara email (critica/alta/media/informativa). Por
  // defecto solo critica y alta: evita saturar el correo con avisos de baja
  // urgencia que ya se ven en el centro de notificaciones in-app.
  emailAlertPrioridadMinima: process.env.EMAIL_ALERT_PRIORIDAD_MINIMA || "alta",
  // Base para armar enlaces "Ver en VehiAmb" dentro del correo (sin / final).
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:8080"
};

module.exports = env;
