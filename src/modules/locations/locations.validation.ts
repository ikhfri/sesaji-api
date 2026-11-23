import { z } from "zod";

export const createLocationSchema = z
  .object({
    address: z.string().trim().min(5).max(2000),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    postalCode: z.string().trim().max(20).optional(),
    label: z.string().trim().max(100).optional(),
    locationType: z.string().trim().min(2).max(100),
    isDefault: z.boolean().optional(),
  })
  .strict();

export const updateLocationSchema = z
  .object({
    address: z.string().trim().min(5).max(2000).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    postalCode: z.string().trim().max(20).nullable().optional(),
    label: z.string().trim().max(100).nullable().optional(),
    locationType: z.string().trim().min(2).max(100).optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field must be provided" },
  );