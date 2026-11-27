import crypto from "node:crypto";
import { Router, type Request, type Response } from "express";
import { publicInquirySchema } from "@mill-ledger/shared";
import { createRateLimiter } from "../../middleware/rate-limit.middleware.js";
import { sendErrorResponse } from "../../middleware/error.middleware.js";

export const publicRouter = Router();

const inquiryRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
});

publicRouter.post(
  "/inquiries",
  inquiryRateLimiter,
  (req: Request, res: Response) => {
    const parsed = publicInquirySchema.safeParse(req.body);
    if (!parsed.success) {
      return sendErrorResponse(req, res, 400, {
        code: "VALIDATION_ERROR",
        message: "Please check the highlighted form fields.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    const referenceId = `INQ-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto
      .randomBytes(3)
      .toString("hex")
      .toUpperCase()}`;

    // Structured log for inquiry capture & organic/AI attribution without exposing PII in error paths
    console.info(
      JSON.stringify({
        event: "public_inquiry_received",
        referenceId,
        inquiryType: parsed.data.inquiryType,
        sourcePath: parsed.data.sourcePath,
        utmSource: parsed.data.utmSource || undefined,
        utmMedium: parsed.data.utmMedium || undefined,
        utmCampaign: parsed.data.utmCampaign || undefined,
        hasReferrer: Boolean(parsed.data.referrer),
        timestamp: new Date().toISOString(),
      }),
    );

    return res.status(201).json({
      referenceId,
      receivedAt: new Date().toISOString(),
      message: "Your demo request has been recorded.",
    });
  },
);
