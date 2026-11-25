import * as React from "react";
import { useState } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import {
  useCurrentUser,
  AUTH_SESSION_QUERY_KEY,
  mapAuthUserToShellUser,
} from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { useLanguage } from "@/lib/i18n";
import { getDefaultRouteForRole } from "@/lib/role-routing";
import {
  LockIcon,
  MailIcon,
  EyeIcon,
  EyeOffIcon,
} from "lucide-react";
import { BrandLogo } from "@/components/ui/brand-logo";

const CURRENT_YEAR = new Date().getFullYear();

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

/**
 * OWASP Open Redirect validation.
 * Ensures destination is a local relative URL, denying external schemes and protocol-relative '//'.
 */
function getSafeRedirectUrl(target: unknown, fallback = "/dashboard"): string {
  if (typeof target !== "string") return fallback;
  const trimmed = target.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/auth/")
  ) {
    return fallback;
  }
  return trimmed;
}

export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { language, setLanguage } = useLanguage();

  React.useEffect(() => {
    document.title = "Sign In | MillLedger";
  }, []);

  const { user, isLoading: isCheckingAuth } = useCurrentUser();

  const [email, setEmail] = useState("admin@millledger.local");
  const [password, setPassword] = useState("AdminPassword123!");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const isSessionExpired = Boolean(
    (location.state as { sessionExpired?: boolean })?.sessionExpired,
  );

  // Derive target return URL with open-redirect protection
  const rawFrom = (
    location.state as { from?: { pathname: string; search?: string } }
  )?.from;
  const fromPath = rawFrom
    ? `${rawFrom.pathname}${rawFrom.search || ""}`
    : null;
  const userDefaultRoute = user
    ? getDefaultRouteForRole(user.role)
    : "/dashboard";
  const safeFrom = fromPath
    ? getSafeRedirectUrl(fromPath, userDefaultRoute)
    : userDefaultRoute;

  // If user is already authenticated, redirect to destination immediately ("vice versa if authenticated")
  if (user) {
    return <Navigate to={safeFrom} replace />;
  }

  // Loading skeleton while checking existing session to avoid form flash
  if (isCheckingAuth) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    const nextFieldErrors: { email?: string; password?: string } = {};

    if (!cleanEmail) {
      nextFieldErrors.email =
        language === "ta" ? "மின்னஞ்சல் தேவை" : "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      nextFieldErrors.email =
        language === "ta"
          ? "சரியான மின்னஞ்சலை உள்ளிடவும்"
          : "Enter a valid email address";
    }

    if (!password) {
      nextFieldErrors.password =
        language === "ta" ? "கடவுச்சொல் தேவை" : "Password is required";
    }

    if (nextFieldErrors.email || nextFieldErrors.password) {
      setFieldErrors(nextFieldErrors);
      setErrorMessage(
        language === "ta"
          ? "மின்னஞ்சல் மற்றும் கடவுச்சொல் தேவை"
          : "Email and password are required",
      );
      if (nextFieldErrors.email) {
        document.getElementById("email")?.focus();
      } else if (nextFieldErrors.password) {
        document.getElementById("password")?.focus();
      }
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const authUser = await authClient.signIn({
        email: cleanEmail,
        password,
      });

      const shellUser = mapAuthUserToShellUser(authUser);
      // Update TanStack query cache with authenticated user
      queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, shellUser);

      // Navigate to safe destination (respecting user role workspace if no explicit from route)
      const targetDefault = getDefaultRouteForRole(shellUser.role);
      const destination = fromPath
        ? getSafeRedirectUrl(fromPath, targetDefault)
        : targetDefault;
      navigate(destination, { replace: true });
    } catch (err: unknown) {
      setIsSubmitting(false);
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(
          language === "ta"
            ? "உள்நுழைவு தோல்வியடைந்தது. சரியான விவரங்களை உள்ளிடவும்."
            : "Authentication failed. Please verify credentials.",
        );
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
    <main
      id="main-content"
      role="main"
      className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8"
    >
      {/* Top utility row: language switch */}
      <div className="absolute top-4 right-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLanguage(language === "en" ? "ta" : "en")}
          aria-label={
            language === "en"
              ? "தமிழ் (Switch language to Tamil)"
              : "English (ஆங்கிலத்திற்கு மாற்று)"
          }
        >
          <span lang={language === "en" ? "ta" : "en"}>
            {language === "en" ? "தமிழ்" : "English"}
          </span>
        </Button>
      </div>

      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center">
          <BrandLogo size="lg" className="mx-auto shadow-xs" />
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
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {errorMessage && (
                <Alert
                  variant="danger"
                  role="alert"
                  title={
                    language === "ta"
                      ? "உள்நுழைவு தோல்வியடைந்தது"
                      : "Sign in failed"
                  }
                >
                  {errorMessage}
                </Alert>
              )}

              {isSessionExpired && !errorMessage && (
                <Alert
                  variant="warning"
                  role="status"
                  title={
                    language === "ta" ? "அமர்வு காலாவதியானது" : "Session Expired"
                  }
                >
                  {language === "ta"
                    ? "செயலற்ற தன்மை காரணமாக உங்கள் அமர்வு காலாவதியானது. உங்கள் வேலையைத் தொடர மீண்டும் உள்நுழையவும்."
                    : "Your session expired due to inactivity. Please sign in to resume your work."}
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label
                  htmlFor="email"
                  className="block text-sm font-medium text-foreground"
                >
                  {language === "ta" ? "மின்னஞ்சல்" : "Email address"}
                </Label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                    <MailIcon className="size-4" aria-hidden="true" />
                  </div>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? "email-error" : undefined}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) {
                        setFieldErrors((prev) => ({ ...prev, email: undefined }));
                      }
                      if (errorMessage) setErrorMessage(null);
                    }}
                    className="pl-9"
                    placeholder="user@millledger.local"
                  />
                </div>
                {fieldErrors.email && (
                  <p id="email-error" className="text-xs font-medium text-destructive">
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="password"
                  className="block text-sm font-medium text-foreground"
                >
                  {language === "ta" ? "கடவுச்சொல்" : "Password"}
                </Label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                    <LockIcon className="size-4" aria-hidden="true" />
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={fieldErrors.password ? "password-error" : undefined}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) {
                        setFieldErrors((prev) => ({ ...prev, password: undefined }));
                      }
                      if (errorMessage) setErrorMessage(null);
                    }}
                    className="pl-9 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-none rounded-sm"
                    aria-pressed={showPassword}
                    aria-label={
                      showPassword
                        ? language === "ta"
                          ? "கடவுச்சொல்லை மறை"
                          : "Hide password"
                        : language === "ta"
                          ? "கடவுச்சொல்லைக் காட்டு"
                          : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOffIcon className="size-4" aria-hidden="true" />
                    ) : (
                      <EyeIcon className="size-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p id="password-error" className="text-xs font-medium text-destructive">
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                className="w-full text-base font-semibold"
                aria-busy={isSubmitting}
                onPointerEnter={() => {
                  import("@/layouts/authenticated-layout");
                }}
                onFocus={() => {
                  import("@/layouts/authenticated-layout");
                }}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    {language === "ta" ? "சரிபார்க்கிறது..." : "Signing in..."}
                  </span>
                ) : language === "ta" ? (
                  "உள்நுழைக"
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Demo Fast-Switch Cards */}
        <div className="rounded-control border border-border bg-card p-4 text-xs">
          <p className="font-semibold text-foreground">
            {language === "ta" ? (
              <>
                சோதனை கணக்குகள் (<span lang="en">Demo Roles</span>):
              </>
            ) : (
              "Benchmark Demo Roles:"
            )}
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
                <div className="font-medium" lang="en">
                  {acc.label}
                </div>
                <div
                  className="truncate text-muted-foreground text-[11px]"
                  lang="en"
                >
                  {acc.email}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Semantic Footer Landmark with Navigational Links */}
        <footer className="pt-2 text-center text-xs text-muted-foreground">
          <p lang="en">© {CURRENT_YEAR} MillLedger ERP. All rights reserved.</p>
          <div className="mt-2 flex justify-center gap-4">
            <a
              href="/auth/login"
              className="hover:text-foreground hover:underline"
            >
              {language === "ta" ? "உதவி மையம்" : "Support"}
            </a>
            <span aria-hidden="true">•</span>
            <a
              href="/auth/login"
              className="hover:text-foreground hover:underline"
            >
              {language === "ta" ? "தனியுரிமை கொள்கை" : "Privacy Policy"}
            </a>
            <span aria-hidden="true">•</span>
            <a
              href="/auth/login"
              className="hover:text-foreground hover:underline"
            >
              {language === "ta" ? "விதிமுறைகள்" : "Terms"}
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
