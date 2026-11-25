import { useEffect } from "react";
import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";

export function NotFoundPage() {
  useEffect(() => {
    document.title = "Page Not Found | MillLedger";
  }, []);

  return (
    <main className="flex min-h-[60vh] flex-1 flex-col items-center justify-center p-8 text-center">
      <h1 className="text-2xl font-bold text-foreground">
        404 - Page Not Found
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The requested operational route does not exist.
      </p>
      <div className="mt-6">
        <Link
          to="/"
          className={buttonVariants({ variant: "primary" })}
        >
          Return Home
        </Link>
      </div>
    </main>
  );
}
