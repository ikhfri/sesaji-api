import { z } from "zod";

export const createRegionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Region name is required")
    .max(255, "Region name must not exceed 255 characters"),

  regionType: z
    .string()
    .trim()
    .min(1, "Region type is required")
    .max(100, "Region type must not exceed 100 characters"),

  parentId: z
    .string()
    .uuid("Invalid parent region ID")
    .nullable()
    .optional(),
}).strict();

export const regionQuerySchema = z.object({
  parentId: z.union([
    z.string().uuid("Invalid parent region ID"),
    z.literal("null"),
  ]).optional(),

  regionType: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional(),
}).strict();

export const updateRegionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Region name cannot be empty")
    .max(255, "Region name must not exceed 255 characters")
    .optional(),

  regionType: z
    .string()
    .trim()
    .min(1, "Region type cannot be empty")
    .max(100, "Region type must not exceed 100 characters")
    .optional(),

  parentId: z
    .string()
    .uuid("Invalid parent region ID")
    .nullable()
    .optional(),
})
.strict()
.refine(
  (data) => Object.keys(data).length > 0,
  {
    message: "At least one field must be provided",
  },
);

export const regionParamsSchema = z.object({
  id: z.string().uuid("Invalid region ID"),
});
