
import { z } from "zod";

const dateTimeSchema = z.iso.datetime({ offset: true });

export const createPickupScheduleSchema = z
  .object({
    requestId: z.uuid(),

    scheduledStartAt: dateTimeSchema,
    scheduledEndAt: dateTimeSchema,

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
      new Date(data.scheduledEndAt).getTime() >
      new Date(data.scheduledStartAt).getTime(),
    {
      message: "Scheduled end time must be after start time",
      path: ["scheduledEndAt"],
    },
  );

export const updatePickupScheduleSchema = z
  .object({
    scheduledStartAt: dateTimeSchema.optional(),
    scheduledEndAt: dateTimeSchema.optional(),

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

export const pickupScheduleParamsSchema = z.object({
  id: z.uuid(),
});

export type CreatePickupScheduleBody = z.infer<
  typeof createPickupScheduleSchema
>;

export type UpdatePickupScheduleBody = z.infer<
  typeof updatePickupScheduleSchema
>;
