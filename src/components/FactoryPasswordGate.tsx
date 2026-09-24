import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import ConnectionBanner from "@/components/ConnectionBanner";
import PasswordForm from "@/components/PasswordForm";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAccessQuery } from "@/lib/api/get";

/**
 * The only page a board still on its password from the factory will show.
 *
 * Every board ships as `root` / `turing`. It is printed in the quick-start
 * guide and is the same on every board anyone has bought, so a board that has
 * not had it changed is a board anybody who can reach it can administer. The
 * daemon answers 403 to everything but logging in and changing it; without
 * this page the interface would render every tab as an error and leave the
 * operator to work out why.
 *
 * Not a banner over the ordinary interface. A banner is a thing people close.
 * And not the ordinary interface with this as its page either: the sidebar
 * would offer seven pages the daemon will refuse, so the gate stands in for
 * the whole layout, sidebar and all.
 *
 * It asks for the current password like any other change, which on this board
 * is the published one — that is one more field to type and it keeps a single
 * code path, rather than a special "first time" endpoint that skips a check.
 *
 * Returns null unless the board says so. A board on an older daemon sends no
 * `factory_password` key at all, and `undefined` is the right answer for it:
 * that daemon refuses nothing, so a page telling its operator they can do
 * nothing else would simply be false.
 */
export default function FactoryPasswordGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const access = useAccessQuery();

  if (access.data?.factory_password !== true) return <>{children}</>;

  return (
    <div className="flex min-h-svh w-full flex-col">
      <ConnectionBanner />
      <main className="flex flex-1 items-start justify-center p-4 md:items-center md:p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>
              {t("factoryPassword.heading", {
                account: access.data.local_account,
              })}
            </CardTitle>
            {/* One account, two doors. Somebody who changes this expecting
                only the web interface to be affected should not find that out
                from an SSH session that stops working. */}
            <CardDescription>{t("factoryPassword.sshNote")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <Alert variant="warning">
              <TriangleAlert />
              <AlertTitle>{t("factoryPassword.title")}</AlertTitle>
              <AlertDescription>{t("factoryPassword.why")}</AlertDescription>
            </Alert>
            <PasswordForm account={access.data.local_account} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
