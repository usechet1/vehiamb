/**
 * Interfaz para obtener el archivo Excel de origen. Cualquier fuente nueva
 * (Google Drive, OneDrive, una API) se agrega como una clase que extiende
 * esta y expone getFile() -- ImportService nunca sabe de donde viene el
 * archivo, solo pide una copia local temporal ya lista para leer.
 */
class FileProvider {
  /**
   * @returns {Promise<{ path: string, cleanup: () => Promise<void> }>}
   *   path: ruta local a una copia temporal del archivo, segura para leer
   *   cleanup: borra esa copia temporal cuando ya no se necesita
   */
  async getFile() {
    throw new Error("FileProvider.getFile() debe ser implementado por la subclase");
  }
}

module.exports = FileProvider;
