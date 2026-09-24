import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";

export default function FourOhFour() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <>
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-7xl font-bold text-muted-foreground">404</h1>
          <p className="text-xl font-medium">{t("ui.pageNotFound")}</p>
          <Button
            type="button"
            size="lg"
            onClick={() => void navigate({ to: "/" })}
          >
            {t("ui.backToHome")}
          </Button>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
