import { useCallback, useEffect, useState } from "react";
import { authAPI } from "../services/api";

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [authConfig, setAuthConfig] = useState({
    publicPreview: false,
    emailVerificationRequired: true,
    passwordRecoveryEnabled: false,
  });

  const clearSession = useCallback(() => {
    authAPI.clearLocalSession();
    setUser(null);
  }, []);


  useEffect(() => {
    const handleSessionExpired = () => {
      clearSession();
      setAuthNotice("");
      setAuthError("Your session expired. Please sign in again.");
      if (!window.location.pathname.includes("reset-password") && !window.location.pathname.includes("verify-email")) {
        window.history.replaceState({}, "", "/");
      }
    };

    window.addEventListener("atlas:session-expired", handleSessionExpired);
    return () => window.removeEventListener("atlas:session-expired", handleSessionExpired);
  }, [clearSession]);

  useEffect(() => {
    let mounted = true;

    Promise.allSettled([authAPI.config(), authAPI.restoreSession()])
      .then(([configResult, sessionResult]) => {
        if (!mounted) return;
        if (configResult.status === "fulfilled") setAuthConfig(configResult.value);
        if (sessionResult.status === "fulfilled") setUser(sessionResult.value.user);
        else clearSession();
      })
      .finally(() => {
        if (mounted) setIsCheckingAuth(false);
      });

    return () => {
      mounted = false;
    };
  }, [clearSession]);

  const login = async (payload) => {
    setAuthError("");
    setAuthNotice("");
    const data = await authAPI.login(payload);
    setUser(data.user);
    if (data.user?.publicPreview) {
      setAuthNotice("ATLAS public preview access is enabled.");
    } else if (data.emailVerificationRequired) {
      setAuthNotice("Please verify your email when possible. Some production features may require verification.");
    }
    return data.user;
  };

  const signup = async (payload) => {
    setAuthError("");
    setAuthNotice("");
    const data = await authAPI.signup(payload);
    setUser(data.user);
    setAuthNotice(data.message || "Account created. Please verify your email.");
    return data.user;
  };

  const verifyEmail = async (token) => {
    setAuthError("");
    const data = await authAPI.verifyEmail(token);
    if (data.user) setUser(data.user);
    setAuthNotice(data.message || "Email verified successfully.");
    return data;
  };

  const resendVerification = async () => {
    const data = await authAPI.resendVerification();
    setAuthNotice(data.message || "Verification email sent.");
    return data;
  };

  const forgotPassword = async (email) => authAPI.forgotPassword(email);
  const resetPassword = async (payload) => authAPI.resetPassword(payload);

  const acceptPolicies = async () => {
    const data = await authAPI.acceptPolicies();
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    await authAPI.logout().catch(() => {});
    setUser(null);
    setAuthError("");
    setAuthNotice("");
  };

  return {
    user,
    login,
    signup,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
    acceptPolicies,
    logout,
    isCheckingAuth,
    authError,
    authNotice,
    authConfig,
    clearAuthError: () => setAuthError(""),
    clearAuthNotice: () => setAuthNotice(""),
  };
};
