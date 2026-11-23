/**
 * The one way a state change goes to the board, kept free of React so
 * `npm test` can run it.
 *
 * bmcd refuses a state change on GET (excavador-turing/BMC-Firmware#99):
 * a GET is what an `<img>` on another page can make, with a password the
 * browser cached. So every `opt=set`, every upload handle, the upload cancel
 * and the backup go as POST, with the same query string.
 *
 * Older daemons in a fleet route these on GET only and answer a POST with
 * 405. A 405 means nothing ran, so the identical request is sent once more
 * as GET. Any other failure is the board's answer and is passed on as it is.
 */
import type { AxiosRequestConfig, AxiosResponse } from "axios";

/** What this needs of an axios instance. */
export interface Requester {
  request<T>(config: AxiosRequestConfig): Promise<AxiosResponse<T>>;
}

export type StateChangeConfig = Omit<AxiosRequestConfig, "url" | "method">;

function status(error: unknown): number | undefined {
  return (error as { response?: { status?: number } } | null)?.response?.status;
}

export async function sendStateChange<T = unknown>(
  api: Requester,
  url: string,
  config: StateChangeConfig = {}
): Promise<AxiosResponse<T>> {
  try {
    return await api.request<T>({ ...config, url, method: "POST" });
  } catch (error) {
    if (status(error) !== 405) throw error;
    return api.request<T>({ ...config, url, method: "GET" });
  }
}
