// Cruza los comparendos SIMIT ya guardados (antes de que existiera el
// vinculo automatico conductor_id en consultarVehiculo) contra el catalogo
// de conductores de cada empresa. Solo vincula cuando cedula + nombre
// completo coinciden y el candidato es unico (ver
// comparendo-conductor-matcher.js) -- de ahi en adelante, las consultas SIMIT
// nuevas ya hacen este cruce solas, este script es un backfill de una sola
// vez para el historico. Uso:
//   node scripts/matchear-comparendos.js
require("dotenv").config();
const db = require("../src/database/query");
const empresasRepository = require("../src/repositories/empresas.repository");
const conductoresRepository = require("../src/repositories/conductores.repository");
const simitComparendosRepository = require("../src/repositories/simit-comparendos.repository");
const comparendoMatcher = require("../src/services/comparendo-conductor-matcher");

async function main() {
  const empresas = await empresasRepository.findAll();
  let vinculados = 0;
  let revisados = 0;

  for (const empresa of empresas) {
    const [conductores, comparendos] = await Promise.all([
      conductoresRepository.findAllParaMatching(empresa.id),
      simitComparendosRepository.findSinConductorVinculado(empresa.id)
    ]);

    if (!conductores.length || !comparendos.length) continue;

    for (const comparendo of comparendos) {
      revisados += 1;
      const conductor = comparendoMatcher.encontrarConductorCoincidente(comparendo, conductores);
      if (!conductor) continue;

      await simitComparendosRepository.actualizarConductor(comparendo.id, conductor.id, empresa.id);
      console.log(
        `Vinculado: comparendo ${comparendo.numero_comparendo} (empresa "${empresa.nombre}") -> ${conductor.apellidos}, ${conductor.nombres}`
      );
      vinculados += 1;
    }
  }

  console.log(`\nListo: ${vinculados} comparendos vinculados de ${revisados} revisados.`);
}

main()
  .catch((error) => console.error("Error:", error.message))
  .finally(() => db.close());
