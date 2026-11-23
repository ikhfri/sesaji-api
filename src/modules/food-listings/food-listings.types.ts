import type { z } from "zod";

import type {
  createFoodListingSchema,
  updateFoodListingSchema,
  foodListingParamsSchema,
  exploreFoodListingsQuerySchema,
} from "./food-listings.validation.js";

export type CreateFoodListingInput = z.infer<
  typeof createFoodListingSchema
>;

export type UpdateFoodListingInput = z.infer<
  typeof updateFoodListingSchema
>;

export type FoodListingParams = z.infer<
  typeof foodListingParamsSchema
>;

export type ExploreFoodListingsQuery = z.infer<
  typeof exploreFoodListingsQuerySchema
>;
