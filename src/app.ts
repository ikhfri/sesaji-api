
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import rateLimit from "express-rate-limit";

import { env } from "./config/env.js";

import authRoutes from "./modules/auth/auth.routes.js";
import locationsRoutes from "./modules/locations/locations.routes.js";
import {
  errorHandler,
  notFoundHandler,
} from "./shared/middleware/error-handler.js";
import usersRoutes from "./modules/users/users.routes.js";
import regionsRoutes from "./modules/regions/regions.routes.js";
import foodListingsRoutes from "./modules/food-listings/food-listings.routes.js";
import foodRequestsRoutes from "./modules/food-requests/food-requests.routes.js";
import notificationsRoutes from "./modules/notifications/notifications.routes.js";
import foodImagesRoutes from "./modules/food-images/food-images.routes.js";
import deviceTokensRoutes from "./modules/device-tokens/device-tokens.routes.js";
import verificationsRoutes from "./modules/verifications/verifications.routes.js";
import pickupSchedulesRoutes from "./modules/pickup-schedules/pickup-schedules.routes.js";
import deliveryTasksRoutes from "./modules/delivery-tasks/delivery-tasks.routes.js";
import donationHistoriesRoutes from "./modules/donation-histories/donation-histories.routes.js";
import impactRoutes from "./modules/impact/impact.routes.js";
import foodMatchingRoutes from "./modules/food-matching/food-matching.routes.js";

const app = express();

app.disable("x-powered-by");

app.use(helmet());

const allowedOrigins = env.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-CSRF-Protection",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(pinoHttp());

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "SESAJI API is running",
    timestamp: new Date().toISOString(),
  });
});

app.use(`${env.API_PREFIX}/auth`, authRoutes);
app.use(`${env.API_PREFIX}/users`, usersRoutes);
app.use(`${env.API_PREFIX}/locations`, locationsRoutes);
app.use(`${env.API_PREFIX}/regions`, regionsRoutes);
app.use(`${env.API_PREFIX}/food-listings`, foodListingsRoutes);
app.use(`${env.API_PREFIX}/food-requests`, foodRequestsRoutes);
app.use(`${env.API_PREFIX}/notifications`, notificationsRoutes);
app.use(`${env.API_PREFIX}/food-images`, foodImagesRoutes);
app.use(`${env.API_PREFIX}/device-tokens`, deviceTokensRoutes);
app.use(`${env.API_PREFIX}/verifications`, verificationsRoutes);
app.use(`${env.API_PREFIX}/pickup-schedules`,pickupSchedulesRoutes,);
app.use(`${env.API_PREFIX}/delivery-tasks`,deliveryTasksRoutes,);
app.use(`${env.API_PREFIX}/donation-histories`, donationHistoriesRoutes);
app.use(`${env.API_PREFIX}/impact`, impactRoutes);
app.use(`${env.API_PREFIX}/food-matching`, foodMatchingRoutes); 

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
