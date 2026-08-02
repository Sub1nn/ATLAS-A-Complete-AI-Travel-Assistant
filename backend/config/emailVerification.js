export const EMAIL_VERIFICATION_REQUIRED = "required";
export const EMAIL_VERIFICATION_OPTIONAL = "optional";

export const SUPPORTED_EMAIL_VERIFICATION_MODES = new Set([
  EMAIL_VERIFICATION_REQUIRED,
  EMAIL_VERIFICATION_OPTIONAL,
]);

export function selectedEmailVerificationMode() {
  return String(process.env.EMAIL_VERIFICATION_MODE || EMAIL_VERIFICATION_REQUIRED)
    .trim()
    .toLowerCase();
}

export function isEmailVerificationRequired() {
  return selectedEmailVerificationMode() === EMAIL_VERIFICATION_REQUIRED;
}

export function isPublicPreviewEnabled() {
  return selectedEmailVerificationMode() === EMAIL_VERIFICATION_OPTIONAL;
}

export function isPasswordRecoveryEnabled() {
  return !/^(0|false|no|off)$/i.test(String(process.env.PASSWORD_RECOVERY_ENABLED ?? "true").trim());
}

export function publicAuthConfiguration() {
  return {
    publicPreview: isPublicPreviewEnabled(),
    emailVerificationRequired: isEmailVerificationRequired(),
    passwordRecoveryEnabled: isPasswordRecoveryEnabled(),
  };
}
