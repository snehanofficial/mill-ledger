import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./db/client.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(
    `🚀 Mill-Ledger API running on port ${env.PORT} in ${env.NODE_ENV} mode`,
  );
});

const shutdown = async () => {
  console.log("Shutting down gracefully...");

  // Forceful exit fallback after 10 seconds if connections hang (F-102)
  const forceExitTimer = setTimeout(() => {
    console.error("Graceful shutdown timed out, forcefully exiting.");
    process.exit(1);
  }, 10000);
  forceExitTimer.unref();

  server.close(async () => {
    console.log("HTTP server closed");
    try {
      await prisma.$disconnect();
      console.log("Database connection closed");
    } catch (err) {
      console.error("Error disconnecting from database during shutdown:", err);
    }
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
