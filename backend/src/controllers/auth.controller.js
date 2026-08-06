const authService = require("../services/auth.service");

exports.login = async (req, res) => {
  const result = await authService.login(req.body, { ip: req.ip, userAgent: req.headers["user-agent"] });
  res.json(result);
};

exports.getMe = async (req, res) => {
  res.json({ user: req.user });
};

exports.cambiarPassword = async (req, res) => {
  const user = await authService.cambiarPassword(req.user.id, req.body);
  res.json({ user });
};

exports.olvidePassword = async (req, res) => {
  await authService.solicitarRecuperacionPassword(req.body.email);
  res.json({ message: "Si el correo existe en la plataforma, te enviamos un enlace para restablecer tu contraseña." });
};

exports.restablecerPassword = async (req, res) => {
  await authService.restablecerPassword(req.body.token, req.body.password_nueva);
  res.json({ message: "Contraseña actualizada correctamente." });
};
