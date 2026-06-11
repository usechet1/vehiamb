require("dotenv").config({ quiet: true });

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),
  corsOrigin: process.env.CORS_ORIGIN || "*",
  dbClient: process.env.DB_CLIENT || "sqlite",
  databaseUrl: process.env.DATABASE_URL || "postgres://vehiamb:vehiamb_dev@localhost:5432/vehiamb"
};

module.exports = env;
