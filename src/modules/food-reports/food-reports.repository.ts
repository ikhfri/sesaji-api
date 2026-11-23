
import {
  and,
  desc,
  eq,
  type SQL,
} from "drizzle-orm";

import { db } from "../../database/index.js";

import { foodReports } from "../../database/schema/food-reports.js";
import { foodListings } from "../../database/schema/food-listings.js";
import { foodRequests } from "../../database/schema/food-requests.js";
import { deliveryTasks } from "../../database/schema/delivery-tasks.js";

import type {
  CreateFoodReportInput,
  FoodReportsFilter,
  ReviewFoodReportInput,
  ResolveFoodReportInput,
  RejectFoodReportInput,
} from "./food-reports.types.js";

export async function createFoodReport(
  reporterId: string,
  input: CreateFoodReportInput,
) {
  return db.transaction(async (tx) => {
    const [listing] = await tx
      .select({
        id: foodListings.id,
        donorId: foodListings.donorId,
      })
      .from(foodListings)
      .where(eq(foodListings.id, input.listingId))
      .limit(1);

    if (!listing) {
      return { error: "LISTING_NOT_FOUND" as const };
    }

    if (listing.donorId === reporterId) {
      return { error: "CANNOT_REPORT_OWN_LISTING" as const };
    }

    let relatedRequestId = input.requestId ?? null;

    if (input.requestId) {
      const [request] = await tx
        .select({
          id: foodRequests.id,
          listingId: foodRequests.listingId,
          recipientId: foodRequests.recipientId,
        })
        .from(foodRequests)
        .where(eq(foodRequests.id, input.requestId))
        .limit(1);

      if (!request) {
        return { error: "REQUEST_NOT_FOUND" as const };
      }

      if (request.listingId !== input.listingId) {
        return { error: "REQUEST_LISTING_MISMATCH" as const };
      }

      const isRequestParticipant =
        request.recipientId === reporterId ||
        listing.donorId === reporterId;

      if (!isRequestParticipant) {
        return { error: "NOT_REQUEST_PARTICIPANT" as const };
      }
    }

    if (input.deliveryTaskId) {
      const [task] = await tx
        .select({
          id: deliveryTasks.id,
          requestId: deliveryTasks.requestId,
          volunteerId: deliveryTasks.volunteerId,
        })
        .from(deliveryTasks)
        .where(eq(deliveryTasks.id, input.deliveryTaskId))
        .limit(1);

      if (!task) {
        return { error: "DELIVERY_TASK_NOT_FOUND" as const };
      }

      if (relatedRequestId && task.requestId !== relatedRequestId) {
        return { error: "TASK_REQUEST_MISMATCH" as const };
      }

      const [request] = await tx
        .select({
          id: foodRequests.id,
          listingId: foodRequests.listingId,
          recipientId: foodRequests.recipientId,
        })
        .from(foodRequests)
        .where(eq(foodRequests.id, task.requestId))
        .limit(1);

      if (!request || request.listingId !== input.listingId) {
        return { error: "TASK_LISTING_MISMATCH" as const };
      }

      const isTaskParticipant =
        request.recipientId === reporterId ||
        listing.donorId === reporterId ||
        task.volunteerId === reporterId;

      if (!isTaskParticipant) {
        return { error: "NOT_TASK_PARTICIPANT" as const };
      }

      relatedRequestId = task.requestId;
    }

    const [report] = await tx
      .insert(foodReports)
      .values({
        reporterId,
        listingId: input.listingId,
        requestId: relatedRequestId,
        deliveryTaskId: input.deliveryTaskId ?? null,
        type: input.type,
        description: input.description,
        evidenceImageUrls: input.evidenceImageUrls,
      })
      .returning();

    return { data: report };
  });
}

export async function findFoodReportsByReporter(
  reporterId: string,
  filter: FoodReportsFilter,
) {
  const conditions: SQL[] = [
    eq(foodReports.reporterId, reporterId),
  ];

  if (filter.status) {
    conditions.push(eq(foodReports.status, filter.status));
  }

  if (filter.type) {
    conditions.push(eq(foodReports.type, filter.type));
  }

  const whereCondition = and(...conditions);
  const offset = (filter.page - 1) * filter.limit;

  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(foodReports)
      .where(whereCondition)
      .orderBy(desc(foodReports.createdAt))
      .limit(filter.limit)
      .offset(offset),

    db
      .select({ id: foodReports.id })
      .from(foodReports)
      .where(whereCondition),
  ]);

  const totalItems = countResult.length;

  return {
    items,
    pagination: {
      page: filter.page,
      limit: filter.limit,
      totalItems,
      totalPages: Math.ceil(totalItems / filter.limit),
    },
  };
}

