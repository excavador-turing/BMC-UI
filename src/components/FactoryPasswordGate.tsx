import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import PasswordForm from "@/components/PasswordForm";
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
    <main className="w-full border border-neutral-300 bg-white p-6 shadow-sm md:p-12 xl:w-300 dark:border-neutral-700 dark:bg-neutral-900">
      <div className="mb-6 flex items-start gap-3 rounded-md border border-amber-500 p-4">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-500" />
        <div className="text-sm">
          <p className="font-semibold">{t("factoryPassword.title")}</p>
          <p className="mt-1">{t("factoryPassword.why")}</p>
        </div>
      </div>

      <div className="mb-4 text-lg font-bold">
        {t("factoryPassword.heading", {
          account: access.data.local_account,
        })}
      </div>

      <PasswordForm account={access.data.local_account} />

      {/* One account, two doors. Somebody who changes this expecting only the
          web interface to be affected should not find that out from an SSH
          session that stops working. */}
      <p className="mt-6 max-w-md text-sm opacity-80">
        {t("factoryPassword.sshNote")}
      </p>
    </main>
  );
}
