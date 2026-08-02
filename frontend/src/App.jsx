import React from "react";
import AuthPage from "./components/auth/AuthPage";
import TravelAssistant from "./components/TravelAssistant";
import PolicyConsentPage from "./components/auth/PolicyConsentPage";
import { useAuth } from "./hooks/useAuth";

function App() {
  const {
    user,
    login,
    signup,
    verifyEmail,
    forgotPassword,
    resetPassword,
    acceptPolicies,
    resendVerification,
    logout,
    isCheckingAuth,
    authError,
    authNotice,
    authConfig,
    clearAuthError,
    clearAuthNotice,
  } = useAuth();

  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#171817] text-[#bfc1bb]">
        <div className="rounded-xl border border-[#3a3c3a] bg-[#222422] px-6 py-5 shadow-lg shadow-black/20">
          <p className="text-sm font-medium text-[#e4e5e0]">Loading ATLAS...</p>
          <p className="mt-1 text-xs text-[#7f817c]">Checking your session</p>
        </div>
      </div>
    );
  }

  const fragmentParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const token = fragmentParams.get("token");
  const authMode = window.location.pathname.includes("reset-password")
    ? "reset"
    : window.location.pathname.includes("verify-email")
      ? "verify"
      : null;

  if (!user || authMode) {
    return (
      <AuthPage
        onLogin={login}
        onSignup={signup}
        onVerifyEmail={verifyEmail}
        onForgotPassword={forgotPassword}
        onResetPassword={resetPassword}
        initialMode={authMode || "login"}
        actionToken={token}
        initialError={authError}
        initialNotice={authNotice}
        onClearInitialError={clearAuthError}
        onClearInitialNotice={clearAuthNotice}
        publicPreview={authConfig.publicPreview}
        passwordRecoveryEnabled={authConfig.passwordRecoveryEnabled}
      />
    );
  }

  if (!user.privacyAccepted) {
    return <PolicyConsentPage onAccept={acceptPolicies} onLogout={logout} />;
  }

  return <TravelAssistant user={user} onLogout={logout} onResendVerification={resendVerification} />;
}

export default App;
