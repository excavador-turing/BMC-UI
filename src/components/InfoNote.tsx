import { Info } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

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
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const container = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    // pointerdown, not click: a click that starts inside and ends outside
    // should not count as dismissing it.
    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <span ref={container} className="relative inline-flex align-middle">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={t("ui.aboutThis", { subject: label })}
        onClick={() => setOpen((was) => !was)}
        className="inline-flex size-5 items-center justify-center rounded-full opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <Info className="size-4" aria-hidden />
      </button>

      {open && (
        <span
          id={panelId}
          role="dialog"
          aria-label={t("ui.aboutThis", { subject: label })}
          // Anchored to the right so a note at the edge of a row opens
          // inwards instead of off the page; max-w keeps it inside a 390px
          // screen, where these rows are already tight.
          className="absolute top-7 right-0 z-20 w-max max-w-[min(20rem,calc(100vw-2rem))] rounded-md border border-neutral-300 bg-white p-3 text-left text-sm font-normal text-neutral-900 normal-case shadow-lg dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        >
          <span className="block">{text}</span>
          <a
            className="mt-2 block underline"
            href={`${DOCS}${path}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            {t("ui.readMore")}
          </a>
        </span>
      )}
    </span>
  );
}
