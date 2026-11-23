import type { z } from "zod";
import type {
  updateUserSchema,
  updateProfileSchema,
} from "./users.validation.js";

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;