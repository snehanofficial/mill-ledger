import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { PublicLayout } from "./public-layout";
import { BRAND_ENTITY } from "@/lib/public-routes";

export function AboutPage() {
  return (
    <PublicLayout>
      <section className="border-b border-border bg-card py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-4">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              About MillLedger
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed">
              {BRAND_ENTITY.description}
            </p>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-background">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
            <h2 className="text-xl font-bold text-foreground mb-4">
              Verified Product Profile
            </h2>
            <dl className="divide-y divide-border text-sm">
              <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <dt className="font-semibold text-foreground">Product Name</dt>
                <dd className="sm:col-span-2 text-muted-foreground">MillLedger</dd>
              </div>
              <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <dt className="font-semibold text-foreground">Category</dt>
                <dd className="sm:col-span-2 text-muted-foreground">{BRAND_ENTITY.category}</dd>
              </div>
              <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <dt className="font-semibold text-foreground">Intended Users</dt>
                <dd className="sm:col-span-2 text-muted-foreground">
                  Small food manufacturing mills in India (Owners, Admins, Production Supervisors, Field Salesmen, and Accountants)
                </dd>
              </div>
              <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <dt className="font-semibold text-foreground">Architecture</dt>
                <dd className="sm:col-span-2 text-muted-foreground">
                  TypeScript modular monolith: React 19 + Vite PWA + Tailwind CSS 4 + TanStack Query + Dexie IndexedDB on the client; Express 5 + Better Auth + Prisma 7 + PostgreSQL on the server
                </dd>
              </div>
              <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <dt className="font-semibold text-foreground">Languages Supported</dt>
                <dd className="sm:col-span-2 text-muted-foreground">
                  English and Tamil (தமிழ்) across operational navigation and outbox sync
                </dd>
              </div>
              <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <dt className="font-semibold text-foreground">Contact</dt>
                <dd className="sm:col-span-2 text-muted-foreground">{BRAND_ENTITY.contactEmail}</dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/demo"
              className={buttonVariants({ variant: "primary", className: "min-h-[44px] px-6" })}
            >
              Request a Live Demo
            </Link>
            <Link
              to="/features"
              className={buttonVariants({ variant: "outline", className: "min-h-[44px] px-6" })}
            >
              View Implemented Modules
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
