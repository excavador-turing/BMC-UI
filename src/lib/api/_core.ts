import axios, { type AxiosError } from "axios";
import { useMemo } from "react";

import { useApiBase } from "@/hooks/useApiBase";
import { useAuth } from "@/hooks/useAuth";

/**
 * The one place a request learns where to go and what a 401 means.
 *
 * MEMOISED, and that is not a micro-optimisation. This used to build a fresh
 * axios instance on every render, which made the instance useless as a
 * dependency: anything holding it in a `useCallback` rebuilt on every render.
 * `SerialConsole` hit that and worked around it by hardcoding `/api` in its
 * fetch and its WebSocket URL -- which is precisely the thing that stops the
 * console working against anything but the board's own interface. Memoising
 * here is what let that workaround go.
 */
export function useAxiosWithAuth() {
  const { token, clearSession } = useAuth();
  const { base, unauthorized } = useApiBase();

  return useMemo(() => {
    const api = axios.create({
      baseURL: base,
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
      },
    });

    api.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        // Only where a 401 is about THIS session. The fleet talks to several
        // boards; one of them refusing is that board's problem, and signing
        // the operator out of the whole interface because one board is
        // unhappy would be the wrong response to the most common failure it
        // will see.
        // A 401 means the board no longer knows this token -- it expired,
        // or the password was changed, which drops every session -- so the
        // session is cleared and the login page shown, without a logout
        // request the board would refuse anyway.
        if (error.response?.status === 401 && unauthorized === "logout") {
          clearSession();
        }
        return Promise.reject(error);
      }
    );

    return api;
  }, [base, token, unauthorized, clearSession]);
}
