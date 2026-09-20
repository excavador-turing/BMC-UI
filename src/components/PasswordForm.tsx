import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useSetPasswordMutation } from "@/lib/api/set";

/**
 * The daemon's own rule, restated so the button is disabled rather than
 * pressed and refused.
 *
 * Twelve CHARACTERS: a passphrase is not shorter for being written in an
 * alphabet with wider codepoints, so count the way the daemon counts.
 */
const MIN_LENGTH = 12;

/**
 * Changing the local account's password.
 *
 * Its own component because it is rendered in two places that are not each
 * other's neighbours: the Access tab, where it is one card among several, and
 * the page a board still on its factory password shows instead of everything
 * else. Two copies of a password form is two places for the length rule to
 * drift from the daemon's.
 *
 * The current password is asked of everybody, including an operator the
 * gateway vouched for. Their certificate proves the gateway trusts them; it
 * does not prove they hold this board's console, and a change made without
 * the old password is a lockout anyone with a live session could perform.
 */
export default function PasswordForm({
  account,
  onChanged,
}: {
  account: string;
  onChanged?: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const setPassword = useSetPasswordMutation();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");

  const longEnough = [...next].length >= MIN_LENGTH;
  const matches = next !== "" && next === again;
  const canChange = current !== "" && longEnough && matches && next !== current;

  const apply = () => {
    setPassword.mutate(
      {
        username: account,
        current_password: current,
        new_password: next,
      },
      {
        onSuccess: () => {
          setCurrent("");
          setNext("");
          setAgain("");
          toast({ title: t("access.passwordChanged") });
          onChanged?.();
        },
        onError: (e: Error) =>
          toast({
            title: t("access.passwordFailed"),
            description: e.message,
            variant: "destructive",
          }),
      }
    );
  };

  return (
    <div className="flex max-w-md flex-col gap-2">
      <Input
        name="current-password"
        label={t("access.currentPassword")}
        type="password"
        autoComplete="current-password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
      />
      <Input
        name="new-password"
        label={t("access.newPassword")}
        type="password"
        autoComplete="new-password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
      />
      <Input
        name="repeat-password"
        label={t("access.repeatPassword")}
        type="password"
        autoComplete="new-password"
        value={again}
        onChange={(e) => setAgain(e.target.value)}
      />
      {/* One message at a time, and only once there is something to say
          about: a rule shown before the first keystroke reads as an error the
          operator has already made. */}
      {next !== "" && !longEnough && (
        <div className="text-sm opacity-80">{t("access.tooShort")}</div>
      )}
      {again !== "" && !matches && (
        <div className="text-sm opacity-80">{t("access.noMatch")}</div>
      )}
      <div>
        <Button
          type="button"
          disabled={!canChange || setPassword.isPending}
          onClick={apply}
        >
          {t("access.changePassword")}
        </Button>
      </div>
      <div className="text-sm opacity-80">{t("access.sessionsNote")}</div>
    </div>
  );
}
