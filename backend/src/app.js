require("./database/init");

const express = require("express");
const cors = require("cors");

const env = require("./config/env");
const errorHandler = require("./middlewares/error-handler");
const notFound = require("./middlewares/not-found");
const vehiculosRoutes = require("./routes/vehiculos.routes");

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "vehiamb-api",
    dbClient: env.dbClient
  });
});

app.use("/api/vehiculos", vehiculosRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
