/**
 * AUDIT-ONLY SCRIPT
 * Validates recommended Schema.org JSON-LD structured data definitions
 * for Organization, LocalBusiness, and Product against Schema.org structural constraints.
 */

import { z } from "zod";

const OrganizationSchema = z.object({
  "@context": z.literal("https://schema.org"),
  "@type": z.literal("Organization"),
  name: z.string().min(1),
  legalName: z.string().min(1),
  url: z.string().url(),
  logo: z.string().url(),
  description: z.string().min(10),
  address: z.object({
    "@type": z.literal("PostalAddress"),
    streetAddress: z.string(),
    addressLocality: z.string(),
    addressRegion: z.string(),
    postalCode: z.string(),
    addressCountry: z.string(),
  }),
  contactPoint: z.object({
    "@type": z.literal("ContactPoint"),
    telephone: z.string(),
    contactType: z.string(),
    availableLanguage: z.array(z.string()),
  }),
});

const LocalBusinessSchema = z.object({
  "@context": z.literal("https://schema.org"),
  "@type": z.literal("LocalBusiness"),
  name: z.string().min(1),
  image: z.string().url(),
  "@id": z.string().url(),
  url: z.string().url(),
  telephone: z.string(),
  priceRange: z.string(),
  address: z.object({
    "@type": z.literal("PostalAddress"),
    streetAddress: z.string(),
    addressLocality: z.string(),
    addressRegion: z.string(),
    postalCode: z.string(),
    addressCountry: z.string(),
  }),
  geo: z.object({
    "@type": z.literal("GeoCoordinates"),
    latitude: z.number(),
    longitude: z.number(),
  }),
  openingHoursSpecification: z.array(
    z.object({
      "@type": z.literal("OpeningHoursSpecification"),
      dayOfWeek: z.array(z.string()),
      opens: z.string(),
      closes: z.string(),
    }),
  ),
});

const ProductSchema = z.object({
  "@context": z.literal("https://schema.org"),
  "@type": z.literal("Product"),
  name: z.string().min(1),
  image: z.string().url(),
  description: z.string().min(10),
  sku: z.string().min(1),
  category: z.string(),
  brand: z.object({
    "@type": z.literal("Brand"),
    name: z.string(),
  }),
  offers: z.object({
    "@type": z.literal("Offer"),
    url: z.string().url(),
    priceCurrency: z.literal("INR"),
    price: z.string(),
    availability: z.literal("https://schema.org/InStock"),
    itemCondition: z.literal("https://schema.org/NewCondition"),
  }),
});

export const RECOMMENDED_SCHEMAS = {
  organization: {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "MillLedger Modern Rice Mill",
    legalName: "MillLedger Food Processing Pvt Ltd",
    url: "https://millledger.local",
    logo: "https://millledger.local/apple-touch-icon.png",
    description: "Order-to-Audit food manufacturing mill and modern grain processing facility.",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Mandi Gate Industrial Corridor",
      addressLocality: "Thanjavur",
      addressRegion: "Tamil Nadu",
      postalCode: "613001",
      addressCountry: "IN",
    },
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+91-4362-200000",
      contactType: "B2B Sales and Mandi Intake",
      availableLanguage: ["English", "Tamil"],
    },
  },
  localBusiness: {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "MillLedger Modern Rice Mill",
    image: "https://millledger.local/apple-touch-icon.png",
    "@id": "https://millledger.local/#mill",
    url: "https://millledger.local",
    telephone: "+91-4362-200000",
    priceRange: "₹₹₹",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Mandi Gate Industrial Corridor",
      addressLocality: "Thanjavur",
      addressRegion: "Tamil Nadu",
      postalCode: "613001",
      addressCountry: "IN",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 10.787,
      longitude: 79.1378,
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        opens: "08:00",
        closes: "19:00",
      },
    ],
  },
  product: {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Ponni Boiled Rice (Sortex Cleaned, 50kg)",
    image: "https://millledger.local/products/ponni-boiled-50kg.webp",
    description: "Premium single-boiled Ponni rice milled and sortex-cleaned in Tamil Nadu.",
    sku: "FG-RICE-PONNI-50KG",
    category: "Grain Supplies > Milled Rice",
    brand: {
      "@type": "Brand",
      name: "MillLedger Gold",
    },
    offers: {
      "@type": "Offer",
      url: "https://millledger.local/products/ponni-boiled-50kg",
      priceCurrency: "INR",
      price: "2450.00",
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  },
};

export function validateAllSchemas() {
  const orgResult = OrganizationSchema.safeParse(RECOMMENDED_SCHEMAS.organization);
  const localResult = LocalBusinessSchema.safeParse(RECOMMENDED_SCHEMAS.localBusiness);
  const prodResult = ProductSchema.safeParse(RECOMMENDED_SCHEMAS.product);

  return {
    organization: { valid: orgResult.success, errors: orgResult.error?.errors || null },
    localBusiness: { valid: localResult.success, errors: localResult.error?.errors || null },
    product: { valid: prodResult.success, errors: prodResult.error?.errors || null },
  };
}

if (process.argv[1] && process.argv[1].endsWith("validate-json-ld.ts")) {
  const res = validateAllSchemas();
  console.log("Validation Results:", JSON.stringify(res, null, 2));
}
