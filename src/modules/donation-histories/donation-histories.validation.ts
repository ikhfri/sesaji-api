import { z } from "zod";

export const donationHistoryParamsSchema = z.object({
  id: z.string().uuid("Invalid donation request ID"),
});

export const donationHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum([
    "PENDING",
    "APPROVED",
    "REJECTED",
    "CANCELLED",
    "EXPIRED",
    "IN_PROGRESS",
    "COMPLETED",
    "FAILED",
  ]).optional(),
});

export type DonationHistoryParams = z.infer<
  typeof donationHistoryParamsSchema
>;

export type DonationHistoryQuery = z.infer<
  typeof donationHistoryQuerySchema
>;
