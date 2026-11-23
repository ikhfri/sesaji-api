import { z } from "zod";

export const updateUserSchema = z
  .object({
    fullName: z.string().trim().min(3).max(255).optional(),

    phoneNumber: z
      .string()
      .trim()
      .min(8)
      .max(30)
      .nullable()
      .optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.fullName !== undefined ||
      data.phoneNumber !== undefined,
    { message: "At least one field must be provided" },
  );

export const updateProfileSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("DONOR_INDIVIDUAL"),
    })
    .strict(),

  z
    .object({
      type: z.literal("DONOR_BUSINESS"),
      businessName: z.string().trim().min(2).max(255).optional(),
      businessType: z.string().trim().min(2).max(100).optional(),
    })
    .strict()
    .refine(
      (data) =>
        data.businessName !== undefined ||
        data.businessType !== undefined,
      { message: "At least one profile field must be provided" },
    ),

  z
    .object({
      type: z.literal("RECEIVER"),
      institutionName: z.string().trim().min(2).max(255).optional(),
      institutionType: z.string().trim().min(2).max(100).optional(),
      description: z.string().trim().max(2000).nullable().optional(),
      capacityPortions: z.number().int().positive().nullable().optional(),
    })
    .strict()
    .refine(
      (data) =>
        data.institutionName !== undefined ||
        data.institutionType !== undefined ||
        data.description !== undefined ||
        data.capacityPortions !== undefined,
      { message: "At least one profile field must be provided" },
    ),

  z
    .object({
      type: z.literal("VOLUNTEER"),
      vehicleType: z.string().trim().max(100).nullable().optional(),
      preferredRadiusKm: z.number().positive().max(100).nullable().optional(),
    })
    .strict()
    .refine(
      (data) =>
        data.vehicleType !== undefined ||
        data.preferredRadiusKm !== undefined,
      { message: "At least one profile field must be provided" },
    ),
]);