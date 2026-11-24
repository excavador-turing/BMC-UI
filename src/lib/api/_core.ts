import axios, { type AxiosError } from "axios";
import { useMemo } from "react";

import { useApiBase } from "@/hooks/useApiBase";
import { useAuth } from "@/hooks/useAuth";

import { limitFor, READ_TIMEOUT_MS } from "./requestTimeout.ts";

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
 *
 * EVERY REQUEST HAS A LIMIT. The instance carries the one for a read; a call
 * that is not a read says its own (see `requestTimeout.ts`), and an upload
 * says none. Without a limit a board that dropped off the network was noticed
 * after the browser gave up on the connection, 80 seconds in Safari.
 */
export function useAxiosWithAuth() {
  const { token, clearSession } = useAuth();
  const { base, unauthorized } = useApiBase();

  return useMemo(() => {
    const api = axios.create({
      baseURL: base,
      timeout: READ_TIMEOUT_MS,
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
      },
    });

    // A write that did not name a limit gets the limit of a write; see
    // `limitFor`.
    api.interceptors.request.use((config) => {
      config.timeout = limitFor(config.method, config.timeout);
      return config;
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
