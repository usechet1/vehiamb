const db = require("../database/query");

// Gasto vehicular "neto de IVA": el usuario pidio restar 19% al valor de
// cada factura (valor_factura ya incluye IVA) antes de sacar metricas sobre
// facturacion. Es una resta directa (bruto * 0.81), no una extraccion
// contable de IVA (que seria bruto / 1.19) -- asi se pidio explicitamente.
const FACTOR_NETO_IVA = 0.81;

// "CLIENTE" es una entrada sintetica (no existe en la tabla vehiculos): agrupa
// todas las facturas donde estado_vehiculo = 'cliente'. Para el resto, la
// identidad es placa_original normalizada (mayusculas, sin guion): el Excel
// importado siempre trae la placa con guion ("WOO-375") mientras el catalogo
// de vehiculos la guarda sin guion ("WOO375") -- sin esta normalizacion cada
// vehiculo aparecia duplicado (una entrada con el gasto real bajo la placa
// con guion, y otra en cero bajo la placa del catalogo sin guion).
const PLACA_EXPR = "(CASE WHEN f.estado_vehiculo = 'cliente' THEN 'CLIENTE' ELSE UPPER(REPLACE(f.placa_original, '-', '')) END)";

function normalizarPlaca(placa) {
  return String(placa || "").toUpperCase().replace(/-/g, "");
}

function whereVehiculo(placa, empresaId) {
  if (placa === "CLIENTE") {
    return { clause: "f.estado_vehiculo = 'cliente' AND f.empresa_id = ?", values: [empresaId] };
  }
  return {
    clause: "f.estado_vehiculo != 'cliente' AND UPPER(REPLACE(f.placa_original, '-', '')) = ? AND f.empresa_id = ?",
    values: [normalizarPlaca(placa), empresaId]
  };
}

// El dashboard de costos se basa en Fecha de Envio (cuando la factura llega
// a bodega), no en Fecha_factura (cuando se emitio) -- son fechas distintas
// en el Excel y el negocio quiere ver el gasto agrupado por la primera.
const FECHA_FILTRO = "f.fecha_envio";

/**
 * Universo completo de "vehiculos" del dashboard: todo lo que esta en el
 * catalogo de vehiculos + cualquier placa_original que haya facturado alguna
 * vez (cubre tambien las "sin_asignar", que no estan en el catalogo pero si
 * tienen costo real) + la entrada sintetica CLIENTE. Se listan aunque no
 * tengan actividad en el periodo seleccionado (apareceran en cero).
 */
async function aggregarPorVehiculo(desde, hasta, empresaId) {
  return db.all(
    `
      WITH universo AS (
        SELECT UPPER(REPLACE(placa, '-', '')) AS placa FROM vehiculos WHERE empresa_id = ?
        UNION
        SELECT DISTINCT UPPER(REPLACE(placa_original, '-', '')) FROM facturas_vehiculares
        WHERE estado_vehiculo != 'cliente' AND placa_original IS NOT NULL AND placa_original <> '' AND empresa_id = ?
        UNION
        SELECT 'CLIENTE'
      ),
      gastos_por_factura AS (
        SELECT factura_id, SUM(valor) AS gasto_total
        FROM gastos_operativos
        WHERE unidad = 'COP' AND empresa_id = ?
        GROUP BY factura_id
      ),
      periodo AS (
        SELECT
          ${PLACA_EXPR} AS placa,
          COUNT(DISTINCT f.id) AS num_facturas,
          COALESCE(SUM(g.gasto_total), 0) AS total_gastado,
          COALESCE(SUM(f.valor_factura), 0) AS total_facturado_bruto,
          COALESCE(MAX(g.gasto_total), 0) AS gasto_mas_alto
        FROM facturas_vehiculares f
        LEFT JOIN gastos_por_factura g ON g.factura_id = f.id
        WHERE ${FECHA_FILTRO} BETWEEN ? AND ? AND f.empresa_id = ?
        GROUP BY ${PLACA_EXPR}
      )
      SELECT
        u.placa,
        COALESCE(p.num_facturas, 0) AS num_facturas,
        COALESCE(p.total_gastado, 0) AS total_gastado,
        COALESCE(p.total_facturado_bruto, 0) AS total_facturado_bruto,
        COALESCE(p.gasto_mas_alto, 0) AS gasto_mas_alto
      FROM universo u
      LEFT JOIN periodo p ON p.placa = u.placa
      ORDER BY total_gastado DESC, u.placa ASC
    `,
    [empresaId, empresaId, empresaId, desde, hasta, empresaId]
  );
}

