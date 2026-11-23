import type { z } from "zod";

import {
  createUploadUrlSchema,
  createFoodImageSchema,
} from "./food-images.validation.js";

export type CreateUploadUrlInput = z.infer<
  typeof createUploadUrlSchema
>;

export type CreateFoodImageInput = z.infer<
  typeof createFoodImageSchema
>;
