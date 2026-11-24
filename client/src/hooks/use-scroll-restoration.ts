import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// In-memory cache of container scroll positions keyed by router location key
export const scrollPositions = new Map<string, number>();

/**
 * useScrollRestoration
 *
 * Ensures proper scroll position handling for internal scrollable containers (e.g. #main-content)
 * across SPA client-side route transitions (WCAG 2.2 & Master Rulebook Phase 9 / F-069):
 * 1. On PUSH or REPLACE navigation: Resets container.scrollTop = 0 (or scrolls to hash anchor).
 * 2. On POP navigation (browser Back / Forward buttons): Restores previous scroll position for that history entry.
 * 3. Actively listens to scroll events to snapshot vertical offset.
 */
export function useScrollRestoration(containerId: string = "main-content") {
  const location = useLocation();
  const navigationType = useNavigationType();

  // Track scroll position on container
  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const handleScroll = () => {
      scrollPositions.set(location.key, container.scrollTop);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [containerId, location.key]);

  // Handle route transition scroll reset or restoration
  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (navigationType === "POP") {
      const savedPosition = scrollPositions.get(location.key) ?? 0;
      const applyScroll = () => {
        container.scrollTop = savedPosition;
        if (typeof container.scrollTo === "function") {
          container.scrollTo({ top: savedPosition, behavior: "instant" });
        }
      };

      applyScroll();
      // Second tick via requestAnimationFrame for dynamically rendered / suspended content
      const frameId = requestAnimationFrame(applyScroll);
      return () => cancelAnimationFrame(frameId);
    } else {
      // PUSH or REPLACE
      if (location.hash) {
        const targetId = location.hash.replace(/^#/, "");
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
          targetElement.scrollIntoView();
          return;
        }
      }

      container.scrollTop = 0;
      if (typeof container.scrollTo === "function") {
        container.scrollTo({ top: 0, behavior: "instant" });
      }
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [containerId, location.key, location.hash, navigationType]);
}
