
import { z } from "zod";

export const verificationTypeSchema = z.enum([
  "DONOR_BUSINESS",
  "RECEIVER",
  "VOLUNTEER",
]);

export const verificationStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

export const verificationDocumentSchema = z.object({
  documentType: z.string().trim().min(1).max(100),
  objectKey: z.string()
    .trim()
    .min(1)
    .max(500)
    .refine(
      (value) =>
        !value.startsWith("/") &&
        !value.includes("..") &&
        !value.includes("\\"),
      "Invalid document object key",
    ),
  originalFilename: z.string().trim().min(1).max(255),
}).strict();

export const createVerificationSchema = z.object({
  verificationType: verificationTypeSchema,
  documents: z.array(verificationDocumentSchema).min(1).max(5),
}).strict();

export const verificationParamsSchema = z.object({
  id: z.string().uuid(),
}).strict();

export const verificationQuerySchema = z.object({
  status: verificationStatusSchema.optional(),
  verificationType: verificationTypeSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();

export const rejectVerificationSchema = z.object({
  rejectionReason: z.string().trim().min(10).max(2000),
}).strict();

export const verificationUploadUrlSchema = z.object({
  originalFilename: z.string().trim().min(1).max(255),
  contentType: z.enum([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
}).strict();

export type VerificationUploadUrlBody = z.infer<
  typeof verificationUploadUrlSchema
>;

export type CreateVerificationBody = z.infer<
  typeof createVerificationSchema
>;

export type VerificationQueryParams = z.infer<
  typeof verificationQuerySchema
>;

export type RejectVerificationBody = z.infer<
  typeof rejectVerificationSchema
>;

