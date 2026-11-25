import type { Request, Response } from "express";
import type { HealthResponse } from "@mill-ledger/shared";

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
