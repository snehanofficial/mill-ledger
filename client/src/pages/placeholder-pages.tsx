import { useEffect } from "react";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  useEffect(() => {
    document.title = "Page Not Found | MillLedger";
  }, []);

  return (
    <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center p-8 text-center">
      <h1 className="text-2xl font-bold text-foreground">
        404 - Page Not Found
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The requested operational route does not exist.
      </p>
      <div className="mt-6">
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
