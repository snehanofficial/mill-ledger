import * as React from "react";
import { Select as SelectPrimitive } from "radix-ui";
import { CheckIcon, ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface SelectSearchContextValue {
  searchable: boolean;
  searchQuery: string;
}

const SelectSearchContext = React.createContext<SelectSearchContextValue>({
  searchable: false,
  searchQuery: "",
});

function extractText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join(" ");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractText(node.props.children);
  }
  return "";
}

function Select(props: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex h-11 w-full items-center justify-between gap-2 rounded-control border border-input/45 dark:border-input bg-surface-muted/70 dark:bg-surface-muted px-4 py-2 text-sm text-foreground shadow-xs outline-none transition-colors",
        "hover:border-foreground/40 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/30",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectValue(
  props: React.ComponentProps<typeof SelectPrimitive.Value>,
) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

interface SelectContentProps
  extends React.ComponentProps<typeof SelectPrimitive.Content> {
  searchable?: boolean;
  searchPlaceholder?: string;
  searchEmptyMessage?: string;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
}

function isCoarsePointer() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

function SelectContent({
  className,
  children,
  position = "popper",
  searchable = false,
  searchPlaceholder = "Search...",
  searchEmptyMessage = "No matching options.",
  emptyMessage = "No options available.",
  emptyAction,
  ...props
}: SelectContentProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const hasRedirectedInitialFocusRef = React.useRef(false);

  React.useEffect(() => {
    if (!searchable || isCoarsePointer()) return;
    hasRedirectedInitialFocusRef.current = false;
    const focusInput = () => inputRef.current?.focus({ preventScroll: true });
    focusInput();
    const frameId = requestAnimationFrame(focusInput);
    return () => cancelAnimationFrame(frameId);
  }, [searchable]);

  const contextValue = React.useMemo(
    () => ({ searchable, searchQuery }),
    [searchable, searchQuery],
  );

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      const firstVisible = viewportRef.current?.querySelector<HTMLElement>(
        '[data-slot="select-item"]:not([hidden]):not([data-disabled])',
      );
      firstVisible?.focus();
      return;
    }
    e.stopPropagation();
  };

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        onFocus={(e) => {
          props.onFocus?.(e);
          if (!searchable || isCoarsePointer()) return;
          if (e.target === inputRef.current) return;
          if (!hasRedirectedInitialFocusRef.current || e.target === e.currentTarget) {
            hasRedirectedInitialFocusRef.current = true;
            inputRef.current?.focus({ preventScroll: true });
          }
        }}
        className={cn(
          "z-50 flex max-h-[min(18rem,var(--radix-select-content-available-height))] min-w-32 max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-control border border-border bg-popover text-popover-foreground shadow-menu",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[state=open]:duration-(--ml-motion-standard) data-[state=open]:ease-enter data-[state=closed]:duration-(--ml-motion-fast) data-[state=closed]:ease-exit",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
          className,
        )}
        {...props}
      >
        {searchable && (
          <search
            data-slot="select-search"
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="flex h-11 sm:h-10 shrink-0 items-center gap-2 border-b border-border px-3"
          >
            <SearchIcon
              aria-hidden="true"
              className="size-4 sm:size-3.5 shrink-0 text-muted-foreground"
            />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              className="h-full w-full bg-transparent text-base sm:text-xs text-foreground outline-none placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setSearchQuery("");
                  inputRef.current?.focus({ preventScroll: true });
                }}
                className="flex size-8 sm:size-5 shrink-0 cursor-pointer items-center justify-center rounded-small text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <XIcon aria-hidden="true" className="size-4 sm:size-3.5" />
              </button>
            )}
          </search>
        )}
        <SelectSearchContext.Provider value={contextValue}>
          <SelectPrimitive.Viewport
            ref={viewportRef}
            data-slot="select-viewport"
            className="max-h-60 overflow-y-auto p-1 [scrollbar-width:thin]"
          >
            {children}
            <div
              role="status"
              aria-live="polite"
              className="hidden flex-col items-center justify-center gap-2 px-3 py-4 text-center text-xs text-muted-foreground [[data-slot=select-viewport]:not(:has([data-slot=select-item]:not([hidden])))_&]:flex"
            >
              {searchable && searchQuery.trim().length > 0 ? (
                <>
                  <span>{searchEmptyMessage}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      inputRef.current?.focus({ preventScroll: true });
                    }}
                    className="inline-flex min-h-10 sm:min-h-7 cursor-pointer items-center justify-center rounded-small px-3 sm:px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    Clear search
                  </button>
                </>
              ) : (
                <>
                  <span>{emptyMessage}</span>
                  {emptyAction}
                </>
              )}
            </div>
          </SelectPrimitive.Viewport>
        </SelectSearchContext.Provider>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

interface SelectItemProps
  extends React.ComponentProps<typeof SelectPrimitive.Item> {
  keywords?: string;
}

function SelectItem({
  className,
  children,
  keywords,
  disabled,
  ...props
}: SelectItemProps) {
  const { searchable, searchQuery } = React.useContext(SelectSearchContext);

  const isMatch = React.useMemo(() => {
    if (!searchable) return true;
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return true;
    const labelText = extractText(children).toLowerCase();
    const extraText = keywords ? keywords.toLowerCase() : "";
    return labelText.includes(normalizedQuery) || extraText.includes(normalizedQuery);
  }, [searchable, searchQuery, children, keywords]);

  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      hidden={!isMatch}
      disabled={disabled || !isMatch}
      className={cn(
        "relative flex min-h-11 sm:min-h-9 cursor-pointer items-center rounded-small pr-8 pl-3 py-2 sm:py-1.5 text-sm outline-none transition-colors select-none",
        "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        !isMatch && "hidden",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2 flex items-center justify-center">
        <CheckIcon className="size-4 text-primary" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
