import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { buttonVariants } from "@/components/ui/button";

export function NotFoundPage() {
  const { t } = useTranslation(["errors", "public"]);

  useEffect(() => {
    document.title = `${t("errors:notFoundPage.title")} | MillLedger`;
    let meta = document.querySelector(
      'meta[name="robots"]',
    ) as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    meta.content = "noindex, nofollow";
  }, [t]);

  return (
    <main className="flex min-h-[60vh] flex-1 flex-col items-center justify-center p-8 text-center">
      <h1 className="text-2xl font-bold text-foreground">
        {t("errors:notFoundPage.code")} - {t("errors:notFoundPage.title")}
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {t("errors:notFoundPage.description")}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link to="/" className={buttonVariants({ variant: "primary" })}>
          {t("errors:notFoundPage.goHome")}
        </Link>
        <Link to="/features" className={buttonVariants({ variant: "outline" })}>
          {t("public:footer.erpFeatures")}
        </Link>
      </div>
    </main>
  );
}
