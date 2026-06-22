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
    clearAuthError,
    clearAuthNotice,
  } = useAuth();

  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 px-6 py-5 shadow-2xl shadow-black/30">
          <p className="text-sm font-medium text-slate-200">Loading ATLAS...</p>
          <p className="mt-1 text-xs text-slate-500">Checking your session</p>
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
      />
    );
  }

  if (!user.privacyAccepted) {
    return <PolicyConsentPage onAccept={acceptPolicies} onLogout={logout} />;
  }

  return <TravelAssistant user={user} onLogout={logout} onResendVerification={resendVerification} />;
}

export default App;
