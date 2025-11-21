import AuthService from "../../modules/auth/auth.service.js";

export function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ message: "Unauthorized" });

    const token = auth.split(" ")[1];
    const payload = AuthService.verifyToken(token);
    if (!payload) return res.status(401).json({ message: "Invalid token" });

    req.user = payload; // { id, role, iat, exp }
    next();
  } catch (err) {
    next(err);
  }
}