export async function findAllFoodReports(
  filter: FoodReportsFilter,
) {
  const conditions: SQL[] = [];

  if (filter.status) {
    conditions.push(eq(foodReports.status, filter.status));
  }

  if (filter.type) {
    conditions.push(eq(foodReports.type, filter.type));
  }

  const whereCondition = conditions.length
    ? and(...conditions)
    : undefined;

  const offset = (filter.page - 1) * filter.limit;

  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(foodReports)
      .where(whereCondition)
      .orderBy(desc(foodReports.createdAt))
      .limit(filter.limit)
      .offset(offset),

    db
      .select({ id: foodReports.id })
      .from(foodReports)
      .where(whereCondition),
  ]);

  const totalItems = countResult.length;

  return {
    items,
    pagination: {
      page: filter.page,
      limit: filter.limit,
      totalItems,
      totalPages: Math.ceil(totalItems / filter.limit),
    },
  };
}

export async function findFoodReportById(id: string) {
  const [report] = await db
    .select()
    .from(foodReports)
    .where(eq(foodReports.id, id))
    .limit(1);

  return report ?? null;
}

export async function findFoodReportByIdAndReporter(
  id: string,
  reporterId: string,
) {
  const [report] = await db
    .select()
    .from(foodReports)
    .where(
      and(
        eq(foodReports.id, id),
        eq(foodReports.reporterId, reporterId),
      ),
    )
    .limit(1);

  return report ?? null;
}

export async function startFoodReportReview(
  id: string,
  adminId: string,
  input: ReviewFoodReportInput,
) {
  return db.transaction(async (tx) => {
    const [report] = await tx
      .select()
      .from(foodReports)
      .where(eq(foodReports.id, id))
      .for("update")
      .limit(1);

    if (!report) {
      return { error: "REPORT_NOT_FOUND" as const };
    }

    if (report.status !== "PENDING") {
      return { error: "INVALID_REPORT_STATUS" as const };
    }

    const [updated] = await tx
      .update(foodReports)
      .set({
        status: "REVIEWING",
        reviewedById: adminId,
        reviewedAt: new Date(),
        resolutionNotes: input.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(foodReports.id, id))
      .returning();

    return { data: updated };
  });
}

export async function resolveFoodReport(
  id: string,
  adminId: string,
  input: ResolveFoodReportInput,
) {
  return db.transaction(async (tx) => {
    const [report] = await tx
      .select()
      .from(foodReports)
      .where(eq(foodReports.id, id))
      .for("update")
      .limit(1);

    if (!report) {
      return { error: "REPORT_NOT_FOUND" as const };
    }

    if (report.status !== "REVIEWING") {
      return { error: "INVALID_REPORT_STATUS" as const };
    }

    const [updated] = await tx
      .update(foodReports)
      .set({
        status: "RESOLVED",
        reviewedById: adminId,
        resolutionNotes: input.resolutionNotes,
        reviewedAt: report.reviewedAt ?? new Date(),
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(foodReports.id, id))
      .returning();

    return { data: updated };
  });
}

export async function rejectFoodReport(
  id: string,
  adminId: string,
  input: RejectFoodReportInput,
) {
  return db.transaction(async (tx) => {
    const [report] = await tx
      .select()
      .from(foodReports)
      .where(eq(foodReports.id, id))
      .for("update")
      .limit(1);

    if (!report) {
      return { error: "REPORT_NOT_FOUND" as const };
    }

    if (report.status !== "REVIEWING") {
      return { error: "INVALID_REPORT_STATUS" as const };
    }

    const [updated] = await tx
      .update(foodReports)
      .set({
        status: "REJECTED",
        reviewedById: adminId,
        resolutionNotes: input.resolutionNotes,
        reviewedAt: report.reviewedAt ?? new Date(),
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(foodReports.id, id))
      .returning();

    return { data: updated };
  });
}
