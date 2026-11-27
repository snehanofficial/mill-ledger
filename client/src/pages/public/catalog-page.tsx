import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  PackageIcon,
  FileTextIcon,
  LayersIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicHeader } from "./public-header";
import { PublicFooter } from "./public-footer";
import { useLanguage } from "@/lib/i18n";

interface ProductSpec {
  sku: string;
  nameEn: string;
  nameTa: string;
  categoryEn: string;
  categoryTa: string;
  hsn: string;
  uom: string;
  packagingEn: string;
  packagingTa: string;
  moistureLimit: string;
  shelfLife: string;
  descriptionEn: string;
  descriptionTa: string;
}

const CATALOG_ITEMS: ProductSpec[] = [
  {
    sku: "MRK-200G",
    nameEn: "Classic Rice Murukku (200g)",
    nameTa: "பாரம்பரிய அரிசி முறுக்கு (200கி)",
    categoryEn: "Packaged Snacks",
    categoryTa: "திண்பண்டங்கள்",
    hsn: "19059090",
    uom: "pkts",
    packagingEn: "50 pkts per 3-ply Master Carton (10kg net)",
    packagingTa: "50 பாக்கெட்டுகள் / அட்டைப்பெட்டி (10கிலோ)",
    moistureLimit: "< 3.5%",
    shelfLife: "90 Days (Nitrogen flushed)",
    descriptionEn: "Crisp spiral savory extruded from premium sortex rice flour and edible vegetable oil. Seasoned with cumin, sesame, and asafoetida.",
    descriptionTa: "தூய அரிசி மாவு, சீரகம், பெருங்காயம் மற்றும் கடலை எண்ணெயில் சுகாதாரமாகத் தயாரிக்கப்பட்ட மொறுமொறுப்பான பாரம்பரிய முறுக்கு.",
  },
  {
    sku: "FLR-1KG",
    nameEn: "Roasted Sortex Rice Flour",
    nameTa: "வறுத்த சார்டெக்ஸ் அரிசி மாவு",
    categoryEn: "Milled Flours",
    categoryTa: "அரைவை மாவு",
    hsn: "11029010",
    uom: "kg",
    packagingEn: "1kg Consumer Pouches / 25kg Laminated PP Bags",
    packagingTa: "1கிலோ பாக்கெட் / 25கிலோ பி.பி மொத்த பை",
    moistureLimit: "< 11.5%",
    shelfLife: "180 Days",
    descriptionEn: "Finely pulverized 100-mesh steamed rice flour. Uniform particle size distribution with high starch stability for industrial baking and snack extrusion.",
    descriptionTa: "100-மெஷ் நுண்ணிய தூய்மையான அரிசி மாவு. சீரான தரம், இனிப்பு மற்றும் கார பலகாரங்கள் செய்ய உகந்தது.",
  },
  {
    sku: "OIL-15L",
    nameEn: "Refined Groundnut Oil (15L)",
    nameTa: "சுத்திகரிக்கப்பட்ட கடலை எண்ணெய் (15லி)",
    categoryEn: "Edible Oils",
    categoryTa: "சமையல் எண்ணெய்",
    hsn: "15089010",
    uom: "L",
    packagingEn: "15-Litre Food-grade Tin Container",
    packagingTa: "15 லிட்டர் உணவுத் தர தகர டின்",
    moistureLimit: "< 0.10%",
    shelfLife: "270 Days",
    descriptionEn: "Triple-filtered refined groundnut oil optimized for commercial frying with high smoke point (232°C) and neutral fatty acid profile.",
    descriptionTa: "உயர் வெப்பநிலையில் வறுக்க ஏற்ற மும்முறை வடிகட்டப்பட்ட தூய கடலை எண்ணெய்.",
  },
  {
    sku: "RIC-PON-50",
    nameEn: "Ponni Boiled Rice (Grade A)",
    nameTa: "பொன்னி புழுங்கல் அரிசி (முதல் தரம்)",
    categoryEn: "Sortex Milled Grains",
    categoryTa: "சார்டெக்ஸ் தானியங்கள்",
    hsn: "10063010",
    uom: "kg",
    packagingEn: "25kg & 50kg Non-woven HDPE Bags",
    packagingTa: "25கிலோ & 50கிலோ ஹெச்டிபிஇ பைகள்",
    moistureLimit: "< 13.0%",
    shelfLife: "365 Days",
    descriptionEn: "Sortex cleaned parboiled paddy, polished and color sorted. 99.8% purity with broken grain count under 2%.",
    descriptionTa: "99.8% தூய்மையான புழுங்கல் அரிசி. கல், உமி மற்றும் நிறம் மாறிய தானியங்கள் முற்றிலும் நீக்கப்பட்டது.",
  },
  {
    sku: "RIC-BRK-50",
    nameEn: "100% Broken White Rice",
    nameTa: "குருணை அரிசி (100% நொய்)",
    categoryEn: "Byproducts",
    categoryTa: "துணைப் பொருட்கள்",
    hsn: "10064000",
    uom: "kg",
    packagingEn: "50kg Standard Gunny Bags",
    packagingTa: "50கிலோ சாக்கு பைகள்",
    moistureLimit: "< 13.5%",
    shelfLife: "180 Days",
    descriptionEn: "Cleaned broken rice grains ideal for starch manufacture, idli batter production, and commercial poultry feed blending.",
    descriptionTa: "தூய்மையான நொய் அரிசி. மாவு ஆலைகள், தீவன உற்பத்தி மற்றும் தொழில்துறை பயன்பாட்டிற்கு உகந்தது.",
  },
  {
    sku: "BRN-50",
    nameEn: "De-oiled Rice Bran (DORB)",
    nameTa: "தவிட்டு தவிடு (கால்நடை தீவனம்)",
    categoryEn: "Animal Nutrition",
    categoryTa: "கால்நடை தீவனம்",
    hsn: "23022090",
    uom: "kg",
    packagingEn: "50kg HDPE Sacks",
    packagingTa: "50கிலோ பைகள்",
    moistureLimit: "< 10.0%",
    shelfLife: "90 Days",
    descriptionEn: "High-protein defatted rice bran with crude fiber controlled under 12%, widely utilized in compound dairy cattle and poultry feed.",
    descriptionTa: "உயர் புரதச்சத்து நிறைந்த தவிடு. பால் பண்ணைகள் மற்றும் கோழித் தீவனத்திற்கு ஏற்றது.",
  },
];

