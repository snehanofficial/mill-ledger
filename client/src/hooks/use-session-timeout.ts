import { useState, useEffect, useCallback, useRef } from "react";
import { authClient } from "@/lib/auth-client";

export interface SessionTimeoutOptions {
  /**
   * Total idle duration in ms before full session timeout.
   * Defaults to 15 minutes (900,000 ms).
   */
  timeoutMs?: number;
  /**
   * Remaining time in ms at which the warning dialog opens.
   * Defaults to 2 minutes (120,000 ms per WCAG 2.2 SC 2.2.1 minimum 20s).
   */
  warningThresholdMs?: number;
  /**
   * Callback invoked when session times out after warning countdown reaches 0.
   */
  onTimeout: () => void;
}

export interface SessionTimeoutReturn {
  isWarningOpen: boolean;
  secondsRemaining: number;
  extendSession: () => Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000; // 15 mins
const DEFAULT_WARNING_THRESHOLD_MS = 2 * 60 * 1000; // 2 mins

export function useSessionTimeout({
  timeoutMs = DEFAULT_TIMEOUT_MS,
  warningThresholdMs = DEFAULT_WARNING_THRESHOLD_MS,
  onTimeout,
}: SessionTimeoutOptions): SessionTimeoutReturn {
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(
    Math.round(warningThresholdMs / 1000),
  );

  const lastActivityRef = useRef<number>(0);
  const isWarningOpenRef = useRef<boolean>(false);
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    isWarningOpenRef.current = isWarningOpen;
  }, [isWarningOpen]);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  const extendSession = useCallback(async () => {
    try {
      // Re-hydrate session with server
      await authClient.getSession();
    } catch {
      // ignore
    }
    lastActivityRef.current = Date.now();
    setIsWarningOpen(false);
  }, []);

  // Monitor idle state and warning countdown
  useEffect(() => {
    lastActivityRef.current = Date.now();

    const handleUserActivity = () => {
      // Only reset timer if warning is not currently blocking the screen
      if (!isWarningOpenRef.current) {
        lastActivityRef.current = Date.now();
      }
    };

    const events = ["mousedown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    });

    const checkInterval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastActivityRef.current;
      const remainingMs = timeoutMs - elapsed;

      if (remainingMs <= 0) {
        setIsWarningOpen(false);
        onTimeoutRef.current();
      } else if (remainingMs <= warningThresholdMs) {
        const remainingSec = Math.max(1, Math.round(remainingMs / 1000));
        setSecondsRemaining(remainingSec);
        if (!isWarningOpenRef.current) {
          setIsWarningOpen(true);
        }
      } else {
        if (isWarningOpenRef.current) {
          setIsWarningOpen(false);
        }
      }
    }, 1000);

    // Support test simulation events
    const handleSimulateWarning = () => {
      lastActivityRef.current = Date.now() - (timeoutMs - 30 * 1000); // 30s remaining
      setSecondsRemaining(30);
      setIsWarningOpen(true);
    };

    const handleSimulateTimeout = () => {
      setIsWarningOpen(false);
      onTimeoutRef.current();
    };

    window.addEventListener("millledger:simulate-session-warning", handleSimulateWarning);
    window.addEventListener("millledger:simulate-session-timeout", handleSimulateTimeout);

    return () => {
      clearInterval(checkInterval);
      events.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity);
      });
      window.removeEventListener(
        "millledger:simulate-session-warning",
        handleSimulateWarning,
      );
      window.removeEventListener(
        "millledger:simulate-session-timeout",
        handleSimulateTimeout,
      );
    };
  }, [timeoutMs, warningThresholdMs]);

  return {
    isWarningOpen,
    secondsRemaining,
    extendSession,
  };
}
