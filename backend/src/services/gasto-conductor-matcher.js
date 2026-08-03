// Cruza el "Conductor" en texto libre que trae el Excel de cargues
// (facturas_vehiculares.conductor_nombre) contra el catalogo de conductores
// de la empresa, para poblar conductor_id automaticamente. A diferencia del
// matcher de SIMIT (comparendo-conductor-matcher.js) aqui no hay mascara: el
// nombre viene completo, pero tampoco hay cedula para desambiguar.
//
// El Excel suele traer una version corta del nombre (ej. "CAMARGO EDWIN"),
// mientras que el catalogo tiene nombres+apellidos completos, con segundo
// nombre/apellido (ej. "CAMARGO ACOSTA EDWIN ORLANDO") -- exigir el MISMO
// numero de palabras (como se hacia antes) dejaba estos casos sin vincular,
// duplicando al mismo conductor en el dashboard (una vez con el nombre corto
// del Excel y con datos reales, otra con el nombre completo del catalogo en
// $0). Por eso el criterio es "subconjunto": todas las palabras del lado mas
// corto deben estar presentes en el lado mas largo, sin asumir el orden (el
// Excel puede traer "Nombres Apellidos" o "Apellidos Nombres"). Se exige un
// minimo de 2 palabras para evitar que un solo apellido comun dispare un
// match por casualidad. Solo se vincula si hay un unico candidato: ante
// ambiguedad se prefiere dejar conductor_id en null antes que atribuir mal un
// gasto a la persona equivocada.

const DIACRITICOS_REGEX = new RegExp("[\u0300-\u036f]", "g");
const MIN_PALABRAS = 2;

function normalizarTexto(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(DIACRITICOS_REGEX, "")
    .toUpperCase()
    .trim();
}

function tokens(value) {
  return normalizarTexto(value).split(/\s+/).filter(Boolean);
}

function esSubconjuntoDePalabras(tokensA, tokensB) {
  if (tokensA.length < MIN_PALABRAS) return false;

  const [cortas, largas] = tokensA.length <= tokensB.length ? [tokensA, tokensB] : [tokensB, tokensA];
  if (cortas.length < MIN_PALABRAS) return false;

  const disponibles = [...largas];
  for (const token of cortas) {
    const indice = disponibles.indexOf(token);
    if (indice === -1) return false;
    disponibles.splice(indice, 1);
  }

  return true;
}

/**
 * Devuelve el conductor unico cuyo nombre completo (nombres + apellidos)
 * contiene, como subconjunto, las palabras del texto libre del Excel; o null
 * si no hay texto, no hay match, o hay mas de un candidato igual de valido.
 */
function encontrarConductorPorNombre(nombreExcel, conductores) {
  const tokensExcel = tokens(nombreExcel);
  if (!tokensExcel.length) return null;

  const candidatos = conductores.filter((conductor) => {
    const tokensConductor = tokens(`${conductor.nombres} ${conductor.apellidos}`);
    return esSubconjuntoDePalabras(tokensExcel, tokensConductor);
  });

  return candidatos.length === 1 ? candidatos[0] : null;
}

module.exports = { encontrarConductorPorNombre };
