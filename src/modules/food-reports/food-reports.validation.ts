
import { z } from "zod";

const reportTypes = [
  "UNSAFE_FOOD",
  "FOOD_QUALITY",
  "DELIVERY_ISSUE",
  "MISCONDUCT",
  "OTHER",
] as const;

const reportStatuses = [
  "PENDING",
  "REVIEWING",
  "RESOLVED",
  "REJECTED",
] as const;

export const createFoodReportSchema = z.object({
  listingId: z.string().uuid(),
  requestId: z.string().uuid().optional(),
  deliveryTaskId: z.string().uuid().optional(),
  type: z.enum(reportTypes),
  description: z.string().trim().min(10).max(5000),
  evidenceImageUrls: z
    .array(z.string().url())
    .max(5)
    .default([]),
}).strict();

export const foodReportParamsSchema = z.object({
  id: z.string().uuid(),
});

export const foodReportsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(reportStatuses).optional(),
  type: z.enum(reportTypes).optional(),
});

export const reviewFoodReportSchema = z.object({
  notes: z.string().trim().min(3).max(2000).optional(),
}).strict();

export const resolveFoodReportSchema = z.object({
  resolutionNotes: z.string().trim().min(3).max(2000),
}).strict();

export const rejectFoodReportSchema = z.object({
  resolutionNotes: z.string().trim().min(3).max(2000),
}).strict();

export type CreateFoodReportBody = z.infer<
  typeof createFoodReportSchema
>;

export type FoodReportsQuery = z.infer<
  typeof foodReportsQuerySchema
>;

export type ReviewFoodReportBody = z.infer<
  typeof reviewFoodReportSchema
>;

export type ResolveFoodReportBody = z.infer<
  typeof resolveFoodReportSchema
>;

export type RejectFoodReportBody = z.infer<
  typeof rejectFoodReportSchema
>;
