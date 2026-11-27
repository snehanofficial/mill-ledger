import { useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  MailIcon,
  SendIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PublicLayout } from "./public-layout";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { captureAttributionOnce, trackPublicEvent } from "@/lib/analytics";
import { BRAND_ENTITY } from "@/lib/public-routes";

interface InquiryFormState {
  fullName: string;
  businessName: string;
  phone: string;
  email: string;
  inquiryType:
    | "product_demo"
    | "erp_evaluation"
    | "migration_from_spreadsheets"
    | "technical_questions";
  message: string;
}

function InquiryForm({
  defaultType,
}: {
  defaultType: InquiryFormState["inquiryType"];
}) {
  const location = useLocation();
  const [formData, setFormData] = useState<InquiryFormState>({
    fullName: "",
    businessName: "",
    phone: "",
    email: "",
    inquiryType: defaultType,
    message: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof InquiryFormState, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  const validate = (): boolean => {
    const nextErrors: Partial<Record<keyof InquiryFormState, string>> = {};
    if (formData.fullName.trim().length < 2) {
      nextErrors.fullName = "Full name is required (at least 2 characters).";
    }
    if (!/^[0-9+\s-]{10,15}$/.test(formData.phone.trim())) {
      nextErrors.phone = "Enter a valid 10-15 digit phone number.";
    }
    if (
      formData.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())
    ) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (formData.message.trim().length < 5) {
      nextErrors.message = "Please describe your mill operation or question.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const attribution = captureAttributionOnce();
      const response = await apiClient.post<{ referenceId: string }>("/public/inquiries", {
        ...formData,
        sourcePath: location.pathname,
        referrer: attribution?.referrer || "",
        utmSource: attribution?.utmSource || "",
        utmMedium: attribution?.utmMedium || "",
        utmCampaign: attribution?.utmCampaign || "",
      });

      trackPublicEvent("generate_lead", {
        inquiry_type: formData.inquiryType,
        source_path: location.pathname,
      });

      setSubmittedRef(response.data.referenceId);
      setFormData({
        fullName: "",
        businessName: "",
        phone: "",
        email: "",
        inquiryType: defaultType,
        message: "",
      });
    } catch (err) {
      setSubmitError(
        extractErrorMessage(
          err,
          "Unable to submit your request right now. Please try again.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedRef) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-success/30 bg-success/10 p-6 text-center space-y-3"
      >
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success text-success-foreground">
          <CheckCircle2Icon className="size-6" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-bold text-foreground">
          Request Received ({submittedRef})
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Thank you. Your inquiry has been recorded with reference{" "}
          <span className="font-mono font-semibold text-foreground">{submittedRef}</span>.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => setSubmittedRef(null)}
          className="min-h-[44px] cursor-pointer"
        >
          Submit Another Request
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {submitError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2"
        >
          <AlertCircleIcon className="size-4 shrink-0" aria-hidden="true" />
          <span>{submitError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="inquiry-fullname">Full Name *</Label>
          <Input
            id="inquiry-fullname"
            value={formData.fullName}
            onChange={(e) => {
              setFormData({ ...formData, fullName: e.target.value });
              if (errors.fullName) setErrors({ ...errors, fullName: undefined });
            }}
            aria-invalid={!!errors.fullName}
            aria-describedby={errors.fullName ? "error-fullname" : undefined}
            placeholder="e.g. S. Ramanathan"
            className="min-h-[44px]"
          />
          {errors.fullName && (
            <p id="error-fullname" className="text-xs text-destructive flex items-center gap-1">
              <AlertCircleIcon className="size-3" aria-hidden="true" />
              {errors.fullName}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="inquiry-business">Mill or Company Name</Label>
          <Input
            id="inquiry-business"
            value={formData.businessName}
            onChange={(e) =>
              setFormData({ ...formData, businessName: e.target.value })
            }
            placeholder="e.g. Sri Murugan Food Mills"
            className="min-h-[44px]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="inquiry-phone">Phone Number *</Label>
          <Input
            id="inquiry-phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => {
              setFormData({ ...formData, phone: e.target.value });
              if (errors.phone) setErrors({ ...errors, phone: undefined });
            }}
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? "error-phone" : undefined}
            placeholder="e.g. +91 98765 43210"
            className="min-h-[44px]"
          />
          {errors.phone && (
            <p id="error-phone" className="text-xs text-destructive flex items-center gap-1">
              <AlertCircleIcon className="size-3" aria-hidden="true" />
              {errors.phone}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="inquiry-email">Work Email</Label>
          <Input
            id="inquiry-email"
            type="email"
            value={formData.email}
            onChange={(e) => {
              setFormData({ ...formData, email: e.target.value });
              if (errors.email) setErrors({ ...errors, email: undefined });
            }}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "error-email" : undefined}
            placeholder="owner@yourmill.com"
            className="min-h-[44px]"
          />
          {errors.email && (
            <p id="error-email" className="text-xs text-destructive flex items-center gap-1">
              <AlertCircleIcon className="size-3" aria-hidden="true" />
              {errors.email}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="inquiry-type">Topic</Label>
        <Select
          value={formData.inquiryType}
          onValueChange={(value) =>
            setFormData({
              ...formData,
              inquiryType: value as InquiryFormState["inquiryType"],
            })
          }
        >
          <SelectTrigger id="inquiry-type" className="min-h-[44px]">
            <SelectValue placeholder="Select inquiry topic" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="product_demo">Request Live Product Demo</SelectItem>
            <SelectItem value="erp_evaluation">Food Mill ERP Evaluation</SelectItem>
            <SelectItem value="migration_from_spreadsheets">
              Migrating from Spreadsheets
            </SelectItem>
            <SelectItem value="technical_questions">
              Technical / Security / Deployment Question
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="inquiry-message">Your Mill Operation &amp; Questions *</Label>
        <Textarea
          id="inquiry-message"
          rows={4}
          value={formData.message}
          onChange={(e) => {
            setFormData({ ...formData, message: e.target.value });
            if (errors.message) setErrors({ ...errors, message: undefined });
          }}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? "error-message" : undefined}
          placeholder="Tell us what products you manufacture, how many users or field salesmen you have, and what you want to see in the walkthrough."
        />
        {errors.message && (
          <p id="error-message" className="text-xs text-destructive flex items-center gap-1">
            <AlertCircleIcon className="size-3" aria-hidden="true" />
            {errors.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        variant="primary"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="min-h-[44px] w-full sm:w-auto gap-2 px-6 cursor-pointer"
      >
        <SendIcon className="size-4" aria-hidden="true" />
        <span>{isSubmitting ? "Submitting..." : "Submit Request"}</span>
      </Button>
    </form>
  );
}

function InquiryPageShell({
  heading,
  subheading,
  formTitle,
  defaultType,
}: {
  heading: string;
  subheading: string;
  formTitle: string;
  defaultType: InquiryFormState["inquiryType"];
}) {
  return (
    <PublicLayout>
      <section className="border-b border-border bg-card py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {heading}
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed">
              {subheading}
            </p>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="lg:col-span-5 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    What a MillLedger Walkthrough Covers
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    1. Purchase receipt posting and moving weighted average cost recalculation.
                  </p>
                  <p>
                    2. BOM production run entry, yield variance flags, and packaging warnings.
                  </p>
                  <p>
                    3. Mobile salesman offline order capture and ATP stock reservation on approval.
                  </p>
                  <p>
                    4. CGST/SGST/IGST tax invoice PDFs, FIFO payments, and 9-tab audit exports.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MailIcon className="size-4 text-primary" aria-hidden="true" />
                    Direct Contact
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <p>
                    Email:{" "}
                    <a
                      href={`mailto:${BRAND_ENTITY.contactEmail}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {BRAND_ENTITY.contactEmail}
                    </a>
                  </p>
                  <p>Languages: English and Tamil (தமிழ்)</p>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-7">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{formTitle}</CardTitle>
                </CardHeader>
                <CardContent>
                  <InquiryForm defaultType={defaultType} />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

export function ContactPage() {
  return (
    <InquiryPageShell
      heading="Contact the MillLedger Team"
      subheading="Reach out for product evaluation questions, spreadsheet migration guidance, or technical deployment details."
      formTitle="Send an Inquiry"
      defaultType="erp_evaluation"
    />
  );
}

export function DemoPage() {
  return (
    <InquiryPageShell
      heading="Request a Live MillLedger Demo"
      subheading="See how MillLedger connects raw material purchases, BOM production costing, offline field sales, and GST invoicing in one ledger."
      formTitle="Schedule a Product Walkthrough"
      defaultType="product_demo"
    />
  );
}
