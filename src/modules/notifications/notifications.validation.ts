import { z } from "zod";

export const notificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
}).strict();

export const notificationParamsSchema = z.object({
  id: z.string().uuid(),
}).strict();

export type NotificationParams = z.infer<
  typeof notificationParamsSchema
>;
