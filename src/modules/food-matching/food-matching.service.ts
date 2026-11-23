
import { AppError } from "../../shared/middleware/error-handler.js";

import {
  findMatchingFoodListings,
  findVerifiedReceiverContext,
} from "./food-matching.repository.js";

import { matchFoodListings } from "./food-matching.algorithm.js";

const MATCHING_OPTIONS = {
  maxRadiusKm: 10,
  estimatedTravelMinutesPerKm: 3,
  bufferMinutes: 30,
};

export async function getFoodRecommendations(
  userId: string,
  role: string,
) {
  if (role !== "RECEIVER") {
    throw new AppError(
      403,
      "Only receivers can access food recommendations",
    );
  }

  const receiver = await findVerifiedReceiverContext(userId);

  if (!receiver) {
    throw new AppError(
      403,
      "Approved receiver verification and a default location are required",
    );
  }

  const candidates = await findMatchingFoodListings();

  const recommendations = matchFoodListings(
    candidates,
    receiver,
    MATCHING_OPTIONS,
  );

  return {
    recommendations,
    meta: {
      total: recommendations.length,
      radiusKm: MATCHING_OPTIONS.maxRadiusKm,
      travelTimeMethod: "STRAIGHT_LINE_ESTIMATE",
      estimatedTravelMinutesPerKm:
        MATCHING_OPTIONS.estimatedTravelMinutesPerKm,
      bufferMinutes: MATCHING_OPTIONS.bufferMinutes,
      generatedAt: new Date().toISOString(),
    },
  };
}
