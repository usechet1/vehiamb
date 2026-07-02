const env = require("../config/env");
const LocalFileProvider = require("./local-file-provider");

// Hoy solo existe "local". El dia que se agregue Google Drive, OneDrive o una
// API, se registra aqui una entrada mas (ej. "google_drive": () => new
// GoogleDriveFileProvider({...})) y se selecciona con IMPORT_SOURCE_TYPE --
// ImportService sigue sin saber nada de esto, solo usa la interfaz FileProvider.
//
// "config" es opcional para no romper a los llamadores existentes (gastos
// vehiculares): si no se pasa, usa las env vars de ese pipeline. Otros
// pipelines de importacion (ej. stock de repuestos) pasan su propia
// configuracion explicita para reusar el mismo factory con un archivo/origen
// distinto.
function crearFileProvider(config) {
  const tipo = config?.tipo || process.env.IMPORT_SOURCE_TYPE || "local";
  const sourcePath = config?.sourcePath ?? env.excelFilePath;
  const retryAttempts = config?.retryAttempts ?? env.excelRetryAttempts;
  const retryDelayMs = config?.retryDelayMs ?? env.excelRetryDelayMs;

  switch (tipo) {
    case "local":
      return new LocalFileProvider({ sourcePath, retryAttempts, retryDelayMs });
    default:
      throw new Error(`IMPORT_SOURCE_TYPE "${tipo}" no esta soportado`);
  }
}

module.exports = { crearFileProvider };
