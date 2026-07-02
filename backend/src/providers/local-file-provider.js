const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const FileProvider = require("./file-provider");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Lee el Excel desde una ruta local (hoy: la carpeta compartida donde
 * logistica guarda CARGUES_BODEGA.xlsm). Antes de leerlo hace una copia
 * temporal, asi que si el archivo esta abierto en Excel en ese instante no
 * hay conflicto de lectura. Si la copia falla (archivo bloqueado por el SO),
 * reintenta con espera entre intentos.
 */
class LocalFileProvider extends FileProvider {
  constructor({ sourcePath, retryAttempts = 3, retryDelayMs = 5000 }) {
    super();
    this.sourcePath = sourcePath;
    this.retryAttempts = Math.max(1, retryAttempts);
    this.retryDelayMs = retryDelayMs;
  }

  async getFile() {
    if (!this.sourcePath) {
      throw new Error("EXCEL_FILE_PATH no esta configurado");
    }

    const extension = path.extname(this.sourcePath) || ".xlsm";
    let lastError;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt += 1) {
      const tempPath = path.join(
        os.tmpdir(),
        `vehiamb-import-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${extension}`
      );

      try {
        await fs.copyFile(this.sourcePath, tempPath);
        return {
          path: tempPath,
          cleanup: () => fs.unlink(tempPath).catch(() => {})
        };
      } catch (error) {
        lastError = error;
        console.warn(
          `[LocalFileProvider] intento ${attempt}/${this.retryAttempts} fallo al copiar "${this.sourcePath}": ${error.message}`
        );

        if (attempt < this.retryAttempts) {
          await wait(this.retryDelayMs);
        }
      }
    }

    throw new Error(
      `No fue posible leer el archivo Excel tras ${this.retryAttempts} intentos (¿esta bloqueado o la ruta es incorrecta?): ${lastError.message}`
    );
  }
}

module.exports = LocalFileProvider;
