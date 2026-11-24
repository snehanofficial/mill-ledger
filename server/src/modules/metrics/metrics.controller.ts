import type { Request, Response } from "express";
import { register } from "./metrics.service.js";

/**
 * Exposes Prometheus-compatible metrics for scraping.
 */
export async function getMetrics(_req: Request, res: Response): Promise<void> {
  res.setHeader("Content-Type", register.contentType);
  const metrics = await register.metrics();
  res.status(200).send(metrics);
}
