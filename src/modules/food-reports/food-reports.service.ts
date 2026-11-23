
import { AppError } from "../../shared/middleware/error-handler.js";

import {
  createFoodReport as createFoodReportRepository,
  findAllFoodReports,
  findFoodReportByIdAndReporter,
  findFoodReportById,
  findFoodReportsByReporter,
  rejectFoodReport as rejectFoodReportRepository,
  resolveFoodReport as resolveFoodReportRepository,
  startFoodReportReview,
} from "./food-reports.repository.js";

import type {
  CreateFoodReportInput,
  FoodReportsFilter,
  RejectFoodReportInput,
  ResolveFoodReportInput,
  ReviewFoodReportInput,
} from "./food-reports.types.js";

// =====================================================
// HELPERS
// =====================================================

function assertAdmin(role: string): void {
  if (role !== "ADMIN") {
    throw new AppError(403, "Admin access required");
  }
}

function handleCreateError(error: string | undefined): never {
  const errors: Record<string, [number, string]> = {
    LISTING_NOT_FOUND: [
      404,
      "Food listing not found",
    ],
    CANNOT_REPORT_OWN_LISTING: [
      403,
      "You cannot report your own listing",
    ],
    REQUEST_NOT_FOUND: [
      404,
      "Food request not found",
    ],
    REQUEST_LISTING_MISMATCH: [
      400,
      "Food request does not belong to this listing",
    ],
    NOT_REQUEST_PARTICIPANT: [
      403,
      "You are not a participant of this food request",
    ],
    DELIVERY_TASK_NOT_FOUND: [
      404,
      "Delivery task not found",
    ],
    TASK_REQUEST_MISMATCH: [
      400,
      "Delivery task does not match the food request",
    ],
    TASK_LISTING_MISMATCH: [
      400,
      "Delivery task does not belong to this listing",
    ],
    NOT_TASK_PARTICIPANT: [
      403,
      "You are not a participant of this delivery task",
    ],
  };

  const [statusCode, message] = error
    ? errors[error] ?? [
        500,
        "Failed to create food report",
      ]
    : [
        500,
        "Failed to create food report",
      ];

  throw new AppError(statusCode, message);
}

function handleReviewError(error: string | undefined): never {
  if (error === "REPORT_NOT_FOUND") {
    throw new AppError(404, "Food report not found");
  }

  if (error === "INVALID_REPORT_STATUS") {
    throw new AppError(
      409,
      "Food report cannot be changed from its current status",
    );
  }

  throw new AppError(
    500,
    "Failed to update food report",
  );
}

// =====================================================
// CREATE FOOD REPORT
// =====================================================

export async function createFoodReport(
  reporterId: string,
  input: CreateFoodReportInput,
) {
  const result = await createFoodReportRepository(
    reporterId,
    input,
  );

  if ("error" in result && result.error !== undefined) {
    handleCreateError(result.error);
  }

  if (!("data" in result) || !result.data) {
    throw new AppError(
      500,
      "Failed to create food report",
    );
  }

  return result.data;
}

// =====================================================
// GET MY FOOD REPORTS
// =====================================================

export async function getMyFoodReports(
  reporterId: string,
  filter: FoodReportsFilter,
) {
  return findFoodReportsByReporter(
    reporterId,
    filter,
  );
}

// =====================================================
// GET FOOD REPORT DETAIL
// =====================================================

export async function getFoodReportDetail(
  reportId: string,
  userId: string,
  role: string,
) {
  if (role === "ADMIN") {
    const report = await findFoodReportById(reportId);

    if (!report) {
      throw new AppError(
        404,
        "Food report not found",
      );
    }

    return report;
  }

  const report = await findFoodReportByIdAndReporter(
    reportId,
    userId,
  );

  if (!report) {
    throw new AppError(
      404,
      "Food report not found",
    );
  }

  return report;
}

// =====================================================
// GET ALL FOOD REPORTS (ADMIN)
// =====================================================

export async function getAdminFoodReports(
  role: string,
  filter: FoodReportsFilter,
) {
  assertAdmin(role);

  return findAllFoodReports(filter);
}

// =====================================================
// REVIEW FOOD REPORT
// =====================================================

export async function reviewFoodReport(
  reportId: string,
  adminId: string,
  role: string,
  input: ReviewFoodReportInput,
) {
  assertAdmin(role);

  const result = await startFoodReportReview(
    reportId,
    adminId,
    input,
  );

  if ("error" in result && result.error !== undefined) {
    handleReviewError(result.error);
  }

  if (!("data" in result) || !result.data) {
    throw new AppError(
      500,
      "Failed to start food report review",
    );
  }

  return result.data;
}

// =====================================================
// RESOLVE FOOD REPORT
// =====================================================

export async function resolveFoodReport(
  reportId: string,
  adminId: string,
  role: string,
  input: ResolveFoodReportInput,
) {
  assertAdmin(role);

  const result = await resolveFoodReportRepository(
    reportId,
    adminId,
    input,
  );

  if ("error" in result && result.error !== undefined) {
    handleReviewError(result.error);
  }

  if (!("data" in result) || !result.data) {
    throw new AppError(
      500,
      "Failed to resolve food report",
    );
  }

  return result.data;
}

// =====================================================
// REJECT FOOD REPORT
// =====================================================

export async function rejectFoodReport(
  reportId: string,
  adminId: string,
  role: string,
  input: RejectFoodReportInput,
) {
  assertAdmin(role);

  const result = await rejectFoodReportRepository(
    reportId,
    adminId,
    input,
  );

  if ("error" in result && result.error !== undefined) {
    handleReviewError(result.error);
  }

  if (!("data" in result) || !result.data) {
    throw new AppError(
      500,
      "Failed to reject food report",
    );
  }

  return result.data;
}
