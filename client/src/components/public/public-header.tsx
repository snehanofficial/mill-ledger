import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MenuIcon, XIcon } from "lucide-react";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { LanguageSelector } from "@/components/ui/language-selector";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getDefaultRouteForRole } from "@/lib/role-routing";
import { getPrefetchProps } from "@/lib/route-prefetch";

export function PublicHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t } = useTranslation(["public", "common"]);
  const { user } = useCurrentUser();
  const location = useLocation();

  const navLinks = [
    { href: "/", label: t("public:nav.home") },
    { href: "/features", label: t("public:nav.features") },
    { href: "/workflows", label: t("public:nav.workflows") },
    { href: "/resources", label: t("public:nav.resources") },
    { href: "/contact", label: t("public:nav.contact") },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-md focus:outline-none"
      >
        {t("common:shell.skipToMain")}
      </a>

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5 min-h-[44px] shrink-0">
          <BrandLogo size="nav" />
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-foreground text-sm sm:text-base">
              {t("common:appName")}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {t("common:appTagline")}
            </span>
          </div>
        </Link>

        <nav
          className="hidden md:flex items-center gap-4 lg:gap-6 min-w-0"
          aria-label={t("public:nav.mainNavAria")}
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
                className={`inline-flex min-h-[44px] items-center whitespace-nowrap text-sm font-medium transition-colors hover:text-primary ${
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

        <div className="hidden md:flex items-center gap-2 lg:gap-3 shrink-0">
          <LanguageSelector />

          <Link
            to="/demo"
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "min-h-[44px] px-3 lg:px-4 whitespace-nowrap",
            })}
            {...getPrefetchProps("/demo")}
          >
            {t("public:nav.requestDemo")}
          </Link>

          {user ? (
            <Link
              to={getDefaultRouteForRole(user.role)}
              className={buttonVariants({
                variant: "primary",
                size: "sm",
                className: "min-h-[44px] px-3 lg:px-4 whitespace-nowrap",
              })}
            >
              {t("public:nav.openWorkspace")}
            </Link>
          ) : (
            <Link
              to="/auth/login"
              className={buttonVariants({
                variant: "primary",
                size: "sm",
                className: "min-h-[44px] px-3 lg:px-4 whitespace-nowrap",
              })}
              {...getPrefetchProps("/auth/login")}
            >
              {t("public:nav.staffLogin")}
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <LanguageSelector />

          <Button
            variant="outline"
            size="sm"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label={
              mobileMenuOpen
                ? t("public:nav.closeMenu")
                : t("public:nav.openMenu")
            }
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
          <nav
            className="flex flex-col gap-1"
            aria-label={t("public:nav.mainNavAria")}
          >
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
                {t("public:nav.requestDemo")}
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
                  {t("public:nav.openWorkspace")}
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
                  {t("public:nav.staffLogin")}
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
