import { useSearchParams } from "react-router-dom";
import { useCallback, useMemo } from "react";

export interface UseUrlStateOptions {
  /** If true (default), replaces the current history entry instead of pushing a new one */
  replace?: boolean;
}

/**
 * Custom hook to synchronize a state variable with a URL search parameter.
 * Maintains full browser URL compatibility, deep-linking, bookmarking,
 * and back/forward navigation (NN/g H3, NN/g H4, Phase 7 Spec Check 4).
 *
 * @param key The URL search parameter key (e.g. "tab", "status", "q")
 * @param defaultValue The fallback default value when parameter is absent
 * @param options Configuration options such as history replace behavior
 */
export function useUrlState<T extends string = string>(
  key: string,
  defaultValue: string = "",
  options: UseUrlStateOptions = { replace: true }
): [T, (newValue: T | string | ((prev: T) => T)) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const value = useMemo(() => {
    const param = searchParams.get(key);
    return (param !== null ? param : defaultValue) as T;
  }, [searchParams, key, defaultValue]);

  const setValue = useCallback(
    (newValue: T | string | ((prev: T) => T)) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const currentVal = ((next.get(key) as T) ?? defaultValue) as T;
          const resolved =
            typeof newValue === "function"
              ? (newValue as (prev: T) => T)(currentVal)
              : newValue;

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
        { replace: options.replace ?? true }
      );
    },
    [key, defaultValue, setSearchParams, options.replace]
  );

  return [value, setValue];
}
