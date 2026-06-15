import axios from "axios";

function appBaseUrl() {
  return (process.env.APP_BASE_URL || process.env.CORS_ORIGIN || "http://localhost:5173").split(",")[0].trim().replace(/\/$/, "");
}

function fromAddress() {
  return process.env.EMAIL_FROM || process.env.EMAIL_USER || "ATLAS <no-reply@atlas.local>";
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
  console.log("\n📧 Development email");
  console.log("To:", to);
  console.log("Subject:", subject);
  console.log(text);
  console.log("📧 End development email\n");
  return true;
}

export const emailService = {
  verificationLink(token) {
    return `${appBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  },

  resetLink(token) {
    return `${appBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  },

  async sendMail(payload) {
    try {
      if (await sendWithResend(payload)) return { sent: true, provider: "resend" };
      if (await sendWithConsole(payload)) return { sent: true, provider: "console" };
      return { sent: false, provider: "none" };
    } catch (error) {
      console.warn("⚠️ Email delivery failed:", error.response?.data || error.message);
      return { sent: false, provider: "error", error: error.message };
    }
  },

  async sendVerificationEmail(user, token) {
    const link = this.verificationLink(token);
    return this.sendMail({
      to: user.email,
      subject: "Verify your ATLAS account",
      text: `Hi ${user.name},\n\nVerify your ATLAS account using this link:\n${link}\n\nThis link expires in 24 hours.`,
      html: `<p>Hi ${user.name},</p><p>Verify your ATLAS account using this link:</p><p><a href="${link}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
    });
  },

  async sendPasswordResetEmail(user, token) {
    const link = this.resetLink(token);
    return this.sendMail({
      to: user.email,
      subject: "Reset your ATLAS password",
      text: `Hi ${user.name},\n\nReset your ATLAS password using this link:\n${link}\n\nThis link expires in 1 hour. If you did not request this, ignore this email.`,
      html: `<p>Hi ${user.name},</p><p>Reset your ATLAS password using this link:</p><p><a href="${link}">Reset password</a></p><p>This link expires in 1 hour. If you did not request this, ignore this email.</p>`,
    });
  },
};
