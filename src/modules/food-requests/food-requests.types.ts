import type { z } from "zod";

import {
  createFoodRequestSchema,
  respondFoodRequestSchema,
  foodRequestParamsSchema,
  foodRequestQuerySchema,
} from "./food-requests.validation.js";

export type CreateFoodRequestInput = z.infer<
  typeof createFoodRequestSchema
>;

export type RespondFoodRequestInput = z.infer<
  typeof respondFoodRequestSchema
>;

export type FoodRequestParams = z.infer<
  typeof foodRequestParamsSchema
>;

export type FoodRequestQuery = z.infer<
  typeof foodRequestQuerySchema
>;
