require("./database/init");

const express = require("express");
const cors = require("cors");
const path = require("path");

const env = require("./config/env");
const errorHandler = require("./middlewares/error-handler");
const notFound = require("./middlewares/not-found");
const requireAuth = require("./middlewares/require-auth");
const authRoutes = require("./routes/auth.routes");
const vehiculosRoutes = require("./routes/vehiculos.routes");
const mantenimientosRoutes = require("./routes/mantenimientos.routes");
const documentosRoutes = require("./routes/documentos.routes");
const usuariosRoutes = require("./routes/usuarios.routes");
const notificacionesRoutes = require("./routes/notificaciones.routes");
const importacionesRoutes = require("./routes/importaciones.routes");

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(path.resolve(__dirname, "..", "uploads")));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "vehiamb-api",
    dbClient: env.dbClient
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/vehiculos", requireAuth, vehiculosRoutes);
app.use("/api/mantenimientos", requireAuth, mantenimientosRoutes);
app.use("/api/documentos", requireAuth, documentosRoutes);
app.use("/api/usuarios", requireAuth, usuariosRoutes);
app.use("/api/notificaciones", requireAuth, notificacionesRoutes);
app.use("/api/importaciones", requireAuth, importacionesRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
