import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { PublicHeader } from "./public-header";
import { PublicFooter } from "./public-footer";
import { PublicBreadcrumbs, useSeoHead } from "@/components/seo/seo-head";
import { getPublicRouteMeta } from "@/lib/public-routes";

interface PublicLayoutProps {
  children: ReactNode;
  showBreadcrumbs?: boolean;
}

export function PublicLayout({
  children,
  showBreadcrumbs = true,
}: PublicLayoutProps) {
  const location = useLocation();
  useSeoHead(location.pathname);
  const routeMeta = getPublicRouteMeta(location.pathname);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <PublicHeader />
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {showBreadcrumbs && routeMeta && routeMeta.breadcrumbs.length > 1 && (
          <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
            <PublicBreadcrumbs items={routeMeta.breadcrumbs} />
          </div>
        )}
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
