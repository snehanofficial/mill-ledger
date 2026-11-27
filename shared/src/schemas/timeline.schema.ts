import { z } from "zod";
import {
  TIMELINE_ENTITY_TYPES,
  TIMELINE_FILTER_TYPES,
} from "../contracts/timeline.contract.js";

export const timelineEntityTypeSchema = z.enum(TIMELINE_ENTITY_TYPES);

export const timelineFilterSchema = z.enum(TIMELINE_FILTER_TYPES);

export const timelineParamsSchema = z.object({
  entityType: timelineEntityTypeSchema,
  entityId: z.string().min(1),
});

export const timelineQuerySchema = z.object({
  filter: timelineFilterSchema.optional().default("ALL"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
