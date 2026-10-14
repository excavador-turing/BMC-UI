import type { AxiosError } from "axios";

/**
 * What bmcd said, in words. It answers a refusal as
 * `{"response":[{"result":"<message>"}]}`; reading `response.data` as a string
 * showed that JSON verbatim. Falls back to a plain string body, then the
 * status text, then axios's own message.
 */
export function bmcdMessage(error: Error): string {
  const response = (error as AxiosError).response;
  const data: unknown = response?.data;
  if (typeof data === "string" && data !== "") return data;
  if (typeof data === "object" && data !== null) {
    const result = (data as { response?: { result?: unknown }[] }).response?.[0]
      ?.result;
    if (typeof result === "string" && result !== "") return result;
  }
  const text = response?.statusText;
  return text !== undefined && text !== "" ? text : error.message;
}
