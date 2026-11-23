
import {
  and,
  desc,
  eq,
} from "drizzle-orm";

import { db } from "../../database/index.js";

import {
  pickupSchedules,
} from "../../database/schema/pickup-schedules.js";

import {
  foodRequests,
} from "../../database/schema/food-requests.js";

import {
  foodListings,
} from "../../database/schema/food-listings.js";

import {
  users,
} from "../../database/schema/users.js";

import type {
  CreatePickupScheduleInput,
  UpdatePickupScheduleInput,
} from "./pickup-schedules.types.js";


export async function findRequestForScheduling(
  requestId: string,
  donorId: string,
) {
  const [result] = await db
    .select({
      requestId: foodRequests.id,
      recipientId: foodRequests.recipientId,
      donorId: foodListings.donorId,
      listingId: foodListings.id,
      requestStatus: foodRequests.status,
      listingStatus: foodListings.status,
      pickupDeadline: foodListings.pickupDeadline,
    })
    .from(foodRequests)
    .innerJoin(
      foodListings,
      eq(foodRequests.listingId, foodListings.id),
    )
    .where(
      and(
        eq(foodRequests.id, requestId),
        eq(foodListings.donorId, donorId),
      ),
    )
    .limit(1);

  return result;
}

export async function findPickupScheduleByRequestId(
  requestId: string,
) {
  const [result] = await db
    .select()
    .from(pickupSchedules)
    .where(eq(pickupSchedules.requestId, requestId))
    .limit(1);

  return result;
}

export async function findPickupScheduleById(
  id: string,
) {
  const [result] = await db
    .select({
      id: pickupSchedules.id,
      requestId: pickupSchedules.requestId,
      scheduledStartAt: pickupSchedules.scheduledStartAt,
      scheduledEndAt: pickupSchedules.scheduledEndAt,
      handoverCode: pickupSchedules.handoverCode,
      notes: pickupSchedules.notes,
      createdAt: pickupSchedules.createdAt,
      updatedAt: pickupSchedules.updatedAt,
      recipientId: foodRequests.recipientId,
      donorId: foodListings.donorId,
      listingId: foodListings.id,
      listingName: foodListings.name,
      recipientName: users.fullName,
    })
    .from(pickupSchedules)
    .innerJoin(
      foodRequests,
      eq(pickupSchedules.requestId, foodRequests.id),
    )
    .innerJoin(
      foodListings,
      eq(foodRequests.listingId, foodListings.id),
    )
    .innerJoin(
      users,
      eq(foodRequests.recipientId, users.id),
    )
    .where(eq(pickupSchedules.id, id))
    .limit(1);

  return result;
}

export async function findPickupSchedulesByUser(
  userId: string,
  role: string,
) {
  const condition =
    role === "DONOR_INDIVIDUAL" ||
    role === "DONOR_BUSINESS"
      ? eq(foodListings.donorId, userId)
      : eq(foodRequests.recipientId, userId);

  return db
    .select({
      id: pickupSchedules.id,
      requestId: pickupSchedules.requestId,
      scheduledStartAt: pickupSchedules.scheduledStartAt,
      scheduledEndAt: pickupSchedules.scheduledEndAt,
      handoverCode: pickupSchedules.handoverCode,
      notes: pickupSchedules.notes,
      createdAt: pickupSchedules.createdAt,
      updatedAt: pickupSchedules.updatedAt,
      listingId: foodListings.id,
      listingName: foodListings.name,
      donorId: foodListings.donorId,
      recipientId: foodRequests.recipientId,
    })
    .from(pickupSchedules)
    .innerJoin(
      foodRequests,
      eq(pickupSchedules.requestId, foodRequests.id),
    )
    .innerJoin(
      foodListings,
      eq(foodRequests.listingId, foodListings.id),
    )
    .where(condition)
    .orderBy(desc(pickupSchedules.scheduledStartAt));
}

