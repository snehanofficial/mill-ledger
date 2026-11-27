import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BrandLogo } from "@/components/ui/brand-logo";

const CURRENT_YEAR = new Date().getFullYear();

export function PublicFooter() {
  const { t } = useTranslation("public");

  return (
    <footer
      className="border-t border-border bg-card text-foreground"
      role="contentinfo"
    >
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BrandLogo size="sm" />
              <span className="font-bold text-foreground text-base">
                MillLedger
              </span>
            </div>
            <p className="max-w-sm text-xs text-muted-foreground leading-relaxed">
              {t("footer.tagline")}
            </p>
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">
                {t("footer.contactLabel")}
              </strong>{" "}
              hello@mill-ledger.com
            </p>
          </div>

          <div className="space-y-2 text-xs">
            <h2 className="font-semibold text-foreground text-sm">
              {t("footer.product")}
            </h2>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <Link
                  to="/features"
                  className="hover:text-primary transition-colors"
                >
                  {t("footer.erpFeatures")}
                </Link>
              </li>
              <li>
                <Link
                  to="/workflows"
                  className="hover:text-primary transition-colors"
                >
                  {t("footer.orderToAudit")}
                </Link>
              </li>
              <li>
                <Link
                  to="/spreadsheet-alternative"
                  className="hover:text-primary transition-colors"
                >
                  {t("footer.spreadsheetAlt")}
                </Link>
              </li>
              <li>
                <Link
                  to="/security"
                  className="hover:text-primary transition-colors"
                >
                  {t("footer.securityRbac")}
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-2 text-xs">
            <h2 className="font-semibold text-foreground text-sm">
              {t("footer.resourcesHeading")}
            </h2>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <Link
                  to="/resources"
                  className="hover:text-primary transition-colors"
                >
                  {t("footer.millGuides")}
                </Link>
              </li>
              <li>
                <Link
                  to="/about"
                  className="hover:text-primary transition-colors"
                >
                  {t("footer.aboutMillLedger")}
                </Link>
              </li>
              <li>
                <Link
                  to="/demo"
                  className="hover:text-primary transition-colors"
                >
                  {t("footer.requestDemo")}
                </Link>
              </li>
              <li>
                <Link
                  to="/contact"
                  className="hover:text-primary transition-colors"
                >
                  {t("footer.contactTeam")}
                </Link>
              </li>
              <li>
                <Link
                  to="/auth/login"
                  className="hover:text-primary transition-colors"
                >
                  {t("footer.staffLogin")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>{t("footer.copyright", { year: CURRENT_YEAR })}</p>
          <p>{t("footer.bilingualNote")}</p>
        </div>
      </div>
    </footer>
  );
}
