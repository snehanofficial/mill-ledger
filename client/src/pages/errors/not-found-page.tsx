import { useEffect } from "react";
import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";

export function NotFoundPage() {
  useEffect(() => {
    document.title = "Page Not Found | MillLedger";
    let meta = document.querySelector(
      'meta[name="robots"]',
    ) as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    meta.content = "noindex, nofollow";
  }, []);

  return (
    <main className="flex min-h-[60vh] flex-1 flex-col items-center justify-center p-8 text-center">
      <h1 className="text-2xl font-bold text-foreground">
        404 - Page Not Found
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        The requested route does not exist. Return to the MillLedger home page
        or request a product walkthrough.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link to="/" className={buttonVariants({ variant: "primary" })}>
          Return Home
        </Link>
        <Link to="/features" className={buttonVariants({ variant: "outline" })}>
          Explore ERP Features
        </Link>
      </div>
    </main>
  );
}
