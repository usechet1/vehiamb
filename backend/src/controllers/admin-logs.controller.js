const adminLogsService = require("../services/admin-logs.service");

function parsePage(query) {
  return {
    page: Math.max(1, Number.parseInt(query.page, 10) || 1),
    limit: Math.min(200, Math.max(1, Number.parseInt(query.limit, 10) || 20))
  };
}

exports.getAccesos = async (req, res) => {
  const { page, limit } = parsePage(req.query);
  const resultado = await adminLogsService.listAccesos(
    { page, limit, resultado: req.query.resultado, desde: req.query.desde, hasta: req.query.hasta, search: req.query.search },
    req.empresaId
  );
  res.json(resultado);
};

exports.getRegistro = async (req, res) => {
  const { page, limit } = parsePage(req.query);
  const resultado = await adminLogsService.listRegistro(
    { page, limit, evento: req.query.evento, desde: req.query.desde, hasta: req.query.hasta, search: req.query.search },
    req.empresaId
  );
  res.json(resultado);
};

exports.getErrores = async (req, res) => {
  const { page, limit } = parsePage(req.query);
  const resultado = await adminLogsService.listErrores(
    {
      page,
      limit,
      status_code: req.query.status_code ? Number(req.query.status_code) : undefined,
      desde: req.query.desde,
      hasta: req.query.hasta,
      search: req.query.search
    },
    req.empresaId
  );
  res.json(resultado);
};

exports.getNotificaciones = async (req, res) => {
  const { page, limit } = parsePage(req.query);
  const resultado = await adminLogsService.listNotificaciones(
    {
      page,
      limit,
      categoria: req.query.categoria,
      prioridad: req.query.prioridad,
      estado: req.query.estado,
      desde: req.query.desde,
      hasta: req.query.hasta,
      search: req.query.search
    },
    req.empresaId
  );
  res.json(resultado);
};

exports.getMetricas = async (req, res) => {
  const metricas = await adminLogsService.getMetricas(
    { desde: req.query.desde, hasta: req.query.hasta },
    { empresaId: req.empresaId, permisos: req.user?.permisos || [] }
  );
  res.json(metricas);
};
