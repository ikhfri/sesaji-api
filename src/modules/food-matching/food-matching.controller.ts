
import type { Request, Response } from "express";

import { AppError } from "../../shared/middleware/error-handler.js";

import { getFoodRecommendations } from "./food-matching.service.js";

export async function getFoodRecommendationsController(
  req: Request,
  res: Response,
) {
  const auth = req.auth;

  if (!auth) {
    throw new AppError(401, "Unauthenticated");
  }

  const data = await getFoodRecommendations(
    auth.userId,
    auth.role,
  );

  res.status(200).json({
    success: true,
    message: "Food recommendations retrieved successfully",
    data,
  });
}
