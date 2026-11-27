import { renderToString } from "react-dom/server";
import { StaticRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/lib/i18n";
import { LandingPage } from "@/pages/public/landing-page";
import { FeaturesPage } from "@/pages/public/features-page";
import { WorkflowsPage } from "@/pages/public/workflows-page";
import { SpreadsheetAlternativePage } from "@/pages/public/spreadsheet-alternative-page";
import { ResourcesPage } from "@/pages/public/resources-page";
import { ResourceArticlePage } from "@/pages/public/resource-article-page";
import { SecurityPage } from "@/pages/public/security-page";
import { AboutPage } from "@/pages/public/about-page";
import { ContactPage, DemoPage } from "@/pages/public/contact-page";
import {
  PUBLIC_ROUTES,
  buildCanonicalUrl,
  buildStructuredDataGraph,
  normalizeBaseUrl,
} from "@/lib/public-routes";

export {
  PUBLIC_ROUTES,
  buildCanonicalUrl,
  buildStructuredDataGraph,
  normalizeBaseUrl,
};

export function renderPublicRoute(pathname: string): string {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  try {
    return renderToString(
      <LanguageProvider>
        <QueryClientProvider client={queryClient}>
          <StaticRouter location={pathname}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/workflows" element={<WorkflowsPage />} />
              <Route
                path="/spreadsheet-alternative"
                element={<SpreadsheetAlternativePage />}
              />
              <Route path="/resources" element={<ResourcesPage />} />
              <Route
                path="/resources/indian-gst-invoicing-for-food-mills"
                element={<ResourceArticlePage articleId="gst-invoicing" />}
              />
              <Route
                path="/resources/moving-weighted-average-stock-ledger"
                element={<ResourceArticlePage articleId="stock-ledger" />}
              />
              <Route
                path="/resources/offline-salesman-order-capture"
                element={<ResourceArticlePage articleId="offline-orders" />}
              />
              <Route path="/security" element={<SecurityPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/demo" element={<DemoPage />} />
              <Route path="/contact" element={<ContactPage />} />
            </Routes>
          </StaticRouter>
        </QueryClientProvider>
      </LanguageProvider>,
    );
  } finally {
    queryClient.clear();
  }
}
