/**
 * What a backup answer looks like, kept free of React so `npm test` can run
 * it.
 *
 * The board sends the backup as a gzip archive. A board older than the one
 * that refuses state changes on GET does not route `POST /api/bmc/backup`:
 * the request falls through to the interface's catch-all and is answered
 * `200` with `index.html`, which must never be saved as a backup. So an
 * answer counts only if it is not HTML and starts with the gzip magic bytes.
 */
import type { AxiosResponse } from "axios";

const GZIP_MAGIC = [0x1f, 0x8b];

async function firstBytes(data: unknown): Promise<number[]> {
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    return [...new Uint8Array(await data.slice(0, 2).arrayBuffer())];
  }
  if (data instanceof ArrayBuffer)
    return [...new Uint8Array(data, 0, Math.min(2, data.byteLength))];
  if (ArrayBuffer.isView(data)) {
    return [
      ...new Uint8Array(
        data.buffer,
        data.byteOffset,
        Math.min(2, data.byteLength)
      ),
    ];
  }
  return [];
}

export async function isBackupArchive(
  response: Pick<AxiosResponse, "status" | "headers" | "data">
): Promise<boolean> {
  if (response.status < 200 || response.status >= 300) return false;
  const header = (response.headers as Record<string, unknown> | undefined)?.[
    "content-type"
  ];
  const type = typeof header === "string" ? header.toLowerCase() : "";
  if (type.includes("text/html")) return false;
  const bytes = await firstBytes(response.data);
  return (
    bytes.length === GZIP_MAGIC.length &&
    bytes.every((byte, i) => byte === GZIP_MAGIC[i])
  );
}
