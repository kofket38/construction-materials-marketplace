import { createServer, type Server } from "node:http";
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
    process.exitCode = exitCode;
  }
}

function listen(serverToStart: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    const handleError = (error: Error): void => {
      serverToStart.off("listening", handleListening);
      reject(error);
    };
    const handleListening = (): void => {
      serverToStart.off("error", handleError);
      resolve();
    };

    serverToStart.once("error", handleError);
    serverToStart.once("listening", handleListening);
    serverToStart.listen(env.PORT);
  });
}

async function start(): Promise<void> {
  await prisma.$connect();

  const app = createApp();
  const httpServer = createServer(app);
  await listen(httpServer);

  server = httpServer;
  logger.info(
    { environment: env.NODE_ENV, port: env.PORT },
    "API server started",
  );
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