async function kpisVehiculo(placa, desde, hasta, empresaId) {
  const { clause, values } = whereVehiculo(placa, empresaId);

  return db.get(
    `
      WITH gastos_por_factura AS (
        SELECT
          factura_id,
          SUM(CASE WHEN tipo_gasto = 'combustible_pesos' THEN valor ELSE 0 END) AS combustible_pesos,
          SUM(CASE WHEN tipo_gasto = 'combustible_galones' THEN valor ELSE 0 END) AS combustible_galones,
          SUM(CASE WHEN tipo_gasto = 'almuerzos' THEN valor ELSE 0 END) AS almuerzos,
          SUM(CASE WHEN tipo_gasto = 'peajes' THEN valor ELSE 0 END) AS peajes,
          SUM(CASE WHEN tipo_gasto = 'parqueaderos' THEN valor ELSE 0 END) AS parqueaderos,
          SUM(CASE WHEN unidad = 'COP' THEN valor ELSE 0 END) AS gasto_total
        FROM gastos_operativos
        WHERE empresa_id = ?
        GROUP BY factura_id
      )
      SELECT
        COUNT(DISTINCT f.id) AS num_facturas,
        COALESCE(SUM(g.gasto_total), 0) AS total_gastado,
        COALESCE(SUM(g.combustible_pesos), 0) AS total_combustible,
        COALESCE(SUM(g.combustible_galones), 0) AS total_galones,
        COALESCE(SUM(g.almuerzos), 0) AS total_almuerzos,
        COALESCE(SUM(g.peajes), 0) AS total_peajes,
        COALESCE(SUM(g.parqueaderos), 0) AS total_parqueaderos,
        COALESCE(SUM(f.valor_factura), 0) AS total_facturado_bruto
      FROM facturas_vehiculares f
      LEFT JOIN gastos_por_factura g ON g.factura_id = f.id
      WHERE ${clause} AND ${FECHA_FILTRO} BETWEEN ? AND ?
    `,
    [empresaId, ...values, desde, hasta]
  );
}

async function evolucionDiaria(placa, desde, hasta, empresaId) {
  const { clause, values } = whereVehiculo(placa, empresaId);

  return db.all(
    `
      WITH gastos_por_factura AS (
        SELECT
          factura_id,
          SUM(CASE WHEN unidad = 'COP' THEN valor ELSE 0 END) AS gasto_total,
          SUM(CASE WHEN tipo_gasto = 'combustible_galones' THEN valor ELSE 0 END) AS galones
        FROM gastos_operativos
        WHERE empresa_id = ?
        GROUP BY factura_id
      )
      SELECT
        ${FECHA_FILTRO} AS fecha,
        COALESCE(SUM(g.gasto_total), 0) AS gasto_total,
        COALESCE(SUM(g.galones), 0) AS galones
      FROM facturas_vehiculares f
      LEFT JOIN gastos_por_factura g ON g.factura_id = f.id
      WHERE ${clause} AND ${FECHA_FILTRO} BETWEEN ? AND ?
      GROUP BY ${FECHA_FILTRO}
      ORDER BY ${FECHA_FILTRO} ASC
    `,
    [empresaId, ...values, desde, hasta]
  );
}

async function desglosePorTipo(placa, desde, hasta, empresaId) {
  const { clause, values } = whereVehiculo(placa, empresaId);

  return db.all(
    `
      SELECT g.tipo_gasto, COALESCE(SUM(g.valor), 0) AS total
      FROM gastos_operativos g
      INNER JOIN facturas_vehiculares f ON f.id = g.factura_id
      WHERE ${clause} AND ${FECHA_FILTRO} BETWEEN ? AND ? AND g.unidad = 'COP'
      GROUP BY g.tipo_gasto
    `,
    [...values, desde, hasta]
  );
}

