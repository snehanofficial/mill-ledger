import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "mill-ledger-motion-preference";

function getSystemPrefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useMotion() {
  const [isMotionPaused, setIsMotionPausedState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) return stored === "true";
    } catch {
      // localStorage unavailable (sandboxed / incognito)
    }
    return getSystemPrefersReducedMotion();
  });

  const applyMotionPreference = useCallback((paused: boolean) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (paused) {
      root.classList.add("motion-paused");
      root.setAttribute("data-reduce-motion", "true");
    } else {
      root.classList.remove("motion-paused");
      root.removeAttribute("data-reduce-motion");
    }
  }, []);

  const setMotionPaused = useCallback(
    (paused: boolean) => {
      setIsMotionPausedState(paused);
      try {
        localStorage.setItem(STORAGE_KEY, String(paused));
      } catch {
        // localStorage unavailable
      }
      applyMotionPreference(paused);
    },
    [applyMotionPreference]
  );

  const toggleMotion = useCallback(() => {
    setMotionPaused(!isMotionPaused);
  }, [isMotionPaused, setMotionPaused]);

  useEffect(() => {
    applyMotionPreference(isMotionPaused);

    if (typeof window !== "undefined" && window.matchMedia) {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      const listener = (e: MediaQueryListEvent) => {
        try {
          if (localStorage.getItem(STORAGE_KEY) === null) {
            setIsMotionPausedState(e.matches);
            applyMotionPreference(e.matches);
          }
        } catch {
          // ignore
        }
      };
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    }
  }, [isMotionPaused, applyMotionPreference]);

  return { isMotionPaused, setMotionPaused, toggleMotion };
}
