import type React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircleIcon } from "lucide-react";
import {
  DOMAIN_GLOSSARY,
  type DomainGlossaryKey,
} from "@/lib/domain-glossary";

export interface DomainTooltipProps {
  term?: DomainGlossaryKey;
  explanation?: string;
  children: React.ReactNode;
  className?: string;
}

export function DomainTooltip({
  term,
  explanation,
  children,
  className = "",
}: DomainTooltipProps) {
  const content = explanation || (term ? DOMAIN_GLOSSARY[term] : "");

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-1 cursor-help border-b border-dotted border-muted-foreground/60 focus:outline-hidden focus:ring-1 focus:ring-primary ${className}`}
            tabIndex={0}
            role="button"
            aria-label={`${typeof children === "string" ? children : "Domain term"}: ${content}`}
          >
            {children}
            <HelpCircleIcon
              className="h-3 w-3 text-muted-foreground shrink-0 opacity-70 hover:opacity-100"
              aria-hidden="true"
            />
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs text-xs p-2.5 leading-relaxed bg-popover text-popover-foreground border shadow-lg"
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
