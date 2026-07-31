// Cruza el nombre/cedula enmascarados que devuelve el portal SIMIT (ej.
// "10524*****", "YO** ALEX***** BARA**** HI***") contra el catalogo de
// conductores ya registrados en la empresa, para saber si un comparendo le
// pertenece a alguno de ellos. El match es siempre probabilistico (SIMIT
// nunca revela el dato completo), asi que solo se vincula automaticamente
// cuando AMBOS (cedula y nombre completo) coinciden Y el conductor
// candidato es unico -- si dos conductores calzan igual de bien, no se
// vincula a ninguno para no atribuirle mal una infraccion legal a alguien.

const DIACRITICOS_REGEX = new RegExp("[\u0300-\u036f]", "g");

function normalizarTexto(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(DIACRITICOS_REGEX, "")
    .toUpperCase()
    .trim();
}

// Compara caracter a caracter: donde el enmascarado tiene "*" se acepta
// cualquier caracter real, donde tiene un caracter visible debe coincidir
// exactamente. La longitud debe ser identica (SIMIT enmascara reemplazando
// caracteres, no recortando el dato).
function coincideConMascara(enmascarado, real) {
  if (!enmascarado || !real || enmascarado.length !== real.length) return false;

  for (let i = 0; i < enmascarado.length; i += 1) {
    if (enmascarado[i] === "*") continue;
    if (enmascarado[i] !== real[i]) return false;
  }

  return true;
}

function coincideCedula(cedulaEnmascarada, cedulaReal) {
  if (!cedulaEnmascarada || !cedulaReal) return false;
  return coincideConMascara(String(cedulaEnmascarada).trim(), String(cedulaReal).trim());
}

// El nombre completo enmascarado llega en un orden que no necesariamente
// coincide con como esta guardado "nombres"/"apellidos" en el conductor (SIMIT
// usa el orden "Apellidos Nombres" del documento de identidad). Se compara
// como conjunto: cada palabra enmascarada debe emparejar con una palabra real
// distinta (sin reutilizar), sin importar el orden.
function coincideNombreCompleto(nombreEnmascarado, nombreCompleto) {
  const tokens = normalizarTexto(nombreEnmascarado).split(/\s+/).filter(Boolean);
  const palabras = normalizarTexto(nombreCompleto).split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;

  const disponibles = [...palabras];
  for (const token of tokens) {
    const indice = disponibles.findIndex((palabra) => coincideConMascara(token, palabra));
    if (indice === -1) return false;
    disponibles.splice(indice, 1);
  }

  return true;
}

// Devuelve el conductor unico que calza con el comparendo, o null si no hay
// match, hay match parcial (solo cedula o solo nombre) o hay ambiguedad
// (mas de un candidato).
function encontrarConductorCoincidente(comparendo, conductores) {
  if (!comparendo?.cedula_infractor || !comparendo?.nombre_infractor) return null;

  const candidatos = conductores.filter((conductor) => {
    const cedulaOk = coincideCedula(comparendo.cedula_infractor, conductor.cedula);
    if (!cedulaOk) return false;
    return coincideNombreCompleto(comparendo.nombre_infractor, `${conductor.apellidos} ${conductor.nombres}`);
  });

  return candidatos.length === 1 ? candidatos[0] : null;
}

module.exports = {
  coincideCedula,
  coincideNombreCompleto,
  encontrarConductorCoincidente
};
