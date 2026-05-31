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
    const data = await authAPI.login(payload);
    setUser(data.user);
    return data.user;
  };

  const signup = async (payload) => {
    setAuthError("");
    const data = await authAPI.signup(payload);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    clearSession();
    setAuthError("");
  };

  return {
    user,
    login,
    signup,
    logout,
    isCheckingAuth,
    authError,
    clearAuthError: () => setAuthError(""),
  };
};
