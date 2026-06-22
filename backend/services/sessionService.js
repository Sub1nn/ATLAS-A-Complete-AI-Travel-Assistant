import crypto from "crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Session } from "../models/Session.js";
import { User } from "../models/User.js";
import { createRandomToken, getJwtSecret, hashToken } from "../utils/security.js";

const COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || "atlas_refresh";
const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || "atlas_csrf";
const REFRESH_DAYS = Math.max(1, Math.min(Number(process.env.REFRESH_TOKEN_DAYS || 30), 90));

function parseCookies(header = "") {
  return String(header || "").split(";").reduce((cookies, item) => {
    const separator = item.indexOf("=");
    if (separator < 1) return cookies;
    const key = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function cookieOptions() {
  const secure = process.env.NODE_ENV === "production";
  const configured = String(process.env.REFRESH_COOKIE_SAME_SITE || (secure ? "lax" : "lax")).toLowerCase();
  const requestedSameSite = ["strict", "lax", "none"].includes(configured) ? configured : "lax";
  const sameSite = requestedSameSite === "none" && !secure ? "lax" : requestedSameSite;
  return {
    httpOnly: true,
    secure,
    sameSite,
    path: "/api/auth",
    maxAge: REFRESH_DAYS * 24 * 60 * 60 * 1000,
  };
}

function csrfCookieOptions() {
  const { httpOnly, maxAge, ...options } = cookieOptions();
  return { ...options, httpOnly: false, maxAge };
}

function safeEqual(left = "", right = "") {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function issueCsrf(res) {
  const token = createRandomToken(32);
  res.cookie(CSRF_COOKIE_NAME, token, csrfCookieOptions());
  res.locals.csrfToken = token;
  return token;
}

export function requireCsrf(req, res, next) {
  const cookieToken = parseCookies(req.headers.cookie || "")[CSRF_COOKIE_NAME] || "";
  const headerToken = req.headers["x-csrf-token"] || "";
  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    return res.status(403).json({ message: "CSRF validation failed", code: "CSRF_VALIDATION_FAILED" });
  }
  return next();
}

function signAccessToken(user) {
  return jwt.sign({
    userId: user._id.toString(),
    email: user.email,
    tokenVersion: Number(user.tokenVersion || 0),
  }, getJwtSecret(), { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m" });
}

function refreshTokenFromRequest(req) {
  return parseCookies(req.headers.cookie || "")[COOKIE_NAME] || "";
}

async function createSessionRecord(user, mongoSession = null) {
  const refreshToken = createRandomToken(48);
  const record = new Session({
    userId: user._id,
    refreshTokenHash: hashToken(refreshToken),
    tokenVersion: Number(user.tokenVersion || 0),
    expiresAt: new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000),
  });
  await record.save(mongoSession ? { session: mongoSession } : undefined);
  return refreshToken;
}

function setSessionCookies(res, refreshToken) {
  res.cookie(COOKIE_NAME, refreshToken, cookieOptions());
  issueCsrf(res);
}

async function createSession(user, res) {
  const refreshToken = await createSessionRecord(user);
  setSessionCookies(res, refreshToken);
  return signAccessToken(user);
}

async function handleUnclaimedRotation(tokenHash, now, res) {
  const existing = await Session.findOne({ refreshTokenHash: tokenHash }).select("+refreshTokenHash");
  if (!existing) return null;
  const graceMs = Math.max(1000, Number(process.env.REFRESH_REUSE_GRACE_MS || 10000));
  const rotatedRecently = existing.revokedReason === "rotated" && existing.revokedAt && Date.now() - existing.revokedAt.getTime() <= graceMs;
  if (rotatedRecently) return { retry: true };
  if (existing.revokedReason === "logout" || existing.expiresAt <= now) return null;
  await Session.deleteMany({ userId: existing.userId });
  await User.updateOne({ _id: existing.userId }, { $inc: { tokenVersion: 1 } });
  clearCookie(res);
  return null;
}

async function rotate(req, res) {
  const refreshToken = refreshTokenFromRequest(req);
  if (!refreshToken) return null;
  const tokenHash = hashToken(refreshToken);
  const now = new Date();
  let claimedSession;
  let user;
  let replacementRefreshToken;
  const rotateWithin = async (mongoSession = null) => {
    const options = { new: true, ...(mongoSession ? { session: mongoSession } : {}) };
    claimedSession = await Session.findOneAndUpdate(
      { refreshTokenHash: tokenHash, revokedAt: null, expiresAt: { $gt: now } },
      { $set: { revokedAt: now, revokedReason: "rotated", lastUsedAt: now } },
      options,
    ).select("+refreshTokenHash");
    if (!claimedSession) return;
    const userQuery = User.findById(claimedSession.userId);
    if (mongoSession) userQuery.session(mongoSession);
    user = await userQuery;
    if (!user || user.deletionPending || Number(claimedSession.tokenVersion) !== Number(user.tokenVersion || 0)) {
      claimedSession.revokedReason = "security";
      await claimedSession.save(mongoSession ? { session: mongoSession } : undefined);
      user = null;
      return;
    }
    replacementRefreshToken = await createSessionRecord(user, mongoSession);
  };

  if (process.env.MONGODB_TRANSACTIONS === "true") {
    const mongoSession = await mongoose.startSession();
    try {
      await mongoSession.withTransaction(() => rotateWithin(mongoSession));
    } finally {
      await mongoSession.endSession();
    }
  } else {
    await rotateWithin();
  }

  if (!claimedSession) return handleUnclaimedRotation(tokenHash, now, res);
  if (!user || !replacementRefreshToken) {
    clearCookie(res);
    return null;
  }

  setSessionCookies(res, replacementRefreshToken);
  const token = signAccessToken(user);
  return { token, user, csrfToken: res.locals.csrfToken };
}

async function revokeCurrent(req, res) {
  const refreshToken = refreshTokenFromRequest(req);
  if (refreshToken) {
    await Session.updateOne(
      { refreshTokenHash: hashToken(refreshToken), revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: "logout" } },
    );
  }
  clearCookie(res);
}

function clearCookie(res) {
  const { maxAge, ...options } = cookieOptions();
  res.clearCookie(COOKIE_NAME, options);
  const { maxAge: csrfMaxAge, ...csrfOptions } = csrfCookieOptions();
  res.clearCookie(CSRF_COOKIE_NAME, csrfOptions);
}

export const sessionService = {
  createSession,
  rotate,
  revokeCurrent,
  clearCookie,
  revokeAllForUser: (userId) => Session.deleteMany({ userId }),
  signAccessToken,
  issueCsrf,
  _test: { parseCookies, cookieOptions, csrfCookieOptions, safeEqual },
};
