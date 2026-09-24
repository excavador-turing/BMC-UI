import { useMediaQuery } from "@/hooks/use-media-query";

const MOBILE_BREAKPOINT = 768;

/**
 * Below `md`, where the sidebar is a sheet. shadcn ships this as an effect
 * that sets state; the media-query hook this repository already has answers
 * the same question without the extra render.
 */
export function useIsMobile() {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
}
