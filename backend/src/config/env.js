require("dotenv").config({ quiet: true });

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),
  corsOrigin: process.env.CORS_ORIGIN || "*",
  dbClient: process.env.DB_CLIENT || "postgres",
  databaseUrl: process.env.DATABASE_URL || "postgres://vehiamb:vehiamb_dev@localhost:5432/vehiamb",
  authSecret: process.env.AUTH_SECRET || "vehiamb-dev-secret",
  authTokenHours: Number(process.env.AUTH_TOKEN_HOURS || 12),
  seedAdminName: process.env.SEED_ADMIN_NAME || "Administrador VehiAmb",
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL || "admin@vehiamb.local",
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || "Admin123*",
  seedAdminRole: process.env.SEED_ADMIN_ROLE || "Administrador",
  excelFilePath: process.env.EXCEL_FILE_PATH || "",
  excelRetryAttempts: Number(process.env.EXCEL_RETRY_ATTEMPTS || 3),
  excelRetryDelayMs: Number(process.env.EXCEL_RETRY_DELAY || 5000),
  importSchedule: process.env.IMPORT_SCHEDULE || "0 2 * * *",
  importTimezone: process.env.IMPORT_TIMEZONE || "America/Bogota",
  stockExcelFilePath: process.env.STOCK_EXCEL_FILE_PATH || "",
  stockImportSchedule: process.env.STOCK_IMPORT_SCHEDULE || "0 3 * * *",
  stockImportTimezone: process.env.STOCK_IMPORT_TIMEZONE || process.env.IMPORT_TIMEZONE || "America/Bogota"
};

module.exports = env;
