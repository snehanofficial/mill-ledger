import client from "prom-client";

// Create custom Prometheus registry for MillLedger
export const register = new client.Registry();

// Add default system labels
register.setDefaultLabels({
  app: "mill-ledger-server",
});

// Collect default Node.js runtime metrics (CPU, Memory, Event Loop, GC)
client.collectDefaultMetrics({ register });

// HTTP Request Duration Histogram
export const httpRequestDurationSeconds = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// Total HTTP Requests Counter
export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests processed",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

// Database Connection Pool Active Connections
export const dbPoolActiveConnections = new client.Gauge({
  name: "db_pool_active_connections",
  help: "Number of active connections in the database connection pool",
  registers: [register],
});

// Database Connection Pool Idle Connections
export const dbPoolIdleConnections = new client.Gauge({
  name: "db_pool_idle_connections",
  help: "Number of idle connections in the database connection pool",
  registers: [register],
});
