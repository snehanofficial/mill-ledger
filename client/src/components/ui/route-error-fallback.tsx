import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  isRouteErrorResponse,
  useLocation,
  useNavigate,
  useRevalidator,
  useRouteError,
} from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Home,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { Button } from "./button";

interface RouteErrorFallbackProps {
  /** Optional home path for the secondary navigation CTA */
  homePath?: string;
}

/**
 * Route-level error boundary UI for React Router data routes.
 * Replaces the default React Router developer fallback with clear visual
 * hierarchy, reassuring copy, and actionable recovery CTAs.
 */
export function RouteErrorFallback({
  homePath = "/dashboard",
}: RouteErrorFallbackProps) {
  const { t } = useTranslation(["errors", "common"]);
  const error = useRouteError();
  const location = useLocation();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (error instanceof Error) {
      console.error("[RouteErrorFallback]", {
        route: location.pathname,
        name: error.name,
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });
    }
  }, [error, location.pathname]);

  const isRouteResponse = isRouteErrorResponse(error);
  const statusCode = isRouteResponse ? error.status : undefined;

  let title = t("errors:routeFallback.unexpectedTitle");
  let description = t("errors:routeFallback.unexpectedDesc");
  let technicalMessage = "";

  if (isRouteResponse) {
    if (error.status === 404) {
      title = t("errors:routeFallback.notFoundTitle");
      description = t("errors:routeFallback.notFoundDesc");
    } else if (error.status === 403) {
      title = t("errors:routeFallback.forbiddenTitle");
      description = t("errors:routeFallback.forbiddenDesc");
    } else if (error.status >= 500) {
      title = t("errors:routeFallback.serverTitle");
      description = t("errors:routeFallback.serverDesc");
    }
    technicalMessage =
      typeof error.data === "string"
        ? error.data
        : error.statusText || `HTTP ${error.status}`;
  } else if (error instanceof Error) {
    technicalMessage = error.message;
  } else if (typeof error === "string") {
    technicalMessage = error;
  }

  const handleRetry = () => {
    if (revalidator.state === "idle") {
      revalidator.revalidate();
    }
    navigate(0);
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex min-h-[70vh] w-full flex-1 items-center justify-center bg-background p-4 sm:p-6"
    >
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        {/* Eyebrow + Icon */}
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-5" aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {statusCode
                ? t("errors:routeFallback.httpError", { status: statusCode })
                : t("errors:routeFallback.applicationError")}
            </span>
            <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {title}
            </h1>
          </div>
        </div>

        {/* Supporting copy */}
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>

        {/* Primary & Secondary CTAs */}
        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <Button onClick={handleRetry} className="gap-2">
            <RotateCcw className="size-4" aria-hidden="true" />
            {t("common:states.retryAction")}
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(homePath)}
            className="gap-2"
          >
            <Home className="size-4" aria-hidden="true" />
            {t("errors:boundary.goHome")}
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="gap-2 text-muted-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t("common:actions.back")}
          </Button>
        </div>

        {/* Collapsible technical details */}
        {technicalMessage && (
          <div className="mt-6 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setShowDetails((prev) => !prev)}
              aria-expanded={showDetails}
              className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <span>{t("errors:routeFallback.technicalDetails")}</span>
              {showDetails ? (
                <ChevronUp className="size-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="size-4" aria-hidden="true" />
              )}
            </button>
            {showDetails && (
              <div className="mt-3 rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs text-foreground break-words">
                {technicalMessage}
              </div>
            )}
          </div>
        )}

        {/* Hard reload escape hatch */}
        <div className="mt-4 flex items-center justify-end">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <RefreshCw className="size-3" aria-hidden="true" />
            Hard reload page
          </button>
        </div>
      </div>
    </div>
  );
}
