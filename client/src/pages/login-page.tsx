import * as React from "react";
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { useLanguage } from "@/lib/i18n";
import { LockIcon, MailIcon, ShieldCheckIcon } from "lucide-react";

interface SeedAccount {
  label: string;
  email: string;
  role: string;
  desc: string;
}

const SEED_ACCOUNTS: SeedAccount[] = [
  {
    label: "Admin / Owner",
    email: "admin@millledger.local",
    role: "ADMIN",
    desc: "Full access to inventory, finance & reports",
  },
  {
    label: "Salesman",
    email: "salesman@millledger.local",
    role: "SALESMAN",
    desc: "Field orders and client collections",
  },
  {
    label: "Accountant",
    email: "accountant@millledger.local",
    role: "ACCOUNTANT",
    desc: "Read-only audit, GST & receivables",
  },
  {
    label: "Floor Operator",
    email: "operator@millledger.local",
    role: "OPERATOR",
    desc: "Production runs & batch records",
  },
];

export function LoginPage() {
  const location = useLocation();
  const { language, setLanguage } = useLanguage();

  const [email, setEmail] = useState("admin@millledger.local");
  const [password, setPassword] = useState("AdminPassword123!");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      await authClient.signIn({ email, password });
      window.location.href = from;
    } catch (err: unknown) {
      setIsLoading(false);
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Authentication failed. Please verify credentials.");
      }
    }
  };

  const handleSelectSeed = (acc: SeedAccount) => {
    setEmail(acc.email);
    setPassword(
      acc.role === "ADMIN"
        ? "AdminPassword123!"
        : acc.role === "SALESMAN"
          ? "SalesmanPassword123!"
          : acc.role === "ACCOUNTANT"
            ? "AccountantPassword123!"
            : "OperatorPassword123!",
    );
    setErrorMessage(null);
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      {/* Top utility row: language switch */}
      <div className="absolute top-4 right-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLanguage(language === "en" ? "ta" : "en")}
          aria-label={language === "en" ? "Switch language to Tamil" : "ஆங்கிலத்திற்கு மாற்று"}
        >
          {language === "en" ? "தமிழ்" : "English"}
        </Button>
      </div>

      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center">
          <div className="inline-flex size-12 items-center justify-center rounded-control bg-primary text-primary-foreground shadow-xs">
            <ShieldCheckIcon className="size-6" aria-hidden="true" />
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
            {language === "ta" ? "ஆலை ஏடு உள்நுழைவு" : "Sign in to MillLedger"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {language === "ta"
              ? "உணவு பதப்படுத்தும் ஆலைக்கான உற்பத்தி மற்றும் கணக்குப்பதிவு"
              : "Food manufacturing & mill operations ledger"}
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">
              {language === "ta" ? "பயனர் அடையாளம்" : "Credentials"}
            </CardTitle>
            <CardDescription>
              {language === "ta"
                ? "உங்கள் ஆலை மின்னஞ்சல் மற்றும் கடவுச்சொல்லை உள்ளிடவும்"
                : "Enter your assigned mill email and password to proceed"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <Alert
                  variant="danger"
                  role="alert"
                  title={language === "ta" ? "உள்நுழைவு தோல்வியடைந்தது" : "Sign in failed"}
                >
                  {errorMessage}
                </Alert>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-foreground"
                >
                  {language === "ta" ? "மின்னஞ்சல்" : "Email address"}
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                    <MailIcon className="size-4" aria-hidden="true" />
                  </div>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    placeholder="user@millledger.local"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-foreground"
                >
                  {language === "ta" ? "கடவுச்சொல்" : "Password"}
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                    <LockIcon className="size-4" aria-hidden="true" />
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={isLoading}
                className="w-full text-base font-semibold"
              >
                {isLoading
                  ? language === "ta"
                    ? "சரிபார்க்கிறது..."
                    : "Authenticating..."
                  : language === "ta"
                    ? "உள்நுழைக"
                    : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Demo Fast-Switch Cards */}
        <div className="rounded-control border border-border bg-card p-4 text-xs">
          <p className="font-semibold text-foreground">
            {language === "ta" ? "சோதனை கணக்குகள் (Demo Roles):" : "Benchmark Demo Roles:"}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {SEED_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => handleSelectSeed(acc)}
                className={`rounded-control border p-2 text-left transition-colors cursor-pointer ${
                  email === acc.email
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-background hover:bg-muted text-foreground"
                }`}
              >
                <div className="font-medium">{acc.label}</div>
                <div className="truncate text-muted-foreground text-[11px]">{acc.email}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

