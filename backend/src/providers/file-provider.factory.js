const env = require("../config/env");
const LocalFileProvider = require("./local-file-provider");

// Hoy solo existe "local". El dia que se agregue Google Drive, OneDrive o una
// API, se registra aqui una entrada mas (ej. "google_drive": () => new
// GoogleDriveFileProvider({...})) y se selecciona con IMPORT_SOURCE_TYPE --
// ImportService sigue sin saber nada de esto, solo usa la interfaz FileProvider.
function crearFileProvider() {
  const tipo = process.env.IMPORT_SOURCE_TYPE || "local";

  switch (tipo) {
    case "local":
      return new LocalFileProvider({
        sourcePath: env.excelFilePath,
        retryAttempts: env.excelRetryAttempts,
        retryDelayMs: env.excelRetryDelayMs
      });
    default:
      throw new Error(`IMPORT_SOURCE_TYPE "${tipo}" no esta soportado`);
  }
}

module.exports = { crearFileProvider };
