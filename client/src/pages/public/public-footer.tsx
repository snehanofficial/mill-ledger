import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/ui/brand-logo";
import { useLanguage } from "@/lib/i18n";

const CURRENT_YEAR = new Date().getFullYear();

export function PublicFooter() {
  const { language } = useLanguage();

  return (
    <footer className="border-t border-border bg-card text-foreground" role="contentinfo">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Identity */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2">
              <BrandLogo size="sm" />
              <span className="font-bold text-foreground text-base">MillLedger</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {language === "ta"
                ? "நவீன தானிய அரைவை மற்றும் உணவு பதப்படுத்தும் ஆலை. FSSAI & AGMARK தரச் சான்றிதழ் பெற்ற நிறுவனம்."
                : "Precision grain milling and modern food processing unit. FSSAI certified B2B agricultural manufacturer."}
            </p>
            <div className="text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">
                {language === "ta" ? "மண்டி கொள்முதல் & ஆலை வாயில்:" : "Mandi Gate & Weighbridge:"}
              </p>
              <p>NH-44 Bypass Industrial Estate,</p>
              <p>Madurai, Tamil Nadu 625016</p>
            </div>
          </div>

          {/* Statutory Credentials */}
          <div className="space-y-2 text-xs text-muted-foreground md:col-span-1">
            <h3 className="font-semibold text-foreground text-sm">
              {language === "ta" ? "சட்டப்பூர்வ சான்றிதழ்கள்" : "Statutory & Compliance"}
            </h3>
            <p>
              <strong className="text-foreground">FSSAI Central Lic:</strong> 12423001000456
            </p>
            <p>
              <strong className="text-foreground">GSTIN:</strong> 33AAAAA0000A1Z5
            </p>
            <p>
              <strong className="text-foreground">Quality Standard:</strong> ISO 22000:2018
            </p>
            <p>
              <strong className="text-foreground">Sorting:</strong> 100 TPD Buhler Sortex
            </p>
          </div>

          {/* Quick links */}
          <div className="space-y-2 text-xs md:col-span-1">
            <h3 className="font-semibold text-foreground text-sm">
              {language === "ta" ? "வழிகாட்டி" : "Navigation"}
            </h3>
            <ul className="space-y-1.5 text-muted-foreground">
              <li>
                <Link to="/" className="hover:text-primary transition-colors">
                  {language === "ta" ? "முகப்பு" : "Home"}
                </Link>
              </li>
              <li>
                <Link to="/catalog" className="hover:text-primary transition-colors">
                  {language === "ta" ? "மொத்த விற்பனை பட்டியல்" : "B2B Product Catalog"}
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-primary transition-colors">
                  {language === "ta" ? "மண்டி தொடர்பு & விலை கோரிக்கை" : "Mandi Intake & Inquiries"}
                </Link>
              </li>
              <li>
                <Link to="/auth/login" className="hover:text-primary transition-colors">
                  {language === "ta" ? "பணியாளர் உள்நுழைவு" : "Staff ERP Gateway"}
                </Link>
              </li>
            </ul>
          </div>

          {/* Operating hours */}
          <div className="space-y-2 text-xs text-muted-foreground md:col-span-1">
            <h3 className="font-semibold text-foreground text-sm">
              {language === "ta" ? "செயல்படும் நேரம்" : "Operating Hours"}
            </h3>
            <p>
              <strong className="text-foreground">{language === "ta" ? "எடைமேடை:" : "Weighbridge:"}</strong>{" "}
              06:00 - 20:00 IST (Mon - Sat)
            </p>
            <p>
              <strong className="text-foreground">{language === "ta" ? "மண்டி வரவு:" : "Farmer Intake:"}</strong>{" "}
              07:00 - 18:00 IST (Mon - Sat)
            </p>
            <p>
              <strong className="text-foreground">{language === "ta" ? "தொலைபேசி:" : "Phone:"}</strong>{" "}
              +91 452 290 8472
            </p>
            <p>
              <strong className="text-foreground">{language === "ta" ? "மின்னஞ்சல்:" : "Email:"}</strong>{" "}
              info@millledger.local
            </p>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6 text-center text-xs text-muted-foreground">
          <p lang="en">© {CURRENT_YEAR} MillLedger Technologies & Food Processing Unit. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
