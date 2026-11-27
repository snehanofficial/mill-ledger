/**
 * Utilities for capturing and restoring form input state across session expiration
 * and unexpected authentication timeouts.
 *
 * Implements WCAG 2.2 SC 3.3.7 (Redundant Entry - Level AA) and
 * WCAG 2.2 SC 2.2.1 (Timing Adjustable - Level A).
 */

export interface SavedFormDraft {
  pathname: string;
  savedAt: number;
  draft: Record<string, string | number | boolean>;
}

/**
 * Serializes all user inputs (input, select, textarea) in the current DOM view
 * into sessionStorage keyed by the current route pathname.
 */
export function saveActiveFormDraft(pathname: string): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;

  try {
    const formElements = document.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input:not([type=password]):not([type=hidden]), select, textarea");

    const draft: Record<string, string | number | boolean> = {};

    formElements.forEach((el) => {
      const key = el.id || el.name;
      if (!key) return;

      if ((el as HTMLInputElement).type === "checkbox") {
        draft[key] = (el as HTMLInputElement).checked;
      } else if (el.value !== "") {
        draft[key] = el.value;
      }
    });

    if (Object.keys(draft).length > 0) {
      const payload: SavedFormDraft = {
        pathname,
        savedAt: Date.now(),
        draft,
      };
      window.sessionStorage.setItem(
        `millledger:form_draft:${pathname}`,
        JSON.stringify(payload),
      );
    }
  } catch (err) {
    console.warn("Failed to serialize form draft to sessionStorage:", err);
  }
}

/**
 * Retrieves saved draft values for a given route pathname.
 */
export function getSavedFormDraft(
  pathname: string,
): Record<string, string | number | boolean> | null {
  if (typeof window === "undefined" || !window.sessionStorage) return null;

  try {
    const raw = window.sessionStorage.getItem(
      `millledger:form_draft:${pathname}`,
    );
    if (!raw) return null;
    const parsed: SavedFormDraft = JSON.parse(raw);
    return parsed.draft || null;
  } catch {
    return null;
  }
}

/**
 * Clears saved draft values for a given route pathname.
 */
export function clearFormDraft(pathname: string): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;

  try {
    window.sessionStorage.removeItem(`millledger:form_draft:${pathname}`);
  } catch {
    // ignore
  }
}
