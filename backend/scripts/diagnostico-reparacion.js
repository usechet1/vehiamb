// Diagnostico de "N dias en reparacion" (vehiculos.estado_desde): muestra si
// la columna existe, cada vehiculo en reparacion con su fecha de inicio y sus
// mantenimientos, y por que no tiene fecha si es el caso. Solo lectura. Uso,
// desde C:\vehiamb\backend:
//   node scripts/diagnostico-reparacion.js
require("dotenv").config();
const db = require("../src/database/query");

async function main() {
  const columna = await db.get(
    "SELECT 1 AS existe FROM information_schema.columns WHERE table_name = 'vehiculos' AND column_name = 'estado_desde'"
  );
  if (!columna) {
    console.log("FALTA la columna vehiculos.estado_desde: el backend no se ha reiniciado con el codigo nuevo");
    console.log("(o su arranque fallo antes de crearla -- revisa logs\\backend.log).");
    return;
  }
  console.log("OK: existe la columna vehiculos.estado_desde.\n");

  const vehiculos = await db.all(`
    SELECT id, placa, estado,
           to_char(estado_desde AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI') AS estado_desde,
           (CURRENT_DATE - (estado_desde AT TIME ZONE 'America/Bogota')::date) AS dias
    FROM vehiculos
    WHERE estado = 'reparacion'
    ORDER BY placa
  `);

  if (!vehiculos.length) {
    console.log("No hay vehiculos en estado 'reparacion'.");
    return;
  }

  for (const vehiculo of vehiculos) {
    const mantenimientos = await db.all(
      `SELECT id, to_char(fecha, 'YYYY-MM-DD') AS fecha, tipo, estado
       FROM mantenimientos WHERE vehiculo_id = ? ORDER BY fecha DESC LIMIT 5`,
      [vehiculo.id]
    );

    console.log(`${vehiculo.placa}: ${vehiculo.estado_desde
      ? `en reparacion desde ${vehiculo.estado_desde} -> ${vehiculo.dias} dias`
      : "SIN fecha de inicio (estado_desde vacio)"}`);

    if (!mantenimientos.length) {
      console.log("   No tiene ningun mantenimiento registrado: no hay de donde sacar la fecha.");
    } else {
      mantenimientos.forEach((mantenimiento) => {
        console.log(`   mantenimiento #${mantenimiento.id}  ${mantenimiento.fecha}  ${mantenimiento.tipo}  (${mantenimiento.estado})`);
      });
      if (!vehiculo.estado_desde) {
        console.log("   Tiene mantenimientos pero sigue sin fecha: el relleno del arranque no ha corrido con el codigo nuevo.");
      }
    }
    console.log("");
  }
}

// Mismo cierre que los demas scripts: cerrar el pool antes de salir evita el
// crash de Node en Windows al cerrar handles a la fuerza.
main()
  .catch((error) => console.error("Error:", error.message))
  .finally(() => db.close());
