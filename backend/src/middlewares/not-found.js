function notFound(req, res) {
  res.status(404).json({
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
  });
}

module.exports = notFound;