async function desglosePorTipoDiario(placa, desde, hasta, empresaId) {
  const { clause, values } = whereVehiculo(placa, empresaId);

  return db.all(
    `
      SELECT ${FECHA_FILTRO} AS fecha, g.tipo_gasto, COALESCE(SUM(g.valor), 0) AS total
      FROM gastos_operativos g
      INNER JOIN facturas_vehiculares f ON f.id = g.factura_id
      WHERE ${clause} AND ${FECHA_FILTRO} BETWEEN ? AND ? AND g.unidad = 'COP'
      GROUP BY ${FECHA_FILTRO}, g.tipo_gasto
      ORDER BY ${FECHA_FILTRO} ASC
    `,
    [...values, desde, hasta]
  );
}

async function topSalas(placa, desde, hasta, empresaId, limit = 10) {
  const { clause, values } = whereVehiculo(placa, empresaId);

  return db.all(
    `
      WITH gastos_por_factura AS (
        SELECT factura_id, SUM(valor) AS gasto_total
        FROM gastos_operativos
        WHERE unidad = 'COP' AND empresa_id = ?
        GROUP BY factura_id
      )
      SELECT COALESCE(NULLIF(f.sala, ''), 'Sin sala') AS sala, COALESCE(SUM(g.gasto_total), 0) AS total
      FROM facturas_vehiculares f
      LEFT JOIN gastos_por_factura g ON g.factura_id = f.id
      WHERE ${clause} AND ${FECHA_FILTRO} BETWEEN ? AND ?
      GROUP BY COALESCE(NULLIF(f.sala, ''), 'Sin sala')
      ORDER BY total DESC
      LIMIT ?
    `,
    [empresaId, ...values, desde, hasta, limit]
  );
}

// Columnas ordenables expuestas por la API -> columna/alias SQL real. Blindado
// contra inyeccion: cualquier orderBy que no este en este mapa cae al default.
const ORDER_COLUMNS = {
  numero_factura: "f.numero_factura",
  fecha_factura: "f.fecha_factura",
  fecha_envio: "f.fecha_envio",
  sala: "f.sala",
  placa: PLACA_EXPR,
  peso_kg: "f.peso_kg",
  valor_factura: "f.valor_factura",
  combustible: "combustible",
  galones: "galones",
  almuerzos: "almuerzos",
  peajes: "peajes",
  parqueaderos: "parqueaderos",
  total_gasto: "total_gasto"
};

