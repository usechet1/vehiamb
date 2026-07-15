// Aprovisiona una empresa (tenant) nueva + su primer usuario Administrador.
// No hay panel ni endpoint HTTP para esto a proposito: las empresas las da
// de alta unicamente el dueno de la app, corriendo este script dentro del
// contenedor del backend (mismo contenedor, mismas variables de entorno que
// ya usa el servidor, asi que reutiliza toda la logica/validacion existente
// en vez de duplicarla).
//
// Uso:
//   docker exec vehiamb-backend node scripts/create-empresa.js \
//     --nombre "Transportes Acme" \
//     --admin-nombre "Ana Admin" \
//     --admin-email admin@acme.com \
//     --admin-password "ClaveSegura123*" \
//     [--slug transportes-acme]

const db = require("../src/database/query");
const empresasService = require("../src/services/empresas.service");
const usuariosService = require("../src/services/usuarios.service");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const actual = argv[i];
    if (!actual.startsWith("--")) continue;
    const clave = actual.slice(2);
    const valor = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : "";
    args[clave] = valor;
    if (valor) i += 1;
  }
  return args;
}

function generarPasswordAleatoria() {
  return Math.random().toString(36).slice(-10) + "A1*";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const nombre = args["nombre"];
  const adminNombre = args["admin-nombre"];
  const adminEmail = args["admin-email"];
  const adminPassword = args["admin-password"] || generarPasswordAleatoria();
  const slug = args["slug"];

  if (!nombre || !adminNombre || !adminEmail) {
    console.error(
      "Uso: node scripts/create-empresa.js --nombre \"Empresa X\" --admin-nombre \"Nombre Admin\" --admin-email admin@empresa.com [--admin-password Clave123*] [--slug empresa-x]"
    );
    process.exitCode = 1;
    return;
  }

  const empresa = await empresasService.createEmpresa({ nombre, slug });

  const adminRole = await db.get("SELECT id FROM roles WHERE nombre = ?", ["Administrador"]);
  if (!adminRole) {
    throw new Error('No existe el rol "Administrador" en la base de datos');
  }

  const usuario = await usuariosService.createUser(
    {
      nombre: adminNombre,
      email: adminEmail,
      password: adminPassword,
      role_id: adminRole.id
    },
    empresa.id
  );

  console.log("Empresa creada:");
  console.log(`  id: ${empresa.id}`);
  console.log(`  nombre: ${empresa.nombre}`);
  console.log(`  slug: ${empresa.slug}`);
  console.log("");
  console.log("Usuario administrador creado:");
  console.log(`  email: ${usuario.email}`);
  console.log(`  password: ${adminPassword}`);
  console.log("");
  console.log("Guarda la contraseña ahora: no se vuelve a mostrar.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("No se pudo crear la empresa:", error.message);
    process.exit(1);
  });
