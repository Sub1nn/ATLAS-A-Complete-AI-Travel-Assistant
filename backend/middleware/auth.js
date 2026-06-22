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
    const user = await User.findById(payload.userId).select("_id name email emailVerified preferences tokenVersion legalAcceptance dataRetentionDays deletionPending");

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (Number(payload.tokenVersion ?? -1) !== Number(user.tokenVersion || 0)) {
      return res.status(401).json({ message: "Session is no longer valid" });
    }

    if (user.deletionPending) {
      return res.status(423).json({ message: "Account deletion is in progress", code: "ACCOUNT_DELETION_PENDING" });
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

export function requireCurrentPolicies(req, res, next) {
  const expectedPrivacy = process.env.PRIVACY_POLICY_VERSION || "2026-06-22";
  const expectedTerms = process.env.TERMS_VERSION || "2026-06-22";
  if (req.user?.legalAcceptance?.privacyVersion !== expectedPrivacy || req.user?.legalAcceptance?.termsVersion !== expectedTerms) {
    return res.status(403).json({
      message: "Please review and accept the current privacy policy and terms before using this feature.",
      code: "POLICY_ACCEPTANCE_REQUIRED",
    });
  }
  return next();
}