async function listarFacturas(placa, { desde, hasta, page, limit, search, orderBy, dir }, empresaId) {
  const { clause, values } = whereVehiculo(placa, empresaId);
  const conditions = [clause, `${FECHA_FILTRO} BETWEEN ? AND ?`];
  const params = [...values, desde, hasta];

  if (search) {
    conditions.push("f.numero_factura ILIKE ?");
    params.push(`%${search}%`);
  }

  const whereClause = conditions.join(" AND ");
  const orderColumn = ORDER_COLUMNS[orderBy] || ORDER_COLUMNS.fecha_factura;
  const direction = dir === "asc" ? "ASC" : "DESC";
  const offset = (Math.max(1, page) - 1) * limit;

  const rowsPromise = db.all(
    `
      SELECT
        f.id,
        f.numero_factura,
        f.fecha_factura,
        f.fecha_envio,
        f.sala,
        f.peso_kg,
        f.valor_factura,
        f.observaciones,
        f.conductor_id,
        f.conductor_nombre,
        MAX(c.nombres) AS conductor_nombres,
        MAX(c.apellidos) AS conductor_apellidos,
        COALESCE(SUM(CASE WHEN g.tipo_gasto = 'combustible_pesos' THEN g.valor END), 0) AS combustible,
        COALESCE(SUM(CASE WHEN g.tipo_gasto = 'combustible_galones' THEN g.valor END), 0) AS galones,
        COALESCE(SUM(CASE WHEN g.tipo_gasto = 'almuerzos' THEN g.valor END), 0) AS almuerzos,
        COALESCE(SUM(CASE WHEN g.tipo_gasto = 'peajes' THEN g.valor END), 0) AS peajes,
        COALESCE(SUM(CASE WHEN g.tipo_gasto = 'parqueaderos' THEN g.valor END), 0) AS parqueaderos,
        COALESCE(SUM(CASE WHEN g.unidad = 'COP' THEN g.valor END), 0) AS total_gasto
      FROM facturas_vehiculares f
      LEFT JOIN gastos_operativos g ON g.factura_id = f.id
      LEFT JOIN conductores c ON c.id = f.conductor_id
      WHERE ${whereClause}
      GROUP BY f.id
      ORDER BY ${orderColumn} ${direction}
      LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  const totalPromise = db.get(
    `SELECT COUNT(*) AS total FROM facturas_vehiculares f WHERE ${whereClause}`,
    params
  );

  const [rows, totalRow] = await Promise.all([rowsPromise, totalPromise]);

  return { rows, total: Number(totalRow?.total || 0) };
}

// ── Gasto por conductor ──────────────────────────────────────────
//
// Identidad de conductor ("conductorKey"): "C<id>" cuando la factura esta
// vinculada a un conductor real (facturas_vehiculares.conductor_id, ver
// gasto-conductor-matcher.js), "N:<texto>" cuando solo hay el texto libre del
// Excel sin match, o el bucket "SIN_IDENTIFICAR" cuando no hay ningun dato de
// conductor en la factura.
const CONDUCTOR_EXPR = `
  (CASE
    WHEN f.conductor_id IS NOT NULL THEN 'C' || f.conductor_id
    WHEN f.conductor_nombre IS NOT NULL AND f.conductor_nombre <> '' THEN 'N:' || UPPER(f.conductor_nombre)
    ELSE 'SIN_IDENTIFICAR'
  END)
`;

function whereConductor(conductorKey, empresaId) {
  if (conductorKey === "SIN_IDENTIFICAR") {
    return {
      clause: "f.conductor_id IS NULL AND (f.conductor_nombre IS NULL OR f.conductor_nombre = '') AND f.empresa_id = ?",
      values: [empresaId]
    };
  }

  if (conductorKey && conductorKey.startsWith("C")) {
    return { clause: "f.conductor_id = ? AND f.empresa_id = ?", values: [conductorKey.slice(1), empresaId] };
  }

  if (conductorKey && conductorKey.startsWith("N:")) {
    return {
      clause: "f.conductor_id IS NULL AND UPPER(f.conductor_nombre) = ? AND f.empresa_id = ?",
      values: [conductorKey.slice(2), empresaId]
    };
  }

  // conductorKey desconocido/vacio: clausula que no matchea ninguna fila.
  return { clause: "1 = 0", values: [] };
}

/**
 * Universo completo de conductores del dashboard: todo el catalogo de
 * conductores + cualquier conductor_nombre visto en facturas sin match + el
 * bucket SIN_IDENTIFICAR. Se listan aunque no tengan actividad en el periodo
 * (apareceran en cero), igual que aggregarPorVehiculo.
 */
async function aggregarPorConductor(desde, hasta, empresaId) {
  return db.all(
    `
      WITH universo AS (
        SELECT 'C' || c.id AS conductor_key, TRIM(COALESCE(c.apellidos, '') || ' ' || COALESCE(c.nombres, '')) AS conductor_label
        FROM conductores c
        WHERE c.empresa_id = ?
        UNION
        SELECT DISTINCT 'N:' || UPPER(f.conductor_nombre), f.conductor_nombre
        FROM facturas_vehiculares f
        WHERE f.conductor_id IS NULL AND f.conductor_nombre IS NOT NULL AND f.conductor_nombre <> '' AND f.empresa_id = ?
        UNION
        SELECT 'SIN_IDENTIFICAR', 'Sin identificar'
      ),
      gastos_por_factura AS (
        SELECT factura_id, SUM(valor) AS gasto_total
        FROM gastos_operativos
        WHERE unidad = 'COP' AND empresa_id = ?
        GROUP BY factura_id
      ),
      periodo AS (
        SELECT
          ${CONDUCTOR_EXPR} AS conductor_key,
          COUNT(DISTINCT f.id) AS num_facturas,
          COALESCE(SUM(g.gasto_total), 0) AS total_gastado,
          COALESCE(SUM(f.valor_factura), 0) AS total_facturado_bruto,
          COALESCE(MAX(g.gasto_total), 0) AS gasto_mas_alto
        FROM facturas_vehiculares f
        LEFT JOIN gastos_por_factura g ON g.factura_id = f.id
        WHERE ${FECHA_FILTRO} BETWEEN ? AND ? AND f.empresa_id = ?
        GROUP BY ${CONDUCTOR_EXPR}
      )
      SELECT
        u.conductor_key,
        u.conductor_label,
        COALESCE(p.num_facturas, 0) AS num_facturas,
        COALESCE(p.total_gastado, 0) AS total_gastado,
        COALESCE(p.total_facturado_bruto, 0) AS total_facturado_bruto,
        COALESCE(p.gasto_mas_alto, 0) AS gasto_mas_alto
      FROM universo u
      LEFT JOIN periodo p ON p.conductor_key = u.conductor_key
      ORDER BY total_gastado DESC, u.conductor_label ASC
    `,
    [empresaId, empresaId, empresaId, desde, hasta, empresaId]
  );
}

async function kpisConductor(conductorKey, desde, hasta, empresaId) {
  const { clause, values } = whereConductor(conductorKey, empresaId);

  return db.get(
    `
      WITH gastos_por_factura AS (
        SELECT
          factura_id,
          SUM(CASE WHEN tipo_gasto = 'combustible_pesos' THEN valor ELSE 0 END) AS combustible_pesos,
          SUM(CASE WHEN tipo_gasto = 'combustible_galones' THEN valor ELSE 0 END) AS combustible_galones,
          SUM(CASE WHEN tipo_gasto = 'almuerzos' THEN valor ELSE 0 END) AS almuerzos,
          SUM(CASE WHEN tipo_gasto = 'peajes' THEN valor ELSE 0 END) AS peajes,
          SUM(CASE WHEN tipo_gasto = 'parqueaderos' THEN valor ELSE 0 END) AS parqueaderos,
          SUM(CASE WHEN unidad = 'COP' THEN valor ELSE 0 END) AS gasto_total
        FROM gastos_operativos
        WHERE empresa_id = ?
        GROUP BY factura_id
      )
      SELECT
        COUNT(DISTINCT f.id) AS num_facturas,
        COALESCE(SUM(g.gasto_total), 0) AS total_gastado,
        COALESCE(SUM(g.combustible_pesos), 0) AS total_combustible,
        COALESCE(SUM(g.combustible_galones), 0) AS total_galones,
        COALESCE(SUM(g.almuerzos), 0) AS total_almuerzos,
        COALESCE(SUM(g.peajes), 0) AS total_peajes,
        COALESCE(SUM(g.parqueaderos), 0) AS total_parqueaderos,
        COALESCE(SUM(f.valor_factura), 0) AS total_facturado_bruto
      FROM facturas_vehiculares f
      LEFT JOIN gastos_por_factura g ON g.factura_id = f.id
      WHERE ${clause} AND ${FECHA_FILTRO} BETWEEN ? AND ?
    `,
    [empresaId, ...values, desde, hasta]
  );
}

async function evolucionDiariaConductor(conductorKey, desde, hasta, empresaId) {
  const { clause, values } = whereConductor(conductorKey, empresaId);

  return db.all(
    `
      WITH gastos_por_factura AS (
        SELECT
          factura_id,
          SUM(CASE WHEN unidad = 'COP' THEN valor ELSE 0 END) AS gasto_total,
          SUM(CASE WHEN tipo_gasto = 'combustible_galones' THEN valor ELSE 0 END) AS galones
        FROM gastos_operativos
        WHERE empresa_id = ?
        GROUP BY factura_id
      )
      SELECT
        ${FECHA_FILTRO} AS fecha,
        COALESCE(SUM(g.gasto_total), 0) AS gasto_total,
        COALESCE(SUM(g.galones), 0) AS galones
      FROM facturas_vehiculares f
      LEFT JOIN gastos_por_factura g ON g.factura_id = f.id
      WHERE ${clause} AND ${FECHA_FILTRO} BETWEEN ? AND ?
      GROUP BY ${FECHA_FILTRO}
      ORDER BY ${FECHA_FILTRO} ASC
    `,
    [empresaId, ...values, desde, hasta]
  );
}

async function desglosePorTipoConductor(conductorKey, desde, hasta, empresaId) {
  const { clause, values } = whereConductor(conductorKey, empresaId);

  return db.all(
    `
      SELECT g.tipo_gasto, COALESCE(SUM(g.valor), 0) AS total
      FROM gastos_operativos g
      INNER JOIN facturas_vehiculares f ON f.id = g.factura_id
      WHERE ${clause} AND ${FECHA_FILTRO} BETWEEN ? AND ? AND g.unidad = 'COP'
      GROUP BY g.tipo_gasto
    `,
    [...values, desde, hasta]
  );
}

async function desglosePorTipoDiarioConductor(conductorKey, desde, hasta, empresaId) {
  const { clause, values } = whereConductor(conductorKey, empresaId);

  return db.all(
    `
      SELECT ${FECHA_FILTRO} AS fecha, g.tipo_gasto, COALESCE(SUM(g.valor), 0) AS total
      FROM gastos_operativos g
      INNER JOIN facturas_vehiculares f ON f.id = g.factura_id
      WHERE ${clause} AND ${FECHA_FILTRO} BETWEEN ? AND ? AND g.unidad = 'COP'
      GROUP BY ${FECHA_FILTRO}, g.tipo_gasto
      ORDER BY ${FECHA_FILTRO} ASC
    `,
    [...values, desde, hasta]
  );
}

async function topVehiculosConductor(conductorKey, desde, hasta, empresaId, limit = 10) {
  const { clause, values } = whereConductor(conductorKey, empresaId);

  return db.all(
    `
      WITH gastos_por_factura AS (
        SELECT factura_id, SUM(valor) AS gasto_total
        FROM gastos_operativos
        WHERE unidad = 'COP' AND empresa_id = ?
        GROUP BY factura_id
      )
      SELECT ${PLACA_EXPR} AS placa, COALESCE(SUM(g.gasto_total), 0) AS total
      FROM facturas_vehiculares f
      LEFT JOIN gastos_por_factura g ON g.factura_id = f.id
      WHERE ${clause} AND ${FECHA_FILTRO} BETWEEN ? AND ?
      GROUP BY ${PLACA_EXPR}
      ORDER BY total DESC
      LIMIT ?
    `,
    [empresaId, ...values, desde, hasta, limit]
  );
}

async function listarFacturasConductor(conductorKey, { desde, hasta, page, limit, search, orderBy, dir }, empresaId) {
  const { clause, values } = whereConductor(conductorKey, empresaId);
  const conditions = [clause, `${FECHA_FILTRO} BETWEEN ? AND ?`];
  const params = [...values, desde, hasta];

  if (search) {
    conditions.push("f.numero_factura ILIKE ?");
    params.push(`%${search}%`);
  }

  const whereClause = conditions.join(" AND ");
  const orderColumn = ORDER_COLUMNS[orderBy] || ORDER_COLUMNS.fecha_factura;
  const direction = dir === "asc" ? "ASC" : "DESC";
  const offset = (Math.max(1, page) - 1) * limit;

  const rowsPromise = db.all(
    `
      SELECT
        f.id,
        f.numero_factura,
        f.fecha_factura,
        f.fecha_envio,
        ${PLACA_EXPR} AS placa,
        f.sala,
        f.peso_kg,
        f.valor_factura,
        f.observaciones,
        COALESCE(SUM(CASE WHEN g.tipo_gasto = 'combustible_pesos' THEN g.valor END), 0) AS combustible,
        COALESCE(SUM(CASE WHEN g.tipo_gasto = 'combustible_galones' THEN g.valor END), 0) AS galones,
        COALESCE(SUM(CASE WHEN g.tipo_gasto = 'almuerzos' THEN g.valor END), 0) AS almuerzos,
        COALESCE(SUM(CASE WHEN g.tipo_gasto = 'peajes' THEN g.valor END), 0) AS peajes,
        COALESCE(SUM(CASE WHEN g.tipo_gasto = 'parqueaderos' THEN g.valor END), 0) AS parqueaderos,
        COALESCE(SUM(CASE WHEN g.unidad = 'COP' THEN g.valor END), 0) AS total_gasto
      FROM facturas_vehiculares f
      LEFT JOIN gastos_operativos g ON g.factura_id = f.id
      WHERE ${whereClause}
      GROUP BY f.id
      ORDER BY ${orderColumn} ${direction}
      LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  const totalPromise = db.get(
    `SELECT COUNT(*) AS total FROM facturas_vehiculares f WHERE ${whereClause}`,
    params
  );

  const [rows, totalRow] = await Promise.all([rowsPromise, totalPromise]);

  return { rows, total: Number(totalRow?.total || 0) };
}

module.exports = {
  FACTOR_NETO_IVA,
  aggregarPorVehiculo,
  kpisVehiculo,
  evolucionDiaria,
  desglosePorTipo,
  desglosePorTipoDiario,
  topSalas,
  listarFacturas,
  aggregarPorConductor,
  kpisConductor,
  evolucionDiariaConductor,
  desglosePorTipoConductor,
  desglosePorTipoDiarioConductor,
  topVehiculosConductor,
  listarFacturasConductor
};
