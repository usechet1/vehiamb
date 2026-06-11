const app = require("./src/app");
const env = require("./src/config/env");
const db = require("./src/database/query");

const server = app.listen(env.port, () => {
  console.log(`Servidor corriendo en puerto ${env.port}`);
});

function shutdown(signal) {
  console.log(`Recibida señal ${signal}. Cerrando servidor...`);

  server.close(() => {
    db.close(() => {
      console.log("Servidor cerrado correctamente");
      process.exit(0);
    });
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
