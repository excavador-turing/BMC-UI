import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

/**
 * Copies one value -- a serial, an address -- to the clipboard.
 *
 * Renders nothing where the Clipboard API is missing, which is any page
 * served over plain HTTP from something other than localhost: a button that
 * cannot work is worse than none.
 */
export default function CopyButton({ value }: { value: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  if (!navigator.clipboard) return null;

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      className="text-muted-foreground"
      aria-label={copied ? t("about.copied") : t("about.ariaCopy", { value })}
      title={copied ? t("about.copied") : t("about.ariaCopy", { value })}
      onClick={() => {
        navigator.clipboard.writeText(value).then(
          () => setCopied(true),
          () => undefined
        );
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
}
