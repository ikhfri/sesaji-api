
import { z } from "zod";

export const deliveryTaskParamsSchema = z.object({
  id: z.uuid(),
});

export const availableTasksQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export const updateDeliveryTaskStatusSchema = z
  .object({
    status: z.enum([
      "PICKED_UP",
      "DELIVERED",
    ]),
    proofImageUrl: z.url().max(2048),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export const confirmDeliveryHandoverSchema = z
  .object({
    handoverCode: z.string().regex(/^\d{4}$/, {
      message: "Handover code must contain exactly 4 digits",
    }),
  })
  .strict();

export type UpdateDeliveryTaskStatusBody = z.infer<
  typeof updateDeliveryTaskStatusSchema
>;

export type ConfirmDeliveryHandoverBody = z.infer<
  typeof confirmDeliveryHandoverSchema
>;

export type AvailableTasksQuery = z.infer<
  typeof availableTasksQuerySchema
>;
