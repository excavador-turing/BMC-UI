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
 *
 * Not every old route says 405. A route registered on GET alone, like the
 * backup, does not match a POST at all, so the request falls through to the
 * interface's own catch-all and comes back 200 with `index.html`. A caller
 * that knows what a real answer looks like passes `accept`; an answer it
 * does not accept is treated like a 405, and the request is sent as GET.
 *
 * A state change waits `STATE_CHANGE_TIMEOUT_MS` unless the caller names its
 * own limit. A change that timed out may still have reached the board, so a
 * timeout is passed on as it is and never retried as a GET: the 405 fallback
 * is for a board that answered, and a board that did not answer has told us
 * nothing about the route.
 */
import type { AxiosRequestConfig, AxiosResponse } from "axios";

import { STATE_CHANGE_TIMEOUT_MS } from "./requestTimeout.ts";

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
  config: StateChangeConfig = {},
  accept?: (response: AxiosResponse<T>) => boolean | Promise<boolean>
): Promise<AxiosResponse<T>> {
  let posted: AxiosResponse<T>;
  try {
    posted = await api.request<T>({
      timeout: STATE_CHANGE_TIMEOUT_MS,
      ...config,
      url,
      method: "POST",
    });
  } catch (error) {
    if (status(error) !== 405) throw error;
    return api.request<T>({
      timeout: STATE_CHANGE_TIMEOUT_MS,
      ...config,
      url,
      method: "GET",
    });
  }
  if (!accept || (await accept(posted))) return posted;
  return api.request<T>({
    timeout: STATE_CHANGE_TIMEOUT_MS,
    ...config,
    url,
    method: "GET",
  });
}
