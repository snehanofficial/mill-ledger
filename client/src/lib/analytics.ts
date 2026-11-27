const ATTRIBUTION_STORAGE_KEY = "mill_ledger_attribution_v1";

export interface AttributionSnapshot {
  landingPath: string;
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  capturedAt: string;
}

const AI_REFERRER_HOSTS = [
  "chatgpt.com",
  "chat.openai.com",
  "perplexity.ai",
  "gemini.google.com",
  "copilot.microsoft.com",
  "claude.ai",
];

export function classifyReferrerChannel(referrer: string): string {
  if (!referrer) return "direct";
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    if (AI_REFERRER_HOSTS.some((aiHost) => host === aiHost || host.endsWith(`.${aiHost}`))) {
      return "ai_search";
    }
    if (
      host.includes("google.") ||
      host.includes("bing.com") ||
      host.includes("duckduckgo.com") ||
      host.includes("yahoo.com")
    ) {
      return "organic_search";
    }
    return "referral";
  } catch {
    return "direct";
  }
}

export function captureAttributionOnce(): AttributionSnapshot | null {
  if (typeof window === "undefined") return null;

  try {
    const existingRaw = sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (existingRaw) {
      return JSON.parse(existingRaw) as AttributionSnapshot;
    }

    const params = new URLSearchParams(window.location.search);
    const snapshot: AttributionSnapshot = {
      landingPath: window.location.pathname,
      referrer: document.referrer || "",
      utmSource: params.get("utm_source") || "",
      utmMedium: params.get("utm_medium") || "",
      utmCampaign: params.get("utm_campaign") || "",
      capturedAt: new Date().toISOString(),
    };

    sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(snapshot));
    return snapshot;
  } catch {
    return null;
  }
}

export function trackPublicEvent(
  eventName: string,
  payload: Record<string, string | undefined>,
): void {
  if (typeof window === "undefined") return;

  // Integration hook for owner-configured analytics (e.g. GA4 gtag or Plausible).
  // No tracking IDs are hardcoded; events only forward if the host script is configured.
  const win = window as unknown as {
    gtag?: (...args: unknown[]) => void;
    plausible?: (name: string, opts?: { props?: Record<string, string | undefined> }) => void;
  };

  if (typeof win.gtag === "function") {
    win.gtag("event", eventName, payload);
  }
  if (typeof win.plausible === "function") {
    win.plausible(eventName, { props: payload });
  }
}
