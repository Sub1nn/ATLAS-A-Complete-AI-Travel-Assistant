import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getJwtSecret, createRandomToken, hashToken } from "../utils/security.js";
import { User } from "../models/User.js";
import {
  authLoginSchema,
  authSignupSchema,
  emailOnlySchema,
  preferencesSchema,
  resetPasswordSchema,
  tokenSchema,
  validate,
} from "../utils/validation.js";
import { emailService } from "../services/emailService.js";

const signToken = (user) => {
  const secret = getJwtSecret();
  return jwt.sign({
    userId: user._id.toString(),
    email: user.email,
    tokenVersion: Number(user.tokenVersion || 0),
  }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

const safeUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  emailVerified: Boolean(user.emailVerified),
  preferences: user.preferences || {},
});

const MAX_FAILED_LOGINS = Number(process.env.AUTH_MAX_FAILED_LOGINS || 5);
const LOCK_MINUTES = Number(process.env.AUTH_LOCK_MINUTES || 15);
let dummyPasswordHashPromise;

function dummyPasswordHash() {
  if (!dummyPasswordHashPromise) dummyPasswordHashPromise = bcrypt.hash(createRandomToken(32), 12);
  return dummyPasswordHashPromise;
}

function emailDeliveryMessage(delivery, successMessage, failedMessage) {
  if (delivery?.sent) return successMessage;
  if (process.env.NODE_ENV === "production") return failedMessage;
  return `${failedMessage} In local development, configure RESEND_API_KEY or use the console email fallback.`;
}

function isLocked(user) {
  return user.lockedUntil && user.lockedUntil > new Date();
}

async function recordFailedLogin(user) {
  user.failedLoginAttempts = Number(user.failedLoginAttempts || 0) + 1;
  if (user.failedLoginAttempts >= MAX_FAILED_LOGINS) {
    user.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
  }
  await user.save();
}

async function clearFailedLoginState(user) {
  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  user.lastLoginAt = new Date();
  await user.save();
}

async function issueVerification(user) {
  const token = createRandomToken(32);
  user.emailVerificationTokenHash = hashToken(token);
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();
  const delivery = await emailService.sendVerificationEmail(user, token);
  return { token, delivery };
}

export const authController = {
  async signup(req, res) {
    const parsed = validate(authSignupSchema, req.body || {});
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const { name, email, password } = parsed.data;

    const existing = await User.findOne({ email }).select("+passwordHash");
    if (existing) return res.status(409).json({ message: "An account with this email already exists" });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });
    const verification = await issueVerification(user);

    res.status(201).json({
      user: safeUser(user),
      token: signToken(user),
      emailVerificationRequired: true,
      emailDelivery: verification.delivery.sent ? "sent" : "failed",
      message: emailDeliveryMessage(
        verification.delivery,
        "Account created. Please verify your email from the link we sent.",
        "Account created, but the verification email could not be sent. Use the resend verification option after checking email configuration.",
      ),
    });
  },

  async login(req, res) {
    const parsed = validate(authLoginSchema, req.body || {});
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const { email, password } = parsed.data;

    const user = await User.findOne({ email }).select("+passwordHash +failedLoginAttempts +lockedUntil");
    if (!user) {
      await bcrypt.compare(password, await dummyPasswordHash());
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (isLocked(user)) {
      return res.status(423).json({ message: "This account is temporarily locked after repeated failed login attempts. Please try again later or reset your password." });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      await recordFailedLogin(user);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    await clearFailedLoginState(user);

    res.json({
      user: safeUser(user),
      token: signToken(user),
      emailVerificationRequired: !user.emailVerified,
    });
  },

  async me(req, res) {
    res.json({ user: safeUser(req.user) });
  },

  async verifyEmail(req, res) {
    const parsed = validate(tokenSchema, req.body || {});
    if (parsed.error) return res.status(400).json({ message: parsed.error });

    const tokenHash = hashToken(parsed.data.token);
    const user = await User.findOne({
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpires: { $gt: new Date() },
    }).select("+emailVerificationTokenHash +emailVerificationExpires");

    if (!user) return res.status(400).json({ message: "Verification link is invalid or expired" });

    const wasAlreadyVerified = Boolean(user.emailVerified);

    if (!wasAlreadyVerified) {
      user.emailVerified = true;
      user.emailVerifiedAt = new Date();
      user.emailVerificationTokenHash = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();
    }

    res.json({
      message: wasAlreadyVerified
        ? "Email is already verified. You can sign in to ATLAS."
        : "Email verified successfully. You can sign in to ATLAS.",
      user: safeUser(user),
      token: signToken(user),
    });
  },

  async resendVerification(req, res) {
    if (req.user.emailVerified) return res.json({ message: "Email is already verified" });
    const verification = await issueVerification(req.user);
    if (!verification.delivery.sent) {
      return res.status(502).json({
        message: "Verification email could not be sent right now. Please try again later or check email service configuration.",
        emailDelivery: "failed",
      });
    }

    res.json({
      message: "Verification email sent",
      emailDelivery: "sent",
    });
  },

  async forgotPassword(req, res) {
    const parsed = validate(emailOnlySchema, req.body || {});
    if (parsed.error) return res.status(400).json({ message: parsed.error });

    const user = await User.findOne({ email: parsed.data.email }).select("+passwordResetTokenHash +passwordResetExpires");
    if (user) {
      const token = createRandomToken(32);
      user.passwordResetTokenHash = hashToken(token);
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();
      await emailService.sendPasswordResetEmail(user, token);
    }

    res.json({ message: "If that email exists, a password reset link has been sent." });
  },

  async resetPassword(req, res) {
    const parsed = validate(resetPasswordSchema, req.body || {});
    if (parsed.error) return res.status(400).json({ message: parsed.error });

    const user = await User.findOne({
      passwordResetTokenHash: hashToken(parsed.data.token),
      passwordResetExpires: { $gt: new Date() },
    }).select("+passwordHash +passwordResetTokenHash +passwordResetExpires");

    if (!user) return res.status(400).json({ message: "Reset link is invalid or expired" });

    user.passwordHash = await bcrypt.hash(parsed.data.password, 12);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    user.tokenVersion = Number(user.tokenVersion || 0) + 1;
    await user.save();

    res.json({ message: "Password reset successfully" });
  },

  async updatePreferences(req, res) {
    const parsed = validate(preferencesSchema, req.body || {});
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    req.user.preferences = parsed.data;
    await req.user.save();
    res.json({ user: safeUser(req.user) });
  },
};
