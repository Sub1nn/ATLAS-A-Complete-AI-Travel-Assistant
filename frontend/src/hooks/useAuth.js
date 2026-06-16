import { useCallback, useEffect, useState } from "react";
import { authAPI } from "../services/api";

const readStoredSession = () => {
  const token = localStorage.getItem("atlas_token");

  if (!token) {
    localStorage.removeItem("atlas_user");
    return { token: null, user: null };
  }

  try {
    const user = JSON.parse(localStorage.getItem("atlas_user") || "null");
    return { token, user };
  } catch {
    localStorage.removeItem("atlas_user");
    return { token, user: null };
  }
};

export const useAuth = () => {
  const stored = readStoredSession();
  const [user, setUser] = useState(stored.user);
  const [isCheckingAuth, setIsCheckingAuth] = useState(Boolean(stored.token));
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");

  const clearSession = useCallback(() => {
    authAPI.logout();
    setUser(null);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("atlas_token");

    if (!token) {
      setIsCheckingAuth(false);
      setUser(null);
      return;
    }

    let mounted = true;

    authAPI
      .me()
      .then((data) => {
        if (mounted) setUser(data.user);
      })
      .catch(() => {
        if (mounted) {
          clearSession();
          setAuthError("Your session expired. Please sign in again.");
        }
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
    if (data.emailVerificationRequired) {
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

  const logout = () => {
    clearSession();
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
    logout,
    isCheckingAuth,
    authError,
    authNotice,
    clearAuthError: () => setAuthError(""),
    clearAuthNotice: () => setAuthNotice(""),
  };
};
