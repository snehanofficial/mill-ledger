import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { MenuIcon, XIcon } from "lucide-react";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getDefaultRouteForRole } from "@/lib/role-routing";
import { getPrefetchProps } from "@/lib/route-prefetch";

export function PublicHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { language, setLanguage } = useLanguage();
  const { user } = useCurrentUser();
  const location = useLocation();

  const navLinks = [
    { href: "/", label: language === "ta" ? "முகப்பு" : "Home" },
    { href: "/features", label: language === "ta" ? "வசதிகள்" : "Features" },
    {
      href: "/workflows",
      label: language === "ta" ? "செயல்முறைகள்" : "Workflows",
    },
    {
      href: "/resources",
      label: language === "ta" ? "வழிகாட்டிகள்" : "Resources",
    },
    { href: "/contact", label: language === "ta" ? "தொடர்பு" : "Contact" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-md focus:outline-none"
      >
        {language === "ta"
          ? "முதன்மை பகுதிக்குச் செல்லவும்"
          : "Skip to main content"}
      </a>

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5 min-h-[44px]">
          <BrandLogo size="nav" />
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-foreground text-sm sm:text-base">
              MillLedger
            </span>
            <span className="text-[11px] text-muted-foreground">
              {language === "ta" ? "உணவு ஆலை ERP" : "Food Mill ERP"}
            </span>
          </div>
        </Link>

        <nav
          className="hidden md:flex items-center gap-6"
          aria-label="Main navigation"
        >
          {navLinks.map((link) => {
            const isActive =
              link.href === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                to={link.href}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex min-h-[44px] items-center text-sm font-medium transition-colors hover:text-primary ${
                  isActive
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground"
                }`}
                {...getPrefetchProps(link.href)}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLanguage(language === "en" ? "ta" : "en")}
            aria-label={
              language === "en"
                ? "Switch language to Tamil"
                : "Switch language to English"
            }
            className="min-h-[44px] px-3 text-xs font-semibold cursor-pointer"
          >
            <span lang={language === "en" ? "ta" : "en"}>
              {language === "en" ? "தமிழ்" : "EN"}
            </span>
          </Button>

          <Link
            to="/demo"
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "min-h-[44px] px-4",
            })}
            {...getPrefetchProps("/demo")}
          >
            {language === "ta" ? "டெமோ கோருக" : "Request Demo"}
          </Link>

          {user ? (
            <Link
              to={getDefaultRouteForRole(user.role)}
              className={buttonVariants({
                variant: "primary",
                size: "sm",
                className: "min-h-[44px] px-4",
              })}
            >
              {language === "ta" ? "பணிமனைக்குச் செல்" : "Open Workspace"}
            </Link>
          ) : (
            <Link
              to="/auth/login"
              className={buttonVariants({
                variant: "primary",
                size: "sm",
                className: "min-h-[44px] px-4",
              })}
              {...getPrefetchProps("/auth/login")}
            >
              {language === "ta" ? "பணியாளர் உள்நுழைவு" : "Staff ERP Login"}
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLanguage(language === "en" ? "ta" : "en")}
            aria-label={
              language === "en"
                ? "Switch language to Tamil"
                : "Switch language to English"
            }
            className="min-h-[44px] min-w-[44px] px-2.5 text-xs font-semibold cursor-pointer"
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
            className="min-h-[44px] min-w-[44px] p-2 cursor-pointer"
          >
            {mobileMenuOpen ? (
              <XIcon className="size-5" aria-hidden="true" />
            ) : (
              <MenuIcon className="size-5" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-b border-border bg-background px-4 pt-2 pb-4 md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex min-h-[44px] items-center rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                {link.label}
              </Link>
            ))}
            <div className="flex flex-col gap-2 pt-3 border-t border-border mt-2">
              <Link
                to="/demo"
                onClick={() => setMobileMenuOpen(false)}
                className={buttonVariants({
                  variant: "outline",
                  className: "min-h-[44px] w-full",
                })}
              >
                {language === "ta" ? "டெமோ கோருக" : "Request Demo"}
              </Link>
              {user ? (
                <Link
                  to={getDefaultRouteForRole(user.role)}
                  onClick={() => setMobileMenuOpen(false)}
                  className={buttonVariants({
                    variant: "primary",
                    className: "min-h-[44px] w-full",
                  })}
                >
                  {language === "ta" ? "பணிமனைக்குச் செல்" : "Open Workspace"}
                </Link>
              ) : (
                <Link
                  to="/auth/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className={buttonVariants({
                    variant: "primary",
                    className: "min-h-[44px] w-full",
                  })}
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
