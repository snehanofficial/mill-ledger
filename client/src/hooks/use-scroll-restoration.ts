import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// In-memory cache of container scroll positions keyed by router location key
export const scrollPositions = new Map<string, number>();

/**
 * useScrollRestoration
 *
 * Ensures proper scroll position handling for internal scrollable containers (e.g. #main-content)
 * across SPA client-side route transitions (WCAG 2.2 & Master Rulebook Phase 9 / F-069):
 * 1. On PUSH or REPLACE navigation (when pathname or hash changes): Resets container.scrollTop = 0 (or scrolls to hash anchor).
 * 2. On POP navigation (browser Back / Forward buttons): Restores previous scroll position for that history entry.
 * 3. Actively listens to scroll events to snapshot vertical offset without re-subscribing on query-param changes.
 */
export function useScrollRestoration(containerId: string = "main-content") {
  const location = useLocation();
  const navigationType = useNavigationType();
  const locationKeyRef = useRef(location.key);
  const prevPathnameRef = useRef(location.pathname);
  const prevHashRef = useRef(location.hash);

  useEffect(() => {
    locationKeyRef.current = location.key;
  }, [location.key]);

  // Track scroll position on container without tearing down listener on every query update
  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const handleScroll = () => {
      scrollPositions.set(locationKeyRef.current, container.scrollTop);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [containerId]);

  // Handle route transition scroll reset or restoration
  useEffect(() => {
    const pathnameChanged = prevPathnameRef.current !== location.pathname;
    const hashChanged = prevHashRef.current !== location.hash;
    prevPathnameRef.current = location.pathname;
    prevHashRef.current = location.hash;

    const container = document.getElementById(containerId);
    if (!container) return;

    if (navigationType === "POP") {
      const savedPosition = scrollPositions.get(location.key) ?? 0;
      const applyScroll = () => {
        if (container.scrollTop !== savedPosition) {
          container.scrollTop = savedPosition;
        }
      };

      applyScroll();
      // Second tick via requestAnimationFrame for dynamically rendered / suspended content
      const frameId = requestAnimationFrame(applyScroll);
      return () => cancelAnimationFrame(frameId);
    }

    // PUSH or REPLACE: skip scroll reset when only search/query params changed on the same route
    if (!pathnameChanged && !hashChanged) {
      return;
    }

    if (location.hash) {
      const targetId = location.hash.replace(/^#/, "");
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        targetElement.scrollIntoView();
        return;
      }
    }

    if (container.scrollTop !== 0) {
      container.scrollTop = 0;
    }
    if (window.scrollY !== 0) {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [
    containerId,
    location.key,
    location.pathname,
    location.hash,
    navigationType,
  ]);
}
