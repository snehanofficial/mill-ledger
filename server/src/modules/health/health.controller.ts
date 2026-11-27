import type { Request, Response } from "express";
import type { HealthResponse } from "@mill-ledger/shared";
import { prisma } from "../../db/client.js";

export function getHealth(_req: Request, res: Response<HealthResponse>): void {
  const healthData: HealthResponse = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: "mill-ledger-server",
    version: "0.1.0",
  };

  res.status(200).json(healthData);
}

export async function getReadiness(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: "ready",
      database: "connected",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: "mill-ledger-server",
    });
  } catch (err) {
    res.status(503).json({
      status: "unhealthy",
      database: "disconnected",
      error: err instanceof Error ? err.message : "Database connection failed",
      timestamp: new Date().toISOString(),
      service: "mill-ledger-server",
    });
  }
}
