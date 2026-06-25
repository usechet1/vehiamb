const authService = require("../services/auth.service");

exports.login = async (req, res) => {
  const result = await authService.login(req.body);
  res.json(result);
};

exports.getMe = async (req, res) => {
  res.json({ user: req.user });
};
