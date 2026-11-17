export interface HealthContract {
  path: "/api/health";
  method: "GET";
  response: {
    status: "ok" | "degraded" | "down";
    timestamp: string;
    uptime: number;
    service: string;
    version: string;
  };
}
