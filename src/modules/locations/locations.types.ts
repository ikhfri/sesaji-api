import type { z } from "zod";

import type {
  createLocationSchema,
  updateLocationSchema,
} from "./locations.validation.js";

export type CreateLocationInput = z.infer<
  typeof createLocationSchema
>;

export type UpdateLocationInput = z.infer<
  typeof updateLocationSchema
>;