export async function createPickupSchedule(
  donorId: string,
  input: CreatePickupScheduleInput,
  handoverCode: string,
) {
  return db.transaction(async (tx) => {
    const [request] = await tx
      .select({
        id: foodRequests.id,
        recipientId: foodRequests.recipientId,
        status: foodRequests.status,
        donorId: foodListings.donorId,
        pickupDeadline: foodListings.pickupDeadline,
      })
      .from(foodRequests)
      .innerJoin(
        foodListings,
        eq(foodRequests.listingId, foodListings.id),
      )
      .where(
        and(
          eq(foodRequests.id, input.requestId),
          eq(foodListings.donorId, donorId),
        ),
      )
      .for("update", { of: foodRequests })
      .limit(1);

    if (!request) {
      return { error: "REQUEST_NOT_FOUND" as const };
    }

    if (request.status !== "APPROVED") {
      return { error: "REQUEST_NOT_APPROVED" as const };
    }

    if (
      new Date(input.scheduledEndAt).getTime() >
      new Date(request.pickupDeadline).getTime()
    ) {
      return { error: "AFTER_PICKUP_DEADLINE" as const };
    }

    const [existing] = await tx
      .select({ id: pickupSchedules.id })
      .from(pickupSchedules)
      .where(eq(pickupSchedules.requestId, input.requestId))
      .limit(1);

    if (existing) {
      return { error: "SCHEDULE_ALREADY_EXISTS" as const };
    }

    const [created] = await tx
      .insert(pickupSchedules)
      .values({
        requestId: input.requestId,
        scheduledStartAt: new Date(input.scheduledStartAt),
        scheduledEndAt: new Date(input.scheduledEndAt),
        handoverCode,
        notes: input.notes ?? null,
      })
      .returning();

    return {
      data: created,
      recipientId: request.recipientId,
    };
  });
}

export async function updatePickupSchedule(
  id: string,
  donorId: string,
  input: UpdatePickupScheduleInput,
) {
  return db.transaction(async (tx) => {
    const [schedule] = await tx
      .select({
        id: pickupSchedules.id,
        requestId: pickupSchedules.requestId,
        scheduledStartAt: pickupSchedules.scheduledStartAt,
        scheduledEndAt: pickupSchedules.scheduledEndAt,
      })
      .from(pickupSchedules)
      .innerJoin(
        foodRequests,
        eq(pickupSchedules.requestId, foodRequests.id),
      )
      .innerJoin(
        foodListings,
        eq(foodRequests.listingId, foodListings.id),
      )
      .where(
        and(
          eq(pickupSchedules.id, id),
          eq(foodListings.donorId, donorId),
        ),
      )
      .for("update", { of: pickupSchedules })
      .limit(1);

    if (!schedule) {
      return { error: "SCHEDULE_NOT_FOUND" as const };
    }

    const [request] = await tx
      .select({
        status: foodRequests.status,
        pickupDeadline: foodListings.pickupDeadline,
      })
      .from(foodRequests)
      .innerJoin(
        foodListings,
        eq(foodRequests.listingId, foodListings.id),
      )
      .where(eq(foodRequests.id, schedule.requestId))
      .limit(1);

    if (!request || request.status !== "APPROVED") {
      return { error: "REQUEST_NOT_APPROVED" as const };
    }

    const startAt = input.scheduledStartAt
      ? new Date(input.scheduledStartAt)
      : schedule.scheduledStartAt;

    const endAt = input.scheduledEndAt
      ? new Date(input.scheduledEndAt)
      : schedule.scheduledEndAt;

    if (endAt.getTime() <= startAt.getTime()) {
      return { error: "INVALID_TIME_RANGE" as const };
    }

    if (
      endAt.getTime() >
      new Date(request.pickupDeadline).getTime()
    ) {
      return { error: "AFTER_PICKUP_DEADLINE" as const };
    }

    const [updated] = await tx
      .update(pickupSchedules)
      .set({
        ...(input.scheduledStartAt && {
          scheduledStartAt: startAt,
        }),
        ...(input.scheduledEndAt && {
          scheduledEndAt: endAt,
        }),
        ...(input.notes !== undefined && {
          notes: input.notes,
        }),
        updatedAt: new Date(),
      })
      .where(eq(pickupSchedules.id, id))
      .returning();

    return { data: updated };
  });
}

export async function deletePickupSchedule(
  id: string,
  donorId: string,
) {
  return db.transaction(async (tx) => {
    const [schedule] = await tx
      .select({
        id: pickupSchedules.id,
        requestId: pickupSchedules.requestId,
      })
      .from(pickupSchedules)
      .innerJoin(
        foodRequests,
        eq(pickupSchedules.requestId, foodRequests.id),
      )
      .innerJoin(
        foodListings,
        eq(foodRequests.listingId, foodListings.id),
      )
      .where(
        and(
          eq(pickupSchedules.id, id),
          eq(foodListings.donorId, donorId),
        ),
      )
      .for("update", { of: pickupSchedules })
      .limit(1);

    if (!schedule) {
      return { error: "SCHEDULE_NOT_FOUND" as const };
    }

    const [request] = await tx
      .select({
        status: foodRequests.status,
      })
      .from(foodRequests)
      .where(eq(foodRequests.id, schedule.requestId))
      .limit(1);

    if (!request || request.status !== "APPROVED") {
      return { error: "REQUEST_NOT_APPROVED" as const };
    }

    await tx
      .delete(pickupSchedules)
      .where(eq(pickupSchedules.id, id));

    return { data: { id } };
  });
}
