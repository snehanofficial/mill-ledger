import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`🚀 Mill-Ledger API running on port ${env.PORT} in ${env.NODE_ENV} mode`);
});

const shutdown = () => {
  console.log("Shutting down gracefully...");
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
