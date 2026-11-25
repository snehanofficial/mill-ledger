import { z } from "zod";
import { gstinSchema } from "./gstin.schema.js";

export const createCustomerSchema = z
  .object({
    organizationId: z.string().min(1).optional(),
    code: z.string().min(1, "Customer code is required"),
    name: z.string().min(1, "Customer name is required"),
    phone: z.string().nullable().optional(),
    email: z.string().email("Invalid email format").nullable().optional(),
    state: z.string().min(1, "State is required").default("Tamil Nadu"),
    gstin: gstinSchema.nullable().optional(),
    isActive: z.boolean().optional().default(true),
  })
  .strict();

export const updateCustomerSchema = z
  .object({
    name: z.string().min(1).optional(),
    phone: z.string().nullable().optional(),
    email: z.string().email("Invalid email format").nullable().optional(),
    state: z.string().min(1).optional(),
    gstin: gstinSchema.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
