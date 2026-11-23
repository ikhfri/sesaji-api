
import { z } from "zod";

export const createUploadUrlSchema = z
  .object({
    listingId: z.uuid(),
    originalFilename: z.string().trim().min(1).max(255),
    contentType: z.enum([
      "image/jpeg",
      "image/png",
      "image/webp",
    ]),
    sizeBytes: z.number().int().positive().max(5 * 1024 * 1024),
  })
  .strict();

export const createFoodImageSchema = z
  .object({
    listingId: z.uuid(),
    objectKey: z.string().trim().min(1).max(500),
    originalFilename: z.string().trim().min(1).max(255),
    altText: z.string().trim().max(255).nullable().optional(),
    isPrimary: z.boolean().default(false),
  })
  .strict();

export const foodImageParamsSchema = z
  .object({
    id: z.uuid(),
  })
  .strict();

export const listingImageParamsSchema = z
  .object({
    listingId: z.uuid(),
  })
  .strict();
