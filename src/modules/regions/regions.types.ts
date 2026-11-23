import type { z } from "zod";

import type {
  createRegionSchema,
  updateRegionSchema,
  regionParamsSchema,
} from "./regions.validation.js";

export type CreateRegionInput = z.infer<
  typeof createRegionSchema
>;

export type UpdateRegionInput = z.infer<
  typeof updateRegionSchema
>;

export type RegionParams = z.infer<
  typeof regionParamsSchema
>;
