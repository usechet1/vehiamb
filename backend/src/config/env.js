require("dotenv").config({ quiet: true });

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),
  corsOrigin: process.env.CORS_ORIGIN || "*",
  dbClient: process.env.DB_CLIENT || "sqlite",
  databaseUrl: process.env.DATABASE_URL || "postgres://vehiamb:vehiamb_dev@localhost:5432/vehiamb",
  authSecret: process.env.AUTH_SECRET || "vehiamb-dev-secret",
  authTokenHours: Number(process.env.AUTH_TOKEN_HOURS || 12),
  seedAdminName: process.env.SEED_ADMIN_NAME || "Administrador VehiAmb",
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL || "admin@vehiamb.local",
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || "Admin123*",
  seedAdminRole: process.env.SEED_ADMIN_ROLE || "Administrador"
};

module.exports = env;
