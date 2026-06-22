import axios from "axios";
import { logger } from "../utils/logger.js";

function appBaseUrl() {
  return (process.env.APP_BASE_URL || process.env.CORS_ORIGIN || "http://localhost:5173").split(",")[0].trim().replace(/\/$/, "");
}

function fromAddress() {
  return process.env.EMAIL_FROM || process.env.EMAIL_USER || "ATLAS <no-reply@atlas.local>";
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendWithResend({ to, subject, html, text }) {
  if (!process.env.RESEND_API_KEY) return false;

  await axios.post(
    "https://api.resend.com/emails",
    {
      from: fromAddress(),
      to: [to],
      subject,
      html,
      text,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    },
  );

  return true;
}

async function sendWithConsole({ to, subject, text }) {
  if (process.env.NODE_ENV === "production") return false;
  logger.debug("Development email generated", { to, subject, text });
  return true;
}

export const emailService = {
  verificationLink(token) {
    return `${appBaseUrl()}/verify-email#token=${encodeURIComponent(token)}`;
  },

  resetLink(token) {
    return `${appBaseUrl()}/reset-password#token=${encodeURIComponent(token)}`;
  },

  async sendMail(payload) {
    try {
      if (await sendWithResend(payload)) return { sent: true, provider: "resend" };
      if (await sendWithConsole(payload)) return { sent: true, provider: "console" };
      return { sent: false, provider: "none" };
    } catch (error) {
      logger.warn("Email delivery failed", { reason: error.message });
      return { sent: false, provider: "error", error: error.message };
    }
  },

  async sendVerificationEmail(user, token) {
    const link = this.verificationLink(token);
    const safeName = escapeHtml(user.name);
    const safeLink = escapeHtml(link);
    return this.sendMail({
      to: user.email,
      subject: "Verify your ATLAS account",
      text: `Hi ${user.name},\n\nVerify your ATLAS account using this link:\n${link}\n\nThis link expires in 24 hours.`,
      html: `<p>Hi ${safeName},</p><p>Verify your ATLAS account using this link:</p><p><a href="${safeLink}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
    });
  },

  async sendPasswordResetEmail(user, token) {
    const link = this.resetLink(token);
    const safeName = escapeHtml(user.name);
    const safeLink = escapeHtml(link);
    return this.sendMail({
      to: user.email,
      subject: "Reset your ATLAS password",
      text: `Hi ${user.name},\n\nReset your ATLAS password using this link:\n${link}\n\nThis link expires in 1 hour. If you did not request this, ignore this email.`,
      html: `<p>Hi ${safeName},</p><p>Reset your ATLAS password using this link:</p><p><a href="${safeLink}">Reset password</a></p><p>This link expires in 1 hour. If you did not request this, ignore this email.</p>`,
    });
  },

  async sendAccountDeletionUpdate(email, completed, trackingToken = "") {
    const statusUrl = trackingToken ? `${appBaseUrl()}/account-deletion-status.html#token=${encodeURIComponent(trackingToken)}` : "";
    return this.sendMail({
      to: email,
      subject: completed ? "Your ATLAS account was deleted" : "ATLAS account deletion needs attention",
      text: completed
        ? `Your ATLAS account and associated data were deleted. ${statusUrl ? `Status receipt: ${statusUrl}` : ""}`
        : `ATLAS could not complete your account deletion automatically. The operation is retained for administrative retry. ${statusUrl ? `Status: ${statusUrl}` : ""}`,
      html: completed
        ? `<p>Your ATLAS account and associated data were deleted.</p>${statusUrl ? `<p><a href="${escapeHtml(statusUrl)}">View deletion receipt</a></p>` : ""}`
        : `<p>ATLAS could not complete your account deletion automatically. The operation has been flagged for administrative retry.</p>${statusUrl ? `<p><a href="${escapeHtml(statusUrl)}">View deletion status</a></p>` : ""}`,
    });
  },

  async sendAccountDeletionRequested(email, trackingToken) {
    const statusUrl = `${appBaseUrl()}/account-deletion-status.html#token=${encodeURIComponent(trackingToken)}`;
    return this.sendMail({
      to: email,
      subject: "Your ATLAS account deletion was requested",
      text: `Your account deletion is being processed. Keep this private status link until deletion completes: ${statusUrl}`,
      html: `<p>Your ATLAS account deletion is being processed.</p><p>Keep this private link until deletion completes: <a href="${escapeHtml(statusUrl)}">View deletion status</a></p>`,
    });
  },
};
