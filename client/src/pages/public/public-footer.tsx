import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/ui/brand-logo";
import { useLanguage } from "@/lib/i18n";

const CURRENT_YEAR = new Date().getFullYear();

export function PublicFooter() {
  const { language } = useLanguage();

  return (
    <footer className="border-t border-border bg-card text-foreground" role="contentinfo">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BrandLogo size="sm" />
              <span className="font-bold text-foreground text-base">MillLedger</span>
            </div>
            <p className="max-w-sm text-xs text-muted-foreground leading-relaxed">
              {language === "ta"
                ? "சிறிய உணவு உற்பத்தி ஆலைகளுக்கான ஆர்டர்-டு-ஆடிட் ERP மற்றும் சரக்கு கணக்கு மென்பொருள்."
                : "Order-to-audit ERP and shop floor ledger software for small food manufacturing mills in India."}
            </p>
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Contact:</strong> hello@mill-ledger.com
            </p>
          </div>

          <div className="space-y-2 text-xs">
            <h2 className="font-semibold text-foreground text-sm">
              {language === "ta" ? "தயாரிப்பு & செயல்முறை" : "Product & Evaluation"}
            </h2>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <Link to="/features" className="hover:text-primary transition-colors">
                  ERP Features
                </Link>
              </li>
              <li>
                <Link to="/workflows" className="hover:text-primary transition-colors">
                  Order-to-Audit Workflows
                </Link>
              </li>
              <li>
                <Link to="/spreadsheet-alternative" className="hover:text-primary transition-colors">
                  Spreadsheet Alternative
                </Link>
              </li>
              <li>
                <Link to="/security" className="hover:text-primary transition-colors">
                  Security &amp; RBAC
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-2 text-xs">
            <h2 className="font-semibold text-foreground text-sm">
              {language === "ta" ? "வளங்கள் & தொடர்பு" : "Resources & Access"}
            </h2>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <Link to="/resources" className="hover:text-primary transition-colors">
                  Mill Accounting Guides
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-primary transition-colors">
                  About MillLedger
                </Link>
              </li>
              <li>
                <Link to="/demo" className="hover:text-primary transition-colors">
                  Request Product Demo
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-primary transition-colors">
                  Contact Team
                </Link>
              </li>
              <li>
                <Link to="/auth/login" className="hover:text-primary transition-colors">
                  Staff ERP Login
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p lang="en">© {CURRENT_YEAR} MillLedger. Order-to-Audit ERP for Food Manufacturing Mills.</p>
          <p>English &amp; தமிழ் (Tamil) bilingual operations</p>
        </div>
      </div>
    </footer>
  );
}
