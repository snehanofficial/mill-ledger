import { useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface UseUrlStateOptions {
  /** If true (default), replaces the current history entry instead of pushing a new one */
  replace?: boolean;
  /** Optional debounce delay (ms) before syncing changes to URL search params */
  debounceMs?: number;
}

/**
 * Custom hook to synchronize a state variable with a URL search parameter.
 * Maintains full browser URL compatibility, deep-linking, bookmarking,
 * and back/forward navigation (NN/g H3, NN/g H4, Phase 7 Spec Check 4).
 *
 * @param key The URL search parameter key (e.g. "tab", "status", "q")
 * @param defaultValue The fallback default value when parameter is absent
 * @param options Configuration options such as history replace behavior and debounce
 */
export function useUrlState<T extends string = string>(
  key: string,
  defaultValue: string = "",
  options: UseUrlStateOptions = { replace: true },
): [T, (newValue: T | string | ((prev: T) => T)) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const debounceMs = options.debounceMs ?? 0;
  const replace = options.replace ?? true;

  const urlValue = useMemo(() => {
    const param = searchParams.get(key);
    return (param !== null ? param : defaultValue) as T;
  }, [searchParams, key, defaultValue]);

  const [localValue, setLocalValue] = useState<T>(urlValue);
  const localValueRef = useRef<T>(localValue);
  const prevUrlValueRef = useRef<T>(urlValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local buffer when URL changes externally (e.g. back/forward navigation)
  useEffect(() => {
    if (prevUrlValueRef.current !== urlValue) {
      prevUrlValueRef.current = urlValue;
      localValueRef.current = urlValue;
      setLocalValue(urlValue);
    }
  }, [urlValue]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const commitToUrl = useCallback(
    (resolved: T) => {
      setSearchParams(
        (prev) => {
          const current = (prev.get(key) ?? defaultValue) as T;
          if (current === resolved) return prev;
          const next = new URLSearchParams(prev);
          if (
            resolved === defaultValue ||
            resolved === "" ||
            resolved === undefined ||
            resolved === null
          ) {
            next.delete(key);
          } else {
            next.set(key, resolved);
          }
          return next;
        },
        { replace },
      );
    },
    [key, defaultValue, setSearchParams, replace],
  );

  const setValue = useCallback(
    (newValue: T | string | ((prev: T) => T)) => {
      if (debounceMs > 0) {
        const resolved = (
          typeof newValue === "function"
            ? (newValue as (prev: T) => T)(localValueRef.current)
            : newValue
        ) as T;
        localValueRef.current = resolved;
        setLocalValue(resolved);

        if (timerRef.current !== null) {
          clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          prevUrlValueRef.current = resolved;
          commitToUrl(resolved);
        }, debounceMs);
        return;
      }

      setSearchParams(
        (prev) => {
          const currentVal = ((prev.get(key) as T) ?? defaultValue) as T;
          const resolved =
            typeof newValue === "function"
              ? (newValue as (prev: T) => T)(currentVal)
              : newValue;
          if (currentVal === resolved) return prev;

          const next = new URLSearchParams(prev);
          if (
            resolved === defaultValue ||
            resolved === "" ||
            resolved === undefined ||
            resolved === null
          ) {
            next.delete(key);
          } else {
            next.set(key, resolved);
          }
          return next;
        },
        { replace },
      );
    },
    [debounceMs, commitToUrl, setSearchParams, key, defaultValue, replace],
  );

  return [debounceMs > 0 ? localValue : urlValue, setValue];
}
