import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ShieldCheckIcon, MenuIcon, XIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getDefaultRouteForRole } from "@/lib/role-routing";

export function PublicHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { language, setLanguage } = useLanguage();
  const { user } = useCurrentUser();
  const location = useLocation();

  const navLinks = [
    { href: "/", label: language === "ta" ? "முகப்பு" : "Home" },
    { href: "/catalog", label: language === "ta" ? "தயாரிப்பு பட்டியல்" : "Catalog" },
    { href: "/contact", label: language === "ta" ? "தொடர்பு & மண்டி" : "Mandi & Contact" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {/* Skip to Main Landmark for Keyboard Accessibility (WCAG 2.4.1) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-md focus:outline-none"
      >
        {language === "ta" ? "முதன்மை பகுதிக்குச் செல்லவும்" : "Skip to main content"}
      </a>

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-control bg-primary text-primary-foreground shadow-xs">
            <ShieldCheckIcon className="size-5" aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-foreground text-sm sm:text-base">
              MillLedger
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">
              Agro Processing
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6" aria-label="Main navigation">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.href;
            return (
              <Link
                key={link.href}
                to={link.href}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  isActive ? "text-primary border-b-2 border-primary py-1" : "text-muted-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-3">
          {/* Language Switch Toggle (WCAG 3.1.2) */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLanguage(language === "en" ? "ta" : "en")}
            aria-label={
              language === "en" ? "Switch language to Tamil" : "Switch language to English"
            }
            className="h-8 px-2.5 text-xs font-semibold cursor-pointer"
          >
            <span lang={language === "en" ? "ta" : "en"}>
              {language === "en" ? "தமிழ்" : "EN"}
            </span>
          </Button>

          {user ? (
            <Link
              to={getDefaultRouteForRole(user.role)}
              className={buttonVariants({ variant: "primary", size: "sm" })}
            >
              {language === "ta" ? "பணிமனைக்குச் செல்" : "Open Workspace"}
            </Link>
          ) : (
            <Link
              to="/auth/login"
              className={buttonVariants({ variant: "primary", size: "sm" })}
            >
              {language === "ta" ? "பணியாளர் உள்நுழைவு" : "Staff ERP Login"}
            </Link>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center gap-2 md:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLanguage(language === "en" ? "ta" : "en")}
            aria-label={
              language === "en" ? "Switch language to Tamil" : "Switch language to English"
            }
            className="h-8 px-2 text-xs font-semibold"
          >
            <span lang={language === "en" ? "ta" : "en"}>
              {language === "en" ? "தமிழ்" : "EN"}
            </span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
            className="p-1.5"
          >
            {mobileMenuOpen ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="border-b border-border bg-background px-4 pt-2 pb-4 md:hidden">
          <nav className="flex flex-col gap-2" aria-label="Mobile navigation">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-2 border-t border-border mt-1">
              {user ? (
                <Link
                  to={getDefaultRouteForRole(user.role)}
                  onClick={() => setMobileMenuOpen(false)}
                  className={buttonVariants({ variant: "primary", className: "w-full" })}
                >
                  {language === "ta" ? "பணிமனைக்குச் செல்" : "Open Workspace"}
                </Link>
              ) : (
                <Link
                  to="/auth/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className={buttonVariants({ variant: "primary", className: "w-full" })}
                >
                  {language === "ta" ? "பணியாளர் உள்நுழைவு" : "Staff ERP Login"}
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
