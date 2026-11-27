import { GlobeIcon, CheckIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@mill-ledger/shared";
import { useLanguage, LangPart } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface LanguageSelectorProps {
  variant?: "compact" | "segmented" | "menu-item";
  className?: string;
}

export function LanguageSelector({
  variant = "compact",
  className,
}: LanguageSelectorProps) {
  const { locale, setLocale } = useLanguage();
  const { t } = useTranslation("common");

  if (variant === "segmented") {
    return (
      <div
        role="group"
        aria-label={t("language.label")}
        className={cn(
          "inline-flex items-center rounded-control border border-border bg-muted/50 p-0.5",
          className,
        )}
      >
        {SUPPORTED_LOCALES.map((loc: SupportedLocale) => {
          const isActive = locale === loc;
          const info = LOCALE_LABELS[loc];
          return (
            <button
              key={loc}
              type="button"
              onClick={() => void setLocale(loc)}
              aria-pressed={isActive}
              lang={loc}
              className={cn(
                "min-h-[36px] min-w-[64px] rounded-small px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {info.native}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t("language.active", {
            language: LOCALE_LABELS[locale].native,
          })}
          className={cn(
            "min-h-[44px] gap-1.5 px-2.5 text-xs font-medium shrink-0",
            className,
          )}
        >
          <GlobeIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <LangPart lang={locale} className="whitespace-nowrap">
            {LOCALE_LABELS[locale].native}
          </LangPart>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t("language.label")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SUPPORTED_LOCALES.map((loc: SupportedLocale) => {
          const isActive = locale === loc;
          const info = LOCALE_LABELS[loc];
          return (
            <DropdownMenuItem
              key={loc}
              onClick={() => void setLocale(loc)}
              aria-checked={isActive}
              role="menuitemradio"
              className="flex items-center justify-between gap-2 min-h-[40px]"
            >
              <LangPart lang={loc} className="font-medium">
                {info.native}
              </LangPart>
              {isActive && (
                <CheckIcon className="size-4 text-primary shrink-0" aria-hidden />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
