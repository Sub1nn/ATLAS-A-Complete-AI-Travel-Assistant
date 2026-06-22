import bcrypt from "bcryptjs";
import { createRandomToken, hashToken } from "../utils/security.js";
import { User } from "../models/User.js";
import {
  authLoginSchema,
  authSignupSchema,
  emailOnlySchema,
  policyAcceptanceSchema,
  preferencesSchema,
  resetPasswordSchema,
  tokenSchema,
  validate,
} from "../utils/validation.js";
import { emailService } from "../services/emailService.js";
import { sessionService } from "../services/sessionService.js";

const safeUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  emailVerified: Boolean(user.emailVerified),
  preferences: user.preferences || {},
  dataRetentionDays: Number(user.dataRetentionDays || process.env.DEFAULT_DATA_RETENTION_DAYS || 365),
  privacyVersion: user.legalAcceptance?.privacyVersion || "",
  privacyAccepted: user.legalAcceptance?.privacyVersion === (process.env.PRIVACY_POLICY_VERSION || "2026-06-22")
    && user.legalAcceptance?.termsVersion === (process.env.TERMS_VERSION || "2026-06-22"),
});

const MAX_FAILED_LOGIN_DELAY_MS = Number(process.env.AUTH_MAX_FAILED_LOGIN_DELAY_MS || 2000);
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

async function recordFailedLogin(user) {
  user.failedLoginAttempts = Number(user.failedLoginAttempts || 0) + 1;
  await user.save();
  const delay = Math.min(MAX_FAILED_LOGIN_DELAY_MS, user.failedLoginAttempts * 250);
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
}

async function clearFailedLoginState(user) {
  user.failedLoginAttempts = 0;
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
    const user = await User.create({
      name,
      email,
      passwordHash,
      legalAcceptance: {
        privacyVersion: process.env.PRIVACY_POLICY_VERSION || "2026-06-22",
        termsVersion: process.env.TERMS_VERSION || "2026-06-22",
        acceptedAt: new Date(),
      },
      dataRetentionDays: Number(process.env.DEFAULT_DATA_RETENTION_DAYS || 365),
    });
    const verification = await issueVerification(user);
    const token = await sessionService.createSession(user, res);

    res.status(201).json({
      user: safeUser(user),
      token,
      csrfToken: res.locals.csrfToken,
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

    const user = await User.findOne({ email }).select("+passwordHash +failedLoginAttempts");
    if (!user) {
      await bcrypt.compare(password, await dummyPasswordHash());
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      await recordFailedLogin(user);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.deletionPending) {
      return res.status(423).json({ message: "Account deletion is in progress", code: "ACCOUNT_DELETION_PENDING" });
    }

    await clearFailedLoginState(user);
    const token = await sessionService.createSession(user, res);

    res.json({
      user: safeUser(user),
      token,
      csrfToken: res.locals.csrfToken,
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

    const token = await sessionService.createSession(user, res);
    res.json({
      message: wasAlreadyVerified
        ? "Email is already verified. You can sign in to ATLAS."
        : "Email verified successfully. You can sign in to ATLAS.",
      user: safeUser(user),
      token,
      csrfToken: res.locals.csrfToken,
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
    user.tokenVersion = Number(user.tokenVersion || 0) + 1;
    await user.save();
    await sessionService.revokeAllForUser(user._id);

    res.json({ message: "Password reset successfully" });
  },

  async updatePreferences(req, res) {
    const parsed = validate(preferencesSchema, req.body || {});
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    req.user.preferences = parsed.data;
    await req.user.save();
    res.json({ user: safeUser(req.user) });
  },

  async acceptPolicies(req, res) {
    const parsed = validate(policyAcceptanceSchema, req.body || {});
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    req.user.legalAcceptance = {
      privacyVersion: process.env.PRIVACY_POLICY_VERSION || "2026-06-22",
      termsVersion: process.env.TERMS_VERSION || "2026-06-22",
      acceptedAt: new Date(),
    };
    await req.user.save();
    res.json({ user: safeUser(req.user) });
  },

  async refresh(req, res) {
    const refreshed = await sessionService.rotate(req, res);
    if (refreshed?.retry) {
      res.setHeader("Retry-After", "1");
      return res.status(409).json({ message: "Refresh rotation is already in progress", code: "REFRESH_IN_PROGRESS" });
    }
    if (!refreshed) return res.status(401).json({ message: "Refresh session is invalid or expired" });
    res.json({ token: refreshed.token, csrfToken: refreshed.csrfToken, user: safeUser(refreshed.user) });
  },

  async csrf(req, res) {
    const csrfToken = sessionService.issueCsrf(res);
    res.json({ csrfToken });
  },

  async logout(req, res) {
    await sessionService.revokeCurrent(req, res);
    res.json({ ok: true });
  },

  async logoutAll(req, res) {
    req.user.tokenVersion = Number(req.user.tokenVersion || 0) + 1;
    await req.user.save();
    await sessionService.revokeAllForUser(req.user._id);
    sessionService.clearCookie(res);
    res.json({ ok: true });
  },
};
