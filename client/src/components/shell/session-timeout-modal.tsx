import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ClockIcon, AlertTriangleIcon } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export interface SessionTimeoutModalProps {
  isOpen: boolean;
  secondsRemaining: number;
  onExtend: () => void;
  onSignOut: () => void;
}

function formatDuration(seconds: number, lang: string): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (lang === "ta") {
    if (mins > 0) {
      return `${mins} நிமிடம் ${secs} வினாடிகள்`;
    }
    return `${secs} வினாடிகள்`;
  }

  if (mins > 0) {
    return `${mins} minute${mins > 1 ? "s" : ""} ${secs} second${secs !== 1 ? "s" : ""}`;
  }
  return `${secs} second${secs !== 1 ? "s" : ""}`;
}

export function SessionTimeoutModal({
  isOpen,
  secondsRemaining,
  onExtend,
  onSignOut,
}: SessionTimeoutModalProps) {
  const { language } = useLanguage();

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        // If dismissed via overlay/escape, assume user is active and extend
        if (!open) {
          onExtend();
        }
      }}
    >
      <DialogContent
        role="alertdialog"
        aria-describedby="session-timeout-description"
        className="max-w-md border-amber-500/30 bg-card p-6 shadow-2xl"
      >
        <DialogHeader>
          <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
            <div className="rounded-full bg-amber-500/10 p-2">
              <ClockIcon className="size-5" aria-hidden="true" />
            </div>
            <DialogTitle className="text-base font-bold text-foreground">
              {language === "ta"
                ? "அமர்வு காலாவதி எச்சரிக்கை"
                : "Session Expiration Warning"}
            </DialogTitle>
          </div>
          <DialogDescription
            id="session-timeout-description"
            className="pt-3 text-sm text-muted-foreground leading-relaxed"
          >
            {language === "ta" ? (
              <>
                செயலற்ற தன்மை காரணமாக உங்கள் அமர்வு இன்னும்{" "}
                <strong className="font-mono font-bold text-foreground">
                  {formatDuration(secondsRemaining, "ta")}
                </strong>
                -ல் முடிவடையும். உங்கள் படிவ உள்ளீடுகள் தானாகச் சேமிக்கப்படும்.
              </>
            ) : (
              <>
                Your session will expire in{" "}
                <strong className="font-mono font-bold text-foreground">
                  {formatDuration(secondsRemaining, "en")}
                </strong>{" "}
                due to inactivity. Current form inputs will be preserved as a
                draft.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 flex items-center gap-2 rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300 border border-amber-500/20">
          <AlertTriangleIcon className="size-4 shrink-0" aria-hidden="true" />
          <span>
            {language === "ta"
              ? "தொடர 'அமர்வை நீட்டிக்கவும்' பொத்தானை அழுத்தவும்."
              : "Press Enter or click 'Extend Session' to keep working."}
          </span>
        </div>

        <DialogFooter className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onSignOut}>
            {language === "ta" ? "இப்போது வெளியேறு" : "Log Out Now"}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onExtend}
            autoFocus
            className="font-semibold shadow-xs"
          >
            {language === "ta" ? "அமர்வை நீட்டிக்கவும்" : "Extend Session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
