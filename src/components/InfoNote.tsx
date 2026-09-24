import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/** Where the long version of every note now lives. */
const DOCS = "https://turing.excavador.xyz";

/**
 * A footnote, folded into an (i).
 *
 * Every page in this interface used to carry paragraph-length notes between
 * its controls: what an eraseblock is, why the fan's duty table is not linear,
 * why the console needs a reader task, why the API is line-oriented. They were
 * true, and they were being read by nobody in a hurry -- an operator on the
 * Firmware page at two in the morning is not there to learn about UBI.
 *
 * They belong on the docs site, which now exists. What stays here is one
 * sentence and a way through to the rest.
 *
 * **Warnings and confirmations do not become these.** A maskrom warning, a
 * "this cuts power to the modules" dialog and a reset-network confirmation are
 * information needed at the moment of deciding, and putting them behind a
 * click would be hiding them. This is for the standing explanation beside a
 * reading, not for the consequence of a button.
 *
 * A shadcn `Popover`: it closes on Escape and on a click anywhere else, and
 * flips to stay on screen at the edge of a 390 px row.
 */
export default function InfoNote({
  text,
  path,
  label,
}: {
  /** One sentence. If it needs two, it belongs on the docs site. */
  text: string;
  /** Path on the docs site, e.g. `/reference/metrics/#nand`. */
  path: string;
  /** What the note is about, for the button's accessible name. */
  label: string;
}) {
  const { t } = useTranslation();

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            className="rounded-full text-muted-foreground"
            aria-label={t("ui.aboutThis", { subject: label })}
          />
        }
      >
        <Info aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-max max-w-[min(20rem,calc(100vw-2rem))] text-sm font-normal normal-case"
      >
        <p>{text}</p>
        <a
          className="text-primary underline underline-offset-4"
          href={`${DOCS}${path}`}
          target="_blank"
          rel="noreferrer noopener"
        >
          {t("ui.readMore")}
        </a>
      </PopoverContent>
    </Popover>
  );
}