export function CatalogPage() {
  const { language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of CATALOG_ITEMS) {
      if (!map.has(item.categoryEn)) {
        map.set(item.categoryEn, language === "ta" ? item.categoryTa : item.categoryEn);
      }
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [language]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return CATALOG_ITEMS.filter((item) => {
      if (selectedCategory !== "ALL" && item.categoryEn !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      return (
        item.sku.toLowerCase().includes(q) ||
        item.hsn.toLowerCase().includes(q) ||
        item.nameEn.toLowerCase().includes(q) ||
        item.nameTa.toLowerCase().includes(q) ||
        item.categoryEn.toLowerCase().includes(q) ||
        item.categoryTa.toLowerCase().includes(q) ||
        item.descriptionEn.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, selectedCategory]);

  useEffect(() => {
    document.title =
      language === "ta"
        ? "மொத்த விற்பனை பட்டியல் | மில்லெட்ஜர் தானிய ஆலை"
        : "B2B Product Catalog | MillLedger Agro Processing";

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

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <PublicHeader />

      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {/* Header */}
        <section className="border-b border-border bg-card/60 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <Badge variant="outline" className="mb-3 text-xs">
                <PackageIcon className="size-3.5 mr-1 text-primary" aria-hidden="true" />
                <span>{language === "ta" ? "மொத்த விற்பனை & விநியோகம்" : "Wholesale Specifications"}</span>
              </Badge>
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
                {language === "ta" ? "B2B தயாரிப்பு பட்டியல் & விவரக்குறிப்புகள்" : "B2B Product Catalog & Specifications"}
              </h1>
              <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
                {language === "ta"
                  ? "நிறுவன வாங்குவோர், மளிகை மொத்த வியாபாரிகள் மற்றும் உணவு பதப்படுத்துநர்களுக்கான FSSAI சான்றளிக்கப்பட்ட தயாரிப்பு விவரங்கள். Ex-Mill மதுரை விலைகள் மற்றும் மாதிரி கோரிக்கைகளுக்கு எங்களைத் தொடர்பு கொள்ளவும்."
                  : "Certified specifications for institutional buyers, retail distributors, and commercial processors. Ex-mill Madurai logistics terms and customized packaging formats available upon request."}
              </p>
            </div>
          </div>
        </section>

        {/* Catalog Grid */}
        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {/* Search & Category Filter */}
            <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div
                className="flex flex-wrap items-center gap-1.5"
                role="group"
                aria-label={language === "ta" ? "வகை வாரியாக வடிகட்டுக" : "Filter catalog by category"}
              >
                <Button
                  type="button"
                  size="sm"
                  variant={selectedCategory === "ALL" ? "primary" : "outline"}
                  aria-pressed={selectedCategory === "ALL"}
                  onClick={() => setSelectedCategory("ALL")}
                  className="min-h-[44px] sm:min-h-[36px] text-xs cursor-pointer"
                >
                  {language === "ta" ? "அனைத்தும்" : "All"}
                </Button>
                {categories.map((cat) => (
                  <Button
                    key={cat.value}
                    type="button"
                    size="sm"
                    variant={selectedCategory === cat.value ? "primary" : "outline"}
                    aria-pressed={selectedCategory === cat.value}
                    onClick={() => setSelectedCategory(cat.value)}
                    className="min-h-[44px] sm:min-h-[36px] text-xs cursor-pointer"
                  >
                    {cat.label}
                  </Button>
                ))}
              </div>

              <div className="relative w-full lg:w-72">
                <SearchIcon
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={language === "ta" ? "பெயர், SKU, HSN தேடுக..." : "Search name, SKU, or HSN..."}
                  aria-label={language === "ta" ? "தயாரிப்புகளைத் தேடு" : "Search catalog products"}
                  className="h-11 sm:h-9 pl-9 pr-9"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label={language === "ta" ? "தேடலை அழி" : "Clear search"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <XIcon className="size-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            {filteredItems.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center flex flex-col items-center gap-3">
                <p className="text-sm font-semibold text-foreground">
                  {language === "ta" ? "பொருந்தும் தயாரிப்புகள் இல்லை" : "No matching products"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {language === "ta"
                    ? "தேடல் அல்லது வகை வடிகட்டியை மாற்றி முயற்சிக்கவும்."
                    : "Try adjusting your search term or category filter."}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("ALL");
                  }}
                  className="min-h-[44px] cursor-pointer"
                >
                  {language === "ta" ? "வடிகட்டிகளை அழி" : "Clear filters"}
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredItems.map((item) => (
                <Card key={item.sku} className="flex flex-col border-border bg-card shadow-xs hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <Badge variant="outline" className="text-[11px] font-mono">
                        {item.sku}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        HSN: {item.hsn}
                      </span>
                    </div>
                    <CardTitle className="text-lg font-bold text-foreground">
                      {language === "ta" ? item.nameTa : item.nameEn}
                    </CardTitle>
                    <div className="text-xs text-primary font-medium">
                      {language === "ta" ? item.categoryTa : item.categoryEn}
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col justify-between space-y-4 text-xs">
                    <p className="text-muted-foreground leading-relaxed">
                      {language === "ta" ? item.descriptionTa : item.descriptionEn}
                    </p>

                    <div className="space-y-1.5 rounded-control border border-border bg-muted/20 p-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{language === "ta" ? "பேக்கிங்:" : "Packaging:"}</span>
                        <span className="font-medium text-foreground text-right">{language === "ta" ? item.packagingTa : item.packagingEn}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{language === "ta" ? "ஈரப்பதம்:" : "Moisture Limit:"}</span>
                        <span className="font-medium text-foreground">{item.moistureLimit}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{language === "ta" ? "ஆயுட்காலம்:" : "Shelf Life:"}</span>
                        <span className="font-medium text-foreground">{item.shelfLife}</span>
                      </div>
                    </div>

                    <Link
                      to="/contact"
                      className={buttonVariants({ variant: "outline", size: "sm", className: "w-full gap-1.5 mt-2" })}
                    >
                      <FileTextIcon className="size-3.5" aria-hidden="true" />
                      <span>{language === "ta" ? "விலை விவரம் கோருக" : "Inquire Wholesale Terms"}</span>
                    </Link>
                  </CardContent>
                </Card>
                ))}
              </div>
            )}

            {/* Wholesale Terms Banner */}
            <div className="mt-12 rounded-xl border border-border bg-card p-6 sm:p-8">
              <h2 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
                <LayersIcon className="size-5 text-primary" aria-hidden="true" />
                <span>{language === "ta" ? "மொத்த விநியோக விதிமுறைகள்" : "General Wholesale Terms"}</span>
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs text-muted-foreground">
                <div className="space-y-1">
                  <strong className="text-foreground block">{language === "ta" ? "விநியோக புள்ளி:" : "Place of Supply:"}</strong>
                  <span>Ex-Mill Gate, Madurai, Tamil Nadu. Transport logistics coordinated upon request.</span>
                </div>
                <div className="space-y-1">
                  <strong className="text-foreground block">{language === "ta" ? "வரிகள் & ரசீது:" : "Taxation & Invoicing:"}</strong>
                  <span>Statutory GST tax invoice and E-waybill issued with every dispatched truckload.</span>
                </div>
                <div className="space-y-1">
                  <strong className="text-foreground block">{language === "ta" ? "தர ஆய்வு:" : "Quality Assurance:"}</strong>
                  <span>Batch test reports and FSSAI certification documentation supplied per consignment.</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
