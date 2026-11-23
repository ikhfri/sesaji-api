import { z } from "zod";

export const registerDeviceTokenSchema = z.object({
  token: z.string().trim().min(1).max(512),
  platform: z.enum(["ANDROID", "WEB"]),
  deviceId: z.string().trim().max(255).nullable().optional(),
}).strict();

export const revokeDeviceTokenSchema = z.object({
  token: z.string().trim().min(1).max(512),
}).strict();

export type RegisterDeviceTokenBody = z.infer<
  typeof registerDeviceTokenSchema
>;

export type RevokeDeviceTokenBody = z.infer<
  typeof revokeDeviceTokenSchema
>;
