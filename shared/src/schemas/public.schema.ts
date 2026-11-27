import { z } from "zod";

export const PUBLIC_INQUIRY_TYPES = [
  "product_demo",
  "erp_evaluation",
  "migration_from_spreadsheets",
  "technical_questions",
] as const;

export const publicInquirySchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required").max(120),
  businessName: z.string().trim().max(160).optional().default(""),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\s-]{10,15}$/, "Enter a valid 10-15 digit phone number"),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(160)
    .optional()
    .or(z.literal("")),
  inquiryType: z.enum(PUBLIC_INQUIRY_TYPES).default("product_demo"),
  message: z
    .string()
    .trim()
    .min(5, "Please describe your mill operation or question")
    .max(2000),
  sourcePath: z.string().trim().max(200).optional().default("/contact"),
  referrer: z.string().trim().max(500).optional().default(""),
  utmSource: z.string().trim().max(120).optional().default(""),
  utmMedium: z.string().trim().max(120).optional().default(""),
  utmCampaign: z.string().trim().max(120).optional().default(""),
});

export type PublicInquiryInput = z.infer<typeof publicInquirySchema>;
