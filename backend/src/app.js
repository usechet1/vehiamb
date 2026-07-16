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
const costosRoutes = require("./routes/costos.routes");
const repuestosRoutes = require("./routes/repuestos.routes");
const stockImportacionesRoutes = require("./routes/stock-importaciones.routes");
const configImportRoutes = require("./routes/config-import.routes");
const simitRoutes = require("./routes/simit.routes");
const inspeccionesRoutes = require("./routes/inspecciones.routes");
const viajesRoutes = require("./routes/viajes.routes");
const empresasRoutes = require("./routes/empresas.routes");
const { apiLimiter } = require("./middlewares/rate-limit");

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: "1mb" }));
app.use("/api", apiLimiter);
// nosniff evita que el navegador reinterprete un archivo por su contenido
// real si el Content-Type declarado no coincide -- mitigacion adicional a la
// validacion de magic bytes en validate-upload.js. No se fuerza
// Content-Disposition: attachment aqui porque romperia el "Ver adjunto" que
// abre PDFs/fotos inline en pestana nueva (documentos.js, mantenimientos.js).
app.use(
  "/uploads",
  express.static(path.resolve(__dirname, "..", "uploads"), {
    setHeaders(res) {
      res.setHeader("X-Content-Type-Options", "nosniff");
    }
  })
);

const frontendDir = path.resolve(__dirname, "..", "..", "frontend");
app.use(express.static(frontendDir));

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
app.use("/api/costos", requireAuth, costosRoutes);
app.use("/api/repuestos", requireAuth, repuestosRoutes);
app.use("/api/stock-importaciones", requireAuth, stockImportacionesRoutes);
app.use("/api/config-import", requireAuth, configImportRoutes);
app.use("/api/simit", requireAuth, simitRoutes);
app.use("/api/inspecciones", requireAuth, inspeccionesRoutes);
app.use("/api/viajes", requireAuth, viajesRoutes);
app.use("/api/empresas", requireAuth, empresasRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
