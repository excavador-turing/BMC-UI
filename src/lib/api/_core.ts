import axios, { type AxiosError } from "axios";

import { useApiBase } from "@/hooks/useApiBase";
import { useAuth } from "@/hooks/useAuth";

export function useAxiosWithAuth() {
  const { token, logout } = useAuth();
  const { base, unauthorized } = useApiBase();

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
      // boards; one of them refusing is that board's problem, and signing the
      // operator out of the whole interface because one board is unhappy would
      // be the wrong response to the most common failure it will see.
      if (error.response?.status === 401 && unauthorized === "logout") {
        logout();
      }
      return Promise.reject(error);
    }
  );

  return api;
}
