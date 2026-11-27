import { useTranslation } from "react-i18next";
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

export interface SessionTimeoutModalProps {
  isOpen: boolean;
  secondsRemaining: number;
  onExtend: () => void;
  onSignOut: () => void;
}

export function SessionTimeoutModal({
  isOpen,
  secondsRemaining,
  onExtend,
  onSignOut,
}: SessionTimeoutModalProps) {
  const { t } = useTranslation("common");
  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const formattedDuration =
    mins > 0
      ? t("session.minutesSeconds", { mins, secs })
      : t("session.secondsOnly", { secs });

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
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
            <div className="rounded-full bg-amber-500/10 p-2 shrink-0">
              <ClockIcon className="size-5" aria-hidden="true" />
            </div>
            <DialogTitle className="text-base font-bold text-foreground">
              {t("session.expiringTitle")}
            </DialogTitle>
          </div>
          <DialogDescription
            id="session-timeout-description"
            className="pt-3 text-sm text-muted-foreground leading-relaxed"
          >
            {t("session.expiringDesc", { duration: formattedDuration })}
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 flex items-center gap-2 rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300 border border-amber-500/20">
          <AlertTriangleIcon className="size-4 shrink-0" aria-hidden="true" />
          <span>{t("session.extendHint")}</span>
        </div>

        <DialogFooter className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onSignOut}>
            {t("session.signOutNow")}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onExtend}
            autoFocus
            className="font-semibold shadow-xs"
          >
            {t("session.staySignedIn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
