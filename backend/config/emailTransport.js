export const EMAIL_TRANSPORT_RESEND = "resend";
export const EMAIL_TRANSPORT_MAILTRAP_SANDBOX = "mailtrap_sandbox";

export const SUPPORTED_EMAIL_TRANSPORTS = new Set([
  EMAIL_TRANSPORT_RESEND,
  EMAIL_TRANSPORT_MAILTRAP_SANDBOX,
]);

export function selectedEmailTransport() {
  return String(process.env.EMAIL_TRANSPORT || EMAIL_TRANSPORT_RESEND).trim().toLowerCase();
}

export function mailtrapSandboxConfig() {
  return {
    host: process.env.MAILTRAP_SMTP_HOST || "sandbox.smtp.mailtrap.io",
    port: Number(process.env.MAILTRAP_SMTP_PORT || 2525),
    secure: process.env.MAILTRAP_SMTP_SECURE === "true",
    auth: {
      user: process.env.MAILTRAP_SMTP_USER || "",
      pass: process.env.MAILTRAP_SMTP_PASS || "",
    },
    pool: true,
    maxConnections: 2,
    maxMessages: 50,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 15000,
    disableFileAccess: true,
    disableUrlAccess: true,
  };
}
