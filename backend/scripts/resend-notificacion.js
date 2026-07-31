// Reenvia por WhatsApp una notificacion ya existente (no crea una nueva) --
// util para probar cambios en el formato del mensaje sin esperar a que se
// dispare una novedad real. Uso:
//   node scripts/resend-notificacion.js <id>
//   node scripts/resend-notificacion.js            (toma la mas reciente de SIMIT)
require("dotenv").config();
const db = require("../src/database/query");
// Pasa por el service (no llama directo al canal) para reusar el mismo
// completado de detalle_comparendos que ya tiene el boton "Reenviar por
// WhatsApp" de la app -- asi las notificaciones de SIMIT viejas (creadas
// antes de guardar ese detalle) tambien salen con fecha/descripcion.
const notificacionesService = require("../src/services/notificaciones.service");

async function main() {
  const id = process.argv[2];

  const row = id
    ? await db.get("SELECT * FROM notificaciones WHERE id = ?", [id])
    : await db.get(
        `SELECT * FROM notificaciones
         WHERE tipo IN ('simit_multa_detectada', 'simit_estado_cambiado')
         ORDER BY fecha_creacion DESC
         LIMIT 1`
      );

  if (!row) {
    console.error(id ? `No existe la notificacion ${id}.` : "No hay notificaciones de SIMIT registradas.");
    process.exit(1);
  }

  console.log(`Reenviando notificacion #${row.id} (${row.tipo}):`, row.mensaje);
  await notificacionesService.reenviarPorWhatsapp(row.id, { id: row.usuario_id, empresa_id: row.empresa_id });
  console.log("Listo -- revisa el WhatsApp del usuario destino.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error.message);
    process.exit(1);
  });
