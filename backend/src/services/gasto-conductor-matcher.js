// Cruza el "Conductor" en texto libre que trae el Excel de cargues
// (facturas_vehiculares.conductor_nombre) contra el catalogo de conductores
// de la empresa, para poblar conductor_id automaticamente. A diferencia del
// matcher de SIMIT (comparendo-conductor-matcher.js) aqui no hay mascara: el
// nombre viene completo, pero tampoco hay cedula para desambiguar, asi que
// el criterio es mas estricto -- el conjunto de palabras debe calzar EXACTO
// (mismo numero de palabras, cada una presente) contra nombres+apellidos del
// conductor, sin asumir el orden (el Excel puede traer "Nombres Apellidos" o
// "Apellidos Nombres"). Solo se vincula si hay un unico candidato: ante
// ambiguedad se prefiere dejar conductor_id en null antes que atribuir mal un
// gasto a la persona equivocada.

const DIACRITICOS_REGEX = new RegExp("[\u0300-\u036f]", "g");

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

function mismoConjuntoDePalabras(tokensA, tokensB) {
  if (!tokensA.length || tokensA.length !== tokensB.length) return false;

  const disponibles = [...tokensB];
  for (const token of tokensA) {
    const indice = disponibles.indexOf(token);
    if (indice === -1) return false;
    disponibles.splice(indice, 1);
  }

  return true;
}

/**
 * Devuelve el conductor unico cuyo nombre completo (nombres + apellidos)
 * coincide, palabra por palabra, con el texto libre del Excel; o null si no
 * hay texto, no hay match, o hay mas de un candidato igual de valido.
 */
function encontrarConductorPorNombre(nombreExcel, conductores) {
  const tokensExcel = tokens(nombreExcel);
  if (!tokensExcel.length) return null;

  const candidatos = conductores.filter((conductor) => {
    const tokensConductor = tokens(`${conductor.nombres} ${conductor.apellidos}`);
    return mismoConjuntoDePalabras(tokensExcel, tokensConductor);
  });

  return candidatos.length === 1 ? candidatos[0] : null;
}

module.exports = { encontrarConductorPorNombre };
