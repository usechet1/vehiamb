// Importa un lote puntual de conductores desde una lista fija (nombre
// completo, cedula, telefono). El campo de licencia se deja vacio a
// proposito -- el modelo de licencias esta por rediseñarse para soportar
// varias categorias con fecha de vencimiento por conductor. Uso:
//   node scripts/importar-conductores.js <empresa_id>
require("dotenv").config();
const db = require("../src/database/query");
const conductoresRepository = require("../src/repositories/conductores.repository");

const CONDUCTORES = [
  { nombreCompleto: "GUERRERO ROJAS SEGUNDO ANTONIO", cedula: "7184784", telefono: "3212233351" },
  { nombreCompleto: "ECHEVERRIA CORREDOR OLMER SENIN", cedula: "7188002", telefono: "3024589797" },
  { nombreCompleto: "HERNANDEZ ROJAS JOSE DEL CARMEN", cedula: "4046749", telefono: "3004948919" },
  { nombreCompleto: "ARCE RAMIREZ JUAN CARLOS", cedula: "1099213173", telefono: "3132200085" },
  { nombreCompleto: "GARCIA NIÑO JOSE EFRAIN", cedula: "1051240833", telefono: "3118019311" },
  { nombreCompleto: "WILCHES LOPEZ EDGAR ALBERTO", cedula: "1049624084", telefono: "3106292614" },
  { nombreCompleto: "BURGOS ECHEVERRIA YUBER ALBERTO", cedula: "7166882", telefono: "3144824579" },
  { nombreCompleto: "GONZALEZ RESTREPO DAVID", cedula: "1121883407", telefono: "3232300699" },
  { nombreCompleto: "NEVA GUERRERO JUAN CARLOS", cedula: "1049607470", telefono: "3115531682" },
  { nombreCompleto: "RESTREPO JOYA JHON ALEXANDER", cedula: "1022959278", telefono: "3185913828" },
  { nombreCompleto: "CASTAÑEDA OSORIO REINEL", cedula: "74363240", telefono: "3133976787" },
  { nombreCompleto: "BERNAL MEDINA VICTOR HUGO", cedula: "1056075133", telefono: "3194278707" },
  { nombreCompleto: "VARGAS BORRAS SERGIO MAURICIO", cedula: "1049638947", telefono: "3118125161" },
  { nombreCompleto: "VEGA ROBLES EDWAR GUSTAVO", cedula: "1049624897", telefono: "3125892666" },
  { nombreCompleto: "URIAN AYALA JOSE EDILBERTO", cedula: "1056075422", telefono: "3156881879" },
  { nombreCompleto: "CAMARGO ACOSTA EDWIN ORLANDO", cedula: "1049622404", telefono: "3143500422" },
  { nombreCompleto: "BARAHONA HIGUA YONY ALEXANDER", cedula: "1052499768", telefono: "3332449683" },
  { nombreCompleto: "CASAS RIOS YONATAN DAVID", cedula: "1002394056", telefono: "3209515274" }
];

// Convencion colombiana en listas administrativas: las primeras dos palabras
// son los apellidos, el resto es el nombre (puede ser compuesto, ej. "JOSE
// DEL CARMEN"). Con solo 1-2 palabras en total no hay separacion posible.
function splitNombreCompleto(nombreCompleto) {
  const partes = nombreCompleto.trim().split(/\s+/).filter(Boolean);

  if (partes.length <= 2) {
    return { apellidos: partes[0] || "", nombres: partes.slice(1).join(" ") || partes[0] || "" };
  }

  return {
    apellidos: partes.slice(0, 2).join(" "),
    nombres: partes.slice(2).join(" ")
  };
}

async function main() {
  const empresaId = process.argv[2];
  if (!empresaId) {
    console.error("Uso: node scripts/importar-conductores.js <empresa_id>");
    return;
  }

  let creados = 0;
  let omitidos = 0;

  for (const item of CONDUCTORES) {
    const existente = await db.get(
      "SELECT id FROM conductores WHERE cedula = ? AND empresa_id = ?",
      [item.cedula, empresaId]
    );

    if (existente) {
      console.log(`Ya existe (cedula ${item.cedula}), se omite: ${item.nombreCompleto}`);
      omitidos += 1;
      continue;
    }

    const { nombres, apellidos } = splitNombreCompleto(item.nombreCompleto);

    await conductoresRepository.create({
      nombres,
      apellidos,
      cedula: item.cedula,
      telefono: item.telefono,
      estado: "activo",
      empresa_id: empresaId
    });

    console.log(`Creado: ${apellidos}, ${nombres} (cedula ${item.cedula})`);
    creados += 1;
  }

  console.log(`\nListo: ${creados} conductores creados, ${omitidos} omitidos (ya existian).`);
}

main()
  .catch((error) => console.error("Error:", error.message))
  .finally(() => db.close());
