/**
 * The query string of the request that starts a firmware or node flash.
 *
 * Kept free of imports from the app so `npm test` can load it as plain
 * TypeScript.
 */
export interface FlashParamsInput {
  type: "firmware" | "flash";
  file?: { name: string; size: number };
  url?: string;
  /**
   * `url` is a path on the board's own SD card (as the listing returned it),
   * not an address to fetch. The daemon reads the file itself: there is no
   * upload and so no `length`.
   */
  sdcard?: boolean;
  sha256?: string;
  skipCRC?: boolean;
  node?: number;
  park?: boolean;
}

export const handleParams = (variables: FlashParamsInput) => {
  const params: Record<string, unknown> = {
    opt: "set",
    type: variables.type,
  };

  if (variables.file) {
    params.file = variables.file.name;
    params.length = variables.file.size;
  } else {
    params.file = variables.url;
    // bmcd confines the path to the card; it answers 400 for a bad path.
    if (variables.sdcard) params.sdcard = 1;
  }

  if (variables.sha256) {
    params.sha256 = variables.sha256;
  }

  // bmcd tests for the PRESENCE of `skip_crc`, not its value, so
  // `skip_crc=false` skipped verification exactly like `skip_crc=1`. Send it
  // only when the box is ticked.
  if (variables.skipCRC) {
    params.skip_crc = 1;
  }

  if (variables.node !== undefined) {
    params.node = variables.node;
  }

  // Park the image on the SD card instead of installing it. The daemon writes
  // it and stops, so the catalogue lists it and installing stays a separate,
  // visible choice -- rather than an upload that arms the board the moment it
  // lands.
  if (variables.park) {
    params.park = 1;
  }

  return params;
};
