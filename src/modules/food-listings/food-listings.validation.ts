import { z } from "zod";

export const createFoodListingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Food name must be at least 3 characters")
    .max(150, "Food name must not exceed 150 characters"),

  description: z
    .string()
    .trim()
    .max(5000)
    .nullable()
    .optional(),

  categoryId: z
    .string()
    .uuid("Invalid category ID"),

  locationId: z
    .string()
    .uuid("Invalid user location ID"),

  totalPortions: z
    .number()
    .int()
    .positive("Total portions must be greater than zero"),

  isHalal: z.boolean().default(false),

  isVegetarian: z.boolean().default(false),

  allergens: z
    .array(z.string().trim().min(1).max(100))
    .max(50)
    .default([]),

  producedAt: z.iso.datetime({
    offset: true,
  }),

  storageInstructions: z
    .string()
    .trim()
    .min(1, "Storage instructions are required")
    .max(2000),

  pickupDeadline: z.iso.datetime({
    offset: true,
  }),

  notes: z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .optional(),
})
.strict()
.refine(
  (data) =>
    new Date(data.pickupDeadline).getTime() >
    new Date(data.producedAt).getTime(),
  {
    message: "Pickup deadline must be after production time",
    path: ["pickupDeadline"],
  },
);

export const updateFoodListingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3)
    .max(150)
    .optional(),

  description: z
    .string()
    .trim()
    .max(5000)
    .nullable()
    .optional(),

  categoryId: z
    .string()
    .uuid()
    .optional(),

  locationId: z
    .string()
    .uuid()
    .optional(),

  totalPortions: z
    .number()
    .int()
    .positive()
    .optional(),

  isHalal: z.boolean().optional(),

  isVegetarian: z.boolean().optional(),

  allergens: z
    .array(z.string().trim().min(1).max(100))
    .max(50)
    .optional(),

  producedAt: z.iso.datetime({
    offset: true,
  }).optional(),

  storageInstructions: z
    .string()
    .trim()
    .min(1)
    .max(2000)
    .optional(),

  pickupDeadline: z.iso.datetime({
    offset: true,
  }).optional(),

  notes: z
    .string()
    .trim()
    .max(2000)
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

export const foodListingParamsSchema = z.object({
  id: z.string().uuid("Invalid food listing ID"),
});

export const exploreFoodListingsQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),

  regionId: z.string().uuid().optional(),

  isHalal: z.enum(["true", "false"]).optional(),

  isVegetarian: z.enum(["true", "false"]).optional(),

  search: z.string().trim().max(150).optional(),

  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(50).default(20),

  sortBy: z
    .enum(["newest", "deadline"])
    .default("newest"),
}).strict();
