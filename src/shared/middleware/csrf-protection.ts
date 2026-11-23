import type { RequestHandler } from "express";
import { env } from "../../config/env.js";
import { AppError } from "./error-handler.js";

const allowedOrigin = new URL(env.FRONTEND_URL).origin;

export const csrfProtection: RequestHandler = (req, _res, next) => {
  const origin = req.get("origin");
  const csrfHeader = req.get("x-csrf-protection");

  if (!origin || origin !== allowedOrigin) {
    return next(new AppError(403, "Invalid request origin"));
  }

  if (csrfHeader !== "1") {
    return next(new AppError(403, "CSRF protection header is required"));
  }

  next();
};