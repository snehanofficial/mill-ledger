import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { PublicLayout } from "./public-layout";

const SECURITY_CONTROLS = [
  {
    title: "Session Authentication & Cookie Hygiene",
    detail:
      "User authentication runs through Better Auth with HttpOnly session cookies, explicit CORS origin validation, and immediate session revocation when an administrator deactivates a user account.",
  },
  {
    title: "Server-Side RBAC and ABAC Enforcement",
    detail:
      "Every protected API endpoint enforces Role-Based and Attribute-Based Access Control on the server. For example, salesmen can only view assigned customers and edit their own draft orders, while accountants have strictly read-only access.",
  },
  {
    title: "Immutable Posted Ledgers & Audit Trail",
    detail:
      "Posted invoices, dispatches, and production runs cannot be silently edited or deleted. Corrections use formal reversals, supplier debit notes, or customer credit notes, all recorded in an append-only audit log and 360-degree entity timeline.",
  },
  {
    title: "Transactional Integrity & Input Validation",
    detail:
      "All external API payloads are validated with Zod schemas. Stock movements, weighted average cost recalculations, reservations, and payment allocations execute inside PostgreSQL ACID transactions with row-level locking on sequence numbers.",
  },
  {
    title: "Private ERP Isolation from Search Engines",
    detail:
      "Authenticated ERP routes and backend API responses send noindex, nofollow directives and are disallowed in robots.txt. Real customer, supplier, and financial data are never exposed on public routes.",
  },
];

export function SecurityPage() {
  return (
    <PublicLayout>
      <section className="border-b border-border bg-card py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-4">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Security, Access Control, and Ledger Integrity
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed">
              MillLedger is designed so that financial, inventory, and customer
              records remain verifiable and access-controlled at the database
              and API layers.
            </p>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-background">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-6">
          {SECURITY_CONTROLS.map((ctrl) => (
            <div
              key={ctrl.title}
              className="rounded-xl border border-border bg-card p-6 space-y-2"
            >
              <h2 className="text-lg font-bold text-foreground">
                {ctrl.title}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {ctrl.detail}
              </p>
            </div>
          ))}

          <div className="rounded-xl border border-border bg-muted/30 p-6 space-y-2">
            <h2 className="text-base font-bold text-foreground">
              Compliance &amp; Certification Transparency
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              MillLedger implements role-based access control, Zod validation,
              Helmet security headers, and rate limiting in code. It does not
              claim external third-party audit certifications such as SOC 2 or
              ISO 27001.
            </p>
          </div>

          <div className="pt-2">
            <Link
              to="/contact"
              className={buttonVariants({
                variant: "primary",
                className: "min-h-[44px] px-6",
              })}
            >
              Ask a Technical Security Question
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
