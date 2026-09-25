import { useTranslation } from "react-i18next";

import PasswordForm from "@/components/PasswordForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAccessQuery } from "@/lib/api/get";

/**
 * The board's password.
 *
 * It used to be filesystem-only and arrive over SSH, through `passwd` on a
 * console: the interface that demands a password on every login could not
 * change it.
 *
 * An operator arriving through the fleet is not holding this board's password
 * and may not know there is one, so for them the card first says how they got
 * here. Everyone else just signed in and knows how.
 */
export default function PasswordCard() {
  const { t } = useTranslation();
  const access = useAccessQuery();

  // A board on an older daemon has no such endpoint. A card that cannot work
  // is not shown as a card that is broken.
  if (access.isError || !access.data) return null;

  const state = access.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("access.passwordTitle")}</CardTitle>
        <CardDescription>
          {t("access.passwordAccount", { account: state.local_account })}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {state.actor.scheme === "mtls" && (
          <p className="text-sm">
            {t("access.youAreGateway", { name: state.actor.name })}{" "}
            <span className="text-muted-foreground">
              {t("access.viaGatewayNote")}
            </span>
          </p>
        )}
        {/* The daemon requires the current password from everyone, including
          an operator the gateway vouched for, so the field is never hidden. */}
        <PasswordForm account={state.local_account} />
      </CardContent>
    </Card>
  );
}
