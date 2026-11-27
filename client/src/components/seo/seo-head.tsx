import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronRightIcon } from "lucide-react";
import {
  buildCanonicalUrl,
  buildStructuredDataGraph,
  getPublicRouteMeta,
  normalizeBaseUrl,
  type BreadcrumbItem,
} from "@/lib/public-routes";
import { captureAttributionOnce } from "@/lib/analytics";

function upsertMetaTag(
  selector: string,
  attrs: Record<string, string>,
  content: string,
): void {
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    for (const [key, val] of Object.entries(attrs)) {
      el.setAttribute(key, val);
    }
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertCanonicalLink(href: string): void {
  let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = href;
}

function upsertJsonLd(data: Record<string, unknown>): void {
  const id = "millledger-route-jsonld";
  let script = document.head.querySelector(`script#${id}`) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement("script");
    script.id = id;
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

export function useSeoHead(pathname: string): void {
  useEffect(() => {
    captureAttributionOnce();

    const meta = getPublicRouteMeta(pathname);
    if (!meta) return;

    const appUrl = normalizeBaseUrl(
      import.meta.env.VITE_APP_URL || window.location.origin,
    );
    const canonicalUrl = buildCanonicalUrl(appUrl, meta.path);
    const ogImageUrl = `${appUrl}/og-preview.png`;

    document.title = meta.title;
    upsertCanonicalLink(canonicalUrl);

    upsertMetaTag('meta[name="description"]', { name: "description" }, meta.description);
    upsertMetaTag('meta[name="robots"]', { name: "robots" }, "index, follow");

    upsertMetaTag('meta[property="og:type"]', { property: "og:type" }, meta.ogType);
    upsertMetaTag('meta[property="og:title"]', { property: "og:title" }, meta.title);
    upsertMetaTag('meta[property="og:description"]', { property: "og:description" }, meta.description);
    upsertMetaTag('meta[property="og:url"]', { property: "og:url" }, canonicalUrl);
    upsertMetaTag('meta[property="og:image"]', { property: "og:image" }, ogImageUrl);

    upsertMetaTag('meta[name="twitter:title"]', { name: "twitter:title" }, meta.title);
    upsertMetaTag('meta[name="twitter:description"]', { name: "twitter:description" }, meta.description);
    upsertMetaTag('meta[name="twitter:image"]', { name: "twitter:image" }, ogImageUrl);

    upsertJsonLd(buildStructuredDataGraph(meta, appUrl));
  }, [pathname]);
}

export function PublicBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={item.path} className="inline-flex items-center gap-1.5">
              {idx > 0 && (
                <ChevronRightIcon className="size-3.5 text-muted-foreground/70" aria-hidden="true" />
              )}
              {isLast ? (
                <span aria-current="page" className="font-medium text-foreground">
                  {item.name}
                </span>
              ) : (
                <Link
                  to={item.path}
                  className="hover:text-primary hover:underline underline-offset-4 transition-colors"
                >
                  {item.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
