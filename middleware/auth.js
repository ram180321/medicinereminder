import jwt from "jsonwebtoken";

export function authMiddleware(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "yourSecretKey");
    req.user = decoded; // { id, role }
    next();
  } catch (error) {
    res.status(403).json({ message: "Invalid token" });
  }
}

export function adminMiddleware(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied: Admins only" });
  }
  next();
}
