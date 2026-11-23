
import { z } from "zod";

const commonFields = {
  fullName: z.string().trim().min(3).max(255),
  email: z.string().trim().email().max(255),
  phoneNumber: z.string().trim().min(8).max(30).optional(),
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
};

export const registerSchema = z.discriminatedUnion("role", [
  z.object({
    ...commonFields,
    role: z.literal("DONOR_INDIVIDUAL"),
    profile: z.object({
      type: z.literal("DONOR_INDIVIDUAL"),
    }),
  }),

  z.object({
    ...commonFields,
    role: z.literal("DONOR_BUSINESS"),
    profile: z.object({
      type: z.literal("DONOR_BUSINESS"),
      businessName: z.string().trim().min(2).max(255),
      businessType: z.string().trim().min(2).max(100),
    }),
  }),

  z.object({
    ...commonFields,
    role: z.literal("RECEIVER"),
    profile: z.object({
      type: z.literal("RECEIVER"),
      institutionName: z.string().trim().min(2).max(255),
      institutionType: z.string().trim().min(2).max(100),
      description: z.string().max(2000).optional(),
      capacityPortions: z.number().int().positive().optional(),
    }),
  }),

  z.object({
    ...commonFields,
    role: z.literal("VOLUNTEER"),
    profile: z.object({
      type: z.literal("VOLUNTEER"),
      vehicleType: z.string().trim().max(100).optional(),
    }),
  }),
]);

export const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(128),
});

export const verifyEmailSchema = z.object({
  token: z.string().length(64).regex(/^[a-f0-9]+$/i),
});

export const refreshSchema = z.object({}).strict();

export const resendVerificationSchema = z.object({
  email: z.string().trim().email().max(255),
});

export type RegisterBody = z.infer<typeof registerSchema>;
export type LoginBody = z.infer<typeof loginSchema>;
