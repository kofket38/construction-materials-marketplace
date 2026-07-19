import type { Server } from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { prisma } from "./prisma/client.js";

let server: Server | undefined;
let isShuttingDown = false;

async function shutdown(reason: string, exitCode: number): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info({ reason }, "Shutting down");

  try {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
    await prisma.$disconnect();
  } catch (error) {
    logger.error({ err: error }, "Graceful shutdown failed");
    exitCode = 1;
  } finally {
    process.exit(exitCode);
  }
}

async function start(): Promise<void> {
  await prisma.$connect();

  const app = createApp();
  server = app.listen(env.PORT, () => {
    logger.info(
      { environment: env.NODE_ENV, port: env.PORT },
      "API server started",
    );
  });
}

process.on("SIGINT", () => {
  void shutdown("SIGINT", 0);
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM", 0);
});
process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught exception");
  void shutdown("uncaughtException", 1);
});
process.on("unhandledRejection", (error) => {
  logger.fatal({ err: error }, "Unhandled rejection");
  void shutdown("unhandledRejection", 1);
});

start().catch((error) => {
  logger.fatal({ err: error }, "Failed to start API server");
  void shutdown("startupFailure", 1);
});
