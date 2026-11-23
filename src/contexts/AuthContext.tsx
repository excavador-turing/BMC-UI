import axios from "axios";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

import { ApiBaseContext } from "@/contexts/ApiBaseContext";
import { revokeAndClear } from "@/lib/api/logout";

export interface AuthContext {
  isAuthenticated: boolean;
  token: string | null;
  login: (username: string, token: string, rememberMe: boolean) => void;
  /** Revoke the token on the board, then clear the session. */
  logout: () => void;
  /**
   * Clear the session without asking the board: for a 401, where the board
   * has already dropped the token (it expired, or the password changed).
   */
  clearSession: () => void;
}

export const AuthContext = createContext<AuthContext | null>(null);

function getStoredToken() {
  return localStorage.getItem("token") ?? sessionStorage.getItem("token");
}

function setStoredToken(token: string | null, rememberMe: boolean) {
  if (token) {
    if (rememberMe) {
      localStorage.setItem("token", token);
    } else {
      sessionStorage.setItem("token", token);
    }
  } else {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
  }
}

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!token);

  const { base } = useContext(ApiBaseContext);

  const clearSession = useCallback(() => {
    setStoredToken(null, false);
    setToken(null);
    setIsAuthenticated(false);

    // Redirect to the login page
    // BASE_URL, not "/": this bundle is also served under a sub-path -- the
    // site's demo lives at /demo/fork/ -- and an absolute "/login" there walks
    // out of the application entirely.
    window.location.href = `${import.meta.env.BASE_URL}login`.replace(
      /\/{2,}/g,
      "/"
    );
  }, []);

  const logout = useCallback(() => {
    void revokeAndClear(
      token,
      base,
      (url, config) => axios.post(url, undefined, config),
      clearSession
    );
  }, [token, base, clearSession]);

  const login = useCallback(
    (username: string, token: string, rememberMe: boolean) => {
      localStorage.setItem("username", username);
      setStoredToken(token, rememberMe);
      setToken(token);
      setIsAuthenticated(true);
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, token, login, logout, clearSession }}
    >
      {children}
    </AuthContext.Provider>
  );
};
