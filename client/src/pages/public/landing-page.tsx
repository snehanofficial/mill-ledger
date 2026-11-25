import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheckIcon,
  FactoryIcon,
  PackageCheckIcon,
  ScaleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  TruckIcon,
  AwardIcon,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicHeader } from "./public-header";
import { PublicFooter } from "./public-footer";
import { useLanguage } from "@/lib/i18n";

export function LandingPage() {
  const { language } = useLanguage();

  useEffect(() => {
    document.title =
      language === "ta"
        ? "மில்லெட்ஜர் | நவீன தானிய அரைவை மற்றும் உணவு பதப்படுத்தும் ஆலை"
        : "MillLedger | Modern Grain Milling & Food Processing Unit";

    // Set robots to index, follow for public marketing surfaces (Owner Decision 2 / F-092)
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

  const capabilities = [
    {
      icon: FactoryIcon,
      title: language === "ta" ? "100 TPD சார்டெக்ஸ் அரைவை" : "100 TPD Sortex Milling",
      desc:
        language === "ta"
          ? "புஹ்லர் ஆப்டிகல் கலர் சார்ட்டர்கள் மூலம் 99.8% தூய்மையான தானியப் பிரிப்பு மற்றும் தூய்மைப்படுத்தல்."
          : "Buhler optical color sorters ensuring 99.8% purity, foreign matter extraction, and uniform grain sizing.",
    },
    {
      icon: ScaleIcon,
      title: language === "ta" ? "மண்டி எடைமேடை & ஈரப்பத சோதனை" : "Mandi Weighbridge & Testing",
      desc:
        language === "ta"
          ? "டிஜிட்டல் எடைமேடை (60 டன்) மற்றும் உடனடி ஈரப்பத ஆய்வுடன் கூடிய நேரடி விவசாயி கொள்முதல்."
          : "Automated 60-tonne digital weighbridge with instant moisture analysis for direct farmer procurement.",
    },
    {
      icon: PackageCheckIcon,
      title: language === "ta" ? "தானியங்கி சுகாதார பேக்கேஜிங்" : "Hygienic Packaging Unit",
      desc:
        language === "ta"
          ? "FSSAI அங்கீகாரம் பெற்ற உணவுத் தரம் கொண்ட பேக்கிங்: 200கி நைலான் பாக்கெட்டுகள் முதல் 50கிலோ மொத்த பைகள் வரை."
          : "Food-grade nitrogen-flushed form-fill-seal packaging from 200g retail pouches to 50kg bulk HDPE bags.",
    },
    {
      icon: TruckIcon,
      title: language === "ta" ? "அதிவேக விநியோகம் & ஜி.எஸ்.டி" : "Fast Dispatch & E-Waybill",
      desc:
        language === "ta"
          ? "தானியங்கி ஜி.எஸ்.டி விலைப்பட்டியல், இ-வே பில் மற்றும் நம்பகமான சரக்கு வாகன ஒருங்கிணைப்பு."
          : "Automated GST tax invoicing with real-time e-waybill generation and streamlined gate-pass logistics.",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <PublicHeader />

      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {/* Hero Section */}
        <section className="relative border-b border-border bg-card/60 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center text-center">
              <Badge variant="outline" className="mb-4 gap-1.5 px-3 py-1 text-xs">
                <ShieldCheckIcon className="size-3.5 text-primary" aria-hidden="true" />
                <span>
                  {language === "ta"
                    ? "FSSAI & AGMARK சான்றிதழ் பெற்ற உணவு ஆலை"
                    : "FSSAI & AGMARK Certified Food Manufacturer"}
                </span>
              </Badge>

              <h1 className="max-w-4xl text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-foreground">
                {language === "ta" ? (
                  <>
                    நவீன தானிய அரைவை மற்றும் <span className="text-primary">மொத்த உணவு உற்பத்தி</span>
                  </>
                ) : (
                  <>
                    Precision Grain Milling & <span className="text-primary">B2B Food Manufacturing</span>
                  </>
                )}
              </h1>

              <p className="mt-6 max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
                {language === "ta"
                  ? "மதுரை தொழில்துறை பகுதியில் இயங்கும் மில்லெட்ஜர், நவீன சார்டெக்ஸ் தொழில்நுட்பம் மூலம் பொன்னி புழுங்கல் அரிசி, முறுக்கு மற்றும் அரிசி மாவு மொத்த விநியோகத்தை உறுதி செய்கிறது."
                  : "Operating in Madurai's industrial corridor, MillLedger combines Buhler optical sortexing with hygienic manufacturing to supply premium rice, rice flour, and packaged murukku across South India."}
              </p>

              {/* CTAs */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Link
                  to="/catalog"
                  className={buttonVariants({ variant: "primary", size: "lg", className: "gap-2" })}
                >
                  <span>{language === "ta" ? "தயாரிப்பு பட்டியல் பார்க்க" : "Explore Product Catalog"}</span>
                  <ArrowRightIcon className="size-4" aria-hidden="true" />
                </Link>
                <Link
                  to="/contact"
                  className={buttonVariants({ variant: "outline", size: "lg" })}
                >
                  {language === "ta" ? "மண்டி கொள்முதல் & தொடர்பு" : "Mandi Gate & Contact"}
                </Link>
              </div>

              {/* Badges strip */}
              <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2Icon className="size-4 text-emerald-600" aria-hidden="true" />
                  <span>FSSAI Central Lic: 12423001000456</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2Icon className="size-4 text-emerald-600" aria-hidden="true" />
                  <span>ISO 22000:2018 Standards</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2Icon className="size-4 text-emerald-600" aria-hidden="true" />
                  <span>GST Registered Supplier</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2Icon className="size-4 text-emerald-600" aria-hidden="true" />
                  <span>Direct Mandi Weighbridge</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Capabilities Section */}
        <section className="py-16 sm:py-20 bg-background">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {language === "ta" ? "ஆலை செயல்பாட்டு சிறப்பம்சங்கள்" : "Milling Capabilities & Standards"}
              </h2>
              <p className="mt-3 max-w-xl mx-auto text-sm text-muted-foreground">
                {language === "ta"
                  ? "தானிய வரவு முதல் இறுதி பேக்கேஜிங் வரை முழுமையான தரம் மற்றும் துல்லியம்."
                  : "From raw paddy intake to nitrogen-flushed retail dispatch, every batch adheres to strict QA specifications."}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {capabilities.map((cap) => {
                const IconComponent = cap.icon;
                return (
                  <Card key={cap.title} className="border-border shadow-xs hover:border-primary/40 transition-colors">
                    <CardHeader className="pb-2">
                      <div className="flex size-10 items-center justify-center rounded-control bg-primary/10 text-primary mb-2">
                        <IconComponent className="size-5" aria-hidden="true" />
                      </div>
                      <CardTitle className="text-base font-semibold text-foreground">
                        {cap.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {cap.desc}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Featured Products Teaser */}
        <section className="py-16 bg-muted/20 border-y border-border">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
              <div>
                <Badge variant="outline" className="mb-2 text-xs">
                  {language === "ta" ? "மொத்த விற்பனை" : "Wholesale Supply"}
                </Badge>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {language === "ta" ? "முக்கிய தயாரிப்பு வரிசைகள்" : "Core Production Lines"}
                </h2>
              </div>
              <Link
                to="/catalog"
                className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1 self-start md:self-auto" })}
              >
                <span>{language === "ta" ? "முழு பட்டியல்" : "View Full Catalog"}</span>
                <ArrowRightIcon className="size-3.5" aria-hidden="true" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <Card className="border-border bg-card">
                <CardHeader>
                  <Badge variant="outline" className="w-fit text-[11px] mb-1">SKU: MRK-200G</Badge>
                  <CardTitle className="text-lg">
                    {language === "ta" ? "பாரம்பரிய அரிசி முறுக்கு (200கி)" : "Classic Rice Murukku (200g)"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  <p>
                    {language === "ta"
                      ? "சுத்தமான அரிசி மாவு மற்றும் கடலை எண்ணெயில் தயாரிக்கப்பட்ட மொறுமொறுப்பான சிற்றுண்டி. 50 பாக்கெட்டுகள் / அட்டைப்பெட்டி."
                      : "Made from premium rice flour and refined groundnut oil. 50 packets per master carton with moisture-tight nitrogen barrier."}
                  </p>
                  <div className="pt-2 text-foreground font-medium">
                    {language === "ta" ? "பேக்கிங்: 50 பாக் / அட்டைப்பெட்டி" : "Packaging: 50 pkts / Master Carton"}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card">
                <CardHeader>
                  <Badge variant="outline" className="w-fit text-[11px] mb-1">SKU: FLR-1KG</Badge>
                  <CardTitle className="text-lg">
                    {language === "ta" ? "வறுத்த அரிசி மாவு (1கிலோ & 25கிலோ)" : "Sortex Rice Flour (1kg & 25kg)"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  <p>
                    {language === "ta"
                      ? "100-மெஷ் நுண்ணிய தூய்மையான அரிசி மாவு. உணவகங்கள் மற்றும் திண்பண்ட தயாரிப்பாளர்களுக்கு ஏற்றது."
                      : "Super-fine 100-mesh flour milled from sortex-cleaned broken rice. Ideal for snack manufacturing and commercial bakeries."}
                  </p>
                  <div className="pt-2 text-foreground font-medium">
                    {language === "ta" ? "பேக்கிங்: 25கிலோ பி.பி பை" : "Packaging: 25kg PP Bulk Bags"}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card">
                <CardHeader>
                  <Badge variant="outline" className="w-fit text-[11px] mb-1">SKU: OIL-15L</Badge>
                  <CardTitle className="text-lg">
                    {language === "ta" ? "சுத்திகரிக்கப்பட்ட கடலை எண்ணெய் (15லி)" : "Refined Groundnut Oil (15L)"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  <p>
                    {language === "ta"
                      ? "உணவுத் தரம் கொண்ட 15லி தகர டப்பாக்களில் பாதுகாப்பான உணவு பதப்படுத்தும் பயன்பாடு."
                      : "High-smoke-point culinary oil packed in certified 15-litre food-grade tins for commercial kitchens and mills."}
                  </p>
                  <div className="pt-2 text-foreground font-medium">
                    {language === "ta" ? "பேக்கிங்: 15 லிட்டர் டின்" : "Packaging: 15L Food-grade Tin"}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Farmer / Mandi Callout */}
        <section className="py-16 bg-background">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 sm:p-12">
              <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="space-y-3">
                  <Badge variant="outline" className="text-xs bg-background">
                    <AwardIcon className="size-3.5 mr-1 text-primary" aria-hidden="true" />
                    <span>{language === "ta" ? "விவசாயிகள் மண்டி வாயில்" : "Farmer & Mandi Intake"}</span>
                  </Badge>
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                    {language === "ta"
                      ? "நேரடி நெல் கொள்முதல் & எடைமேடை சேவை"
                      : "Direct Grain Procurement & Weighbridge"}
                  </h2>
                  <p className="max-w-2xl text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {language === "ta"
                      ? "விவசாயிகள் மற்றும் வர்த்தகர்களிடமிருந்து நியாயமான மண்டி விலையில் நேரடி நெல் கொள்முதல். உடனடி டிஜிட்டல் ரசீது மற்றும் வங்கி பரிவர்த்தனை."
                      : "Direct procurement of raw paddy and commodities at transparent mandi rates. Immediate digital weigh slips and prompt statutory bank payments."}
                  </p>
                </div>
                <Link
                  to="/contact"
                  className={buttonVariants({ variant: "primary", size: "lg", className: "shrink-0" })}
                >
                  {language === "ta" ? "மண்டி தொடர்பு விவரங்கள்" : "Mandi Gate Timings"}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
