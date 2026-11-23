import { z } from "zod";

export const createFoodRequestSchema = z
  .object({
    listingId: z.uuid(),
    requestedPortions: z.number().int().positive(),
    fulfillmentMethod: z
      .enum(["SELF_PICKUP", "VOLUNTEER_DELIVERY"])
      .nullable()
      .optional(),
    recipientNotes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export const respondFoodRequestSchema = z
  .object({
    action: z.enum(["APPROVE", "REJECT"]),
    rejectionReason: z.string().trim().min(1).max(1000).optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.action !== "REJECT" ||
      Boolean(data.rejectionReason?.trim()),
    {
      message: "Rejection reason is required when rejecting a request",
      path: ["rejectionReason"],
    },
  );

export const foodRequestParamsSchema = z
  .object({
    id: z.uuid(),
  })
  .strict();

export const foodRequestQuerySchema = z
  .object({
    status: z
      .enum([
        "PENDING",
        "APPROVED",
        "REJECTED",
        "CANCELLED",
        "EXPIRED",
        "IN_PROGRESS",
        "COMPLETED",
        "FAILED",
      ])
      .optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
