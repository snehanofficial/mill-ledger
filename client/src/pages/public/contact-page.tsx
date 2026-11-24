import { useState, useEffect } from "react";
import {
  MapPinIcon,
  PhoneIcon,
  MailIcon,
  ClockIcon,
  ScaleIcon,
  SendIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PublicHeader } from "./public-header";
import { PublicFooter } from "./public-footer";
import { useLanguage } from "@/lib/i18n";

interface InquiryFormState {
  fullName: string;
  businessName: string;
  phone: string;
  email: string;
  inquiryType: string;
  message: string;
}

const INITIAL_FORM: InquiryFormState = {
  fullName: "",
  businessName: "",
  phone: "",
  email: "",
  inquiryType: "wholesale_purchase",
  message: "",
};

export function ContactPage() {
  const { language } = useLanguage();
  const [formData, setFormData] = useState<InquiryFormState>(INITIAL_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof InquiryFormState, string>>>({});

  useEffect(() => {
    document.title =
      language === "ta"
        ? "மில்லெட்ஜர் | தொடர்பு மற்றும் மண்டி கொள்முதல் விபரம்"
        : "MillLedger | Contact & Mandi Intake Coordination";

    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    const created = !meta;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    const prevContent = meta.content;
    meta.content = "index, follow";

    return () => {
      if (created) {
        meta?.remove();
      } else if (prevContent) {
        meta!.content = prevContent;
      }
    };
  }, [language]);

  const validate = (): boolean => {
    const nextErrors: Partial<Record<keyof InquiryFormState, string>> = {};

    if (!formData.fullName.trim()) {
      nextErrors.fullName = language === "ta" ? "பெயர் தேவை" : "Name is required";
    }

    if (!formData.phone.trim()) {
      nextErrors.phone =
        language === "ta" ? "தொலைபேசி எண் தேவை" : "Phone number is required";
    } else if (!/^[0-9+\s-]{10,15}$/.test(formData.phone.trim())) {
      nextErrors.phone =
        language === "ta"
          ? "சரியான தொலைபேசி எண்ணை உள்ளிடவும்"
          : "Enter a valid 10-15 digit phone number";
    }

    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      nextErrors.email =
        language === "ta" ? "சரியான மின்னஞ்சலை உள்ளிடவும்" : "Enter a valid email address";
    }

    if (!formData.message.trim()) {
      nextErrors.message =
        language === "ta"
          ? "தேவை அல்லது செய்தியை உள்ளிடவும்"
          : "Please specify your requirement";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      // B2B Public Form submission state
      setSubmitted(true);
      setFormData(INITIAL_FORM);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <PublicHeader />

      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        {/* Header Section */}
        <div className="border-b border-border bg-muted/30 py-10 sm:py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl space-y-3">
              <span className="font-mono text-xs uppercase tracking-wider text-primary font-semibold">
                {language === "ta"
                  ? "மண்டி கொள்முதல் & ஆலை தொடர்பு"
                  : "Mandi Gate, Logistics & Commercial Coordination"}
              </span>
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
                {language === "ta"
                  ? "ஆலை தொடர்பு மற்றும் வர்த்தக விசாரணை"
                  : "Mill Gate Coordinates & Wholesale Inquiries"}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                {language === "ta"
                  ? "விவசாயிகள் மண்டி நெல் வரவு, எடைமேடை முன்பதிவு, மற்றும் மொத்த தானிய கொள்முதல் விசாரணைகளுக்கு தொடர்பு கொள்ளவும்."
                  : "Direct mandi coordination for paddy growers, weighbridge scheduling, wholesale grain purchase quotes, and institutional supply contracts."}
              </p>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            {/* Left Column: Coordinates, Hours, Mandi Intake (5 Cols) */}
            <div className="space-y-6 lg:col-span-5">
              {/* Mill Gate Coordinates */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MapPinIcon className="size-4 text-primary" aria-hidden="true" />
                    {language === "ta" ? "ஆலை அமைவிடம்" : "Mill Premises & Gate"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs sm:text-sm text-muted-foreground">
                  <div>
                    <p className="font-semibold text-foreground">MillLedger Agro Processing Ltd.</p>
                    <p>Survey No. 142/3B, NH-44 Bypass Industrial Estate</p>
                    <p>Madurai, Tamil Nadu 625016, India</p>
                  </div>
                  <div className="pt-2 border-t border-border space-y-2">
                    <div className="flex items-center gap-2 text-foreground">
                      <PhoneIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      <span>+91 452 290 8472 / +91 94431 82910</span>
                    </div>
                    <div className="flex items-center gap-2 text-foreground">
                      <MailIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      <span>mandi@millledger.local / wholesale@millledger.local</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Operating Hours & Intake Protocol */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ClockIcon className="size-4 text-primary" aria-hidden="true" />
                    {language === "ta" ? "எடைமேடை மற்றும் மண்டி நேரம்" : "Intake & Weighbridge Hours"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs sm:text-sm text-muted-foreground">
                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="font-medium text-foreground">
                      {language === "ta" ? "மின்னணு எடைமேடை (60MT):" : "Electronic Weighbridge (60MT):"}
                    </span>
                    <span className="font-mono text-xs">06:00 - 20:00 (Mon - Sat)</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="font-medium text-foreground">
                      {language === "ta" ? "விவசாயிகள் நெல் வரவு:" : "Farmer Paddy Intake:"}
                    </span>
                    <span className="font-mono text-xs">07:00 - 18:00 (Mon - Sat)</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="font-medium text-foreground">
                      {language === "ta" ? "வாகன ஏற்றுமதி (Wholesale Loadout):" : "Wholesale Wagon Loadout:"}
                    </span>
                    <span className="font-mono text-xs">08:00 - 21:00 (Mon - Sat)</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="font-medium text-foreground">
                      {language === "ta" ? "ஞாயிறு:" : "Sunday:"}
                    </span>
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      {language === "ta" ? "முன்அனுமதி பெற்ற லோடுகள் மட்டும்" : "Scheduled loads only"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Statutory Registrations */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ScaleIcon className="size-4 text-primary" aria-hidden="true" />
                    {language === "ta" ? "சட்டப்பூர்வ பதிவுகள்" : "Statutory Identifiers"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground font-mono">
                  <div className="flex justify-between items-center">
                    <span className="text-foreground font-sans">{language === "ta" ? "மத்திய FSSAI உரிமம்:" : "FSSAI Central Lic:"}</span>
                    <span className="font-bold text-foreground">12423001000456</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-foreground font-sans">GSTIN:</span>
                    <span className="font-bold text-foreground">33AAAAA0000A1Z5</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-foreground font-sans">{language === "ta" ? "APMC மண்டி எண்:" : "APMC Mandi Reg:"}</span>
                    <span>TN-MDU-APMC-8419</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-foreground font-sans">{language === "ta" ? "தொழில்நுட்ப தரம்:" : "Standard:"}</span>
                    <span>ISO 22000:2018 / AGMARK</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Inquiry & Procurement Form (7 Cols) */}
            <div className="lg:col-span-7">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {language === "ta" ? "வணிக & கொள்முதல் விசாரணை படிவம்" : "Commercial & Intake Inquiry Form"}
                  </CardTitle>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {language === "ta"
                      ? "மொத்த கொள்முதல் அல்லது நெல் வரவு தொடர்பான உங்கள் தேவைகளை அனுப்பவும். எங்கள் வணிகக் குழு 4 மணி நேரத்திற்குள் உங்களைத் தொடர்பு கொள்ளும்."
                      : "Submit your wholesale requirement or farmer lot intake notification. Our commercial desk responds within 4 business hours."}
                  </p>
                </CardHeader>
                <CardContent>
                  {submitted ? (
                    <div
                      role="status"
                      aria-live="polite"
                      className="rounded-control border border-success/30 bg-success/10 p-6 text-center space-y-3"
                    >
                      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success text-success-foreground">
                        <CheckCircle2Icon className="size-6" aria-hidden="true" />
                      </div>
                      <h2 className="text-lg font-bold text-foreground">
                        {language === "ta"
                          ? "உங்கள் விசாரணை பெறப்பட்டது!"
                          : "Inquiry Successfully Registered"}
                      </h2>
                      <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
                        {language === "ta"
                          ? "நன்றி. உங்கள் தொடர்பு விவரங்கள் பதிவு செய்யப்பட்டுள்ளன. எங்களின் வர்த்தக அதிகாரி விரைவில் உங்களை அழைப்பார்."
                          : "Thank you. Your request reference has been forwarded to the dispatch & procurement desk. Our commercial manager will follow up shortly."}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSubmitted(false)}
                        className="mt-2"
                      >
                        {language === "ta" ? "மற்றொரு தகவலை அனுப்ப" : "Submit Another Inquiry"}
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} noValidate className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {/* Name */}
                        <div className="space-y-1.5">
                          <Label htmlFor="inquiry-fullname">
                            {language === "ta" ? "முழு பெயர் *" : "Full Name *"}
                          </Label>
                          <Input
                            id="inquiry-fullname"
                            value={formData.fullName}
                            onChange={(e) =>
                              setFormData({ ...formData, fullName: e.target.value })
                            }
                            aria-invalid={!!errors.fullName}
                            aria-describedby={errors.fullName ? "error-fullname" : undefined}
                            placeholder={language === "ta" ? "உங்கள் பெயர்" : "e.g. S. Ramanathan"}
                          />
                          {errors.fullName && (
                            <p id="error-fullname" className="text-xs text-destructive flex items-center gap-1">
                              <AlertCircleIcon className="size-3" aria-hidden="true" />
                              {errors.fullName}
                            </p>
                          )}
                        </div>

                        {/* Business / Farm Name */}
                        <div className="space-y-1.5">
                          <Label htmlFor="inquiry-business">
                            {language === "ta"
                              ? "நிறுவனம் / விவசாயப் பண்ணை பெயர்"
                              : "Business / Farm Entity"}
                          </Label>
                          <Input
                            id="inquiry-business"
                            value={formData.businessName}
                            onChange={(e) =>
                              setFormData({ ...formData, businessName: e.target.value })
                            }
                            placeholder={language === "ta" ? "நிறுவன பெயர் (விருப்பம்)" : "e.g. Meenakshi Traders / Farm"}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {/* Phone */}
                        <div className="space-y-1.5">
                          <Label htmlFor="inquiry-phone">
                            {language === "ta" ? "தொலைபேசி எண் *" : "Mobile Phone *"}
                          </Label>
                          <Input
                            id="inquiry-phone"
                            type="tel"
                            value={formData.phone}
                            onChange={(e) =>
                              setFormData({ ...formData, phone: e.target.value })
                            }
                            aria-invalid={!!errors.phone}
                            aria-describedby={errors.phone ? "error-phone" : undefined}
                            placeholder="e.g. 98765 43210"
                          />
                          {errors.phone && (
                            <p id="error-phone" className="text-xs text-destructive flex items-center gap-1">
                              <AlertCircleIcon className="size-3" aria-hidden="true" />
                              {errors.phone}
                            </p>
                          )}
                        </div>

                        {/* Email */}
                        <div className="space-y-1.5">
                          <Label htmlFor="inquiry-email">
                            {language === "ta" ? "மின்னஞ்சல்" : "Email Address"}
                          </Label>
                          <Input
                            id="inquiry-email"
                            type="email"
                            value={formData.email}
                            onChange={(e) =>
                              setFormData({ ...formData, email: e.target.value })
                            }
                            aria-invalid={!!errors.email}
                            aria-describedby={errors.email ? "error-email" : undefined}
                            placeholder="e.g. contact@domain.in"
                          />
                          {errors.email && (
                            <p id="error-email" className="text-xs text-destructive flex items-center gap-1">
                              <AlertCircleIcon className="size-3" aria-hidden="true" />
                              {errors.email}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Inquiry Type */}
                      <div className="space-y-1.5">
                        <Label htmlFor="inquiry-type">
                          {language === "ta" ? "விசாரணை வகை" : "Inquiry Nature"}
                        </Label>
                        <select
                          id="inquiry-type"
                          value={formData.inquiryType}
                          onChange={(e) =>
                            setFormData({ ...formData, inquiryType: e.target.value })
                          }
                          className="w-full rounded-control border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="wholesale_purchase">
                            {language === "ta"
                              ? "மொத்த அரிசி கொள்முதல் (B2B Bulk Rice)"
                              : "B2B Finished Rice Purchase (Bulk / Institutional)"}
                          </option>
                          <option value="byproduct_purchase">
                            {language === "ta"
                              ? "துணை பொருட்கள் கொள்முதல் (குறுணை, தவிடு, உமி)"
                              : "By-Products Purchase (Broken Rice, Bran, Husk)"}
                          </option>
                          <option value="farmer_paddy_intake">
                            {language === "ta"
                              ? "விவசாயிகள் நெல் வரவு & எடைமேடை (Farmer Paddy Intake)"
                              : "Farmer Paddy Delivery & Weighbridge Lot Slot"}
                          </option>
                          <option value="custom_processing">
                            {language === "ta"
                              ? "வாடகை அரைவை & சோர்டெக்ஸ் பணி (Job-work / Sortexing)"
                              : "Custom Milling / Buhler Sortex Job-work Contract"}
                          </option>
                          <option value="other">
                            {language === "ta" ? "இதர விபரங்கள்" : "General Commercial Inquiries"}
                          </option>
                        </select>
                      </div>

                      {/* Message / Quantity Requirement */}
                      <div className="space-y-1.5">
                        <Label htmlFor="inquiry-message">
                          {language === "ta" ? "விவரம் / தேவைப்படும் அளவு (MT) *" : "Requirement Details / Volume (MT) *"}
                        </Label>
                        <textarea
                          id="inquiry-message"
                          rows={4}
                          value={formData.message}
                          onChange={(e) =>
                            setFormData({ ...formData, message: e.target.value })
                          }
                          aria-invalid={!!errors.message}
                          aria-describedby={errors.message ? "error-message" : undefined}
                          className="w-full rounded-control border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          placeholder={
                            language === "ta"
                              ? "எ.கா. 20 மெட்ரிக் டன் பொன்னி புழுங்கல் அரிசி 50kg பேக்கிங் தேவை..."
                              : "e.g. Need quotation for 25 MT Ponni Boiled Rice in 50kg bags for delivery to Coimbatore..."
                          }
                        />
                        {errors.message && (
                          <p id="error-message" className="text-xs text-destructive flex items-center gap-1">
                            <AlertCircleIcon className="size-3" aria-hidden="true" />
                            {errors.message}
                          </p>
                        )}
                      </div>

                      <div className="pt-2">
                        <Button type="submit" variant="primary" className="w-full sm:w-auto">
                          <SendIcon className="size-4 mr-2" aria-hidden="true" />
                          {language === "ta" ? "விசாரணையை அனுப்புக" : "Submit Inquiry to Commercial Desk"}
                        </Button>
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
