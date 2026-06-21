import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { getJwtSecret } from "../utils/security.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const secret = getJwtSecret();
    const payload = jwt.verify(token, secret);
    const user = await User.findById(payload.userId).select("_id name email emailVerified preferences tokenVersion");

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (Number(payload.tokenVersion ?? -1) !== Number(user.tokenVersion || 0)) {
      return res.status(401).json({ message: "Session is no longer valid" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired session" });
  }
}

export function requireVerifiedEmail(req, res, next) {
  if (!req.user?.emailVerified) {
    return res.status(403).json({
      message: "Please verify your email before using chat or document features.",
      code: "EMAIL_VERIFICATION_REQUIRED",
    });
  }
  return next();
}
