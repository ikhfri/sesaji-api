
import app from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase, pool } from "./database/index.js";
import {
  startExpireFoodListingsJob,
  stopExpireFoodListingsJob,
} from "./jobs/expire-food-listings.job.js";

async function bootstrap() {
  try {
    await connectDatabase();

    // Start background jobs.
    startExpireFoodListingsJob();

    const server = app.listen(env.PORT, () => {
      console.log(
        `SESAJI API running at http://localhost:${env.PORT}`,
      );
    });

    let isShuttingDown = false;

    const shutdown = async () => {
      if (isShuttingDown) {
        return;
      }

      isShuttingDown = true;

      console.log("Shutting down SESAJI API...");

      stopExpireFoodListingsJob();

      server.close(async () => {
        await pool.end();
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => {
      void shutdown();
    });

    process.on("SIGINT", () => {
      void shutdown();
    });
  } catch (error) {
    console.error("Failed to start SESAJI API:", error);
    stopExpireFoodListingsJob();
    await pool.end();
    process.exit(1);
  }
}

void bootstrap();
