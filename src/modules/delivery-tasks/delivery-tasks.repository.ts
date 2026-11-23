
import {
  and,
  asc,
  desc,
  eq,
  gt,
  isNull,
  or,
  sql,
} from "drizzle-orm";

import { db } from "../../database/index.js";

import { users } from "../../database/schema/users.js";
import { volunteerProfiles } from "../../database/schema/profiles.js";
import { verifications } from "../../database/schema/verifications.js";
import { foodRequests } from "../../database/schema/food-requests.js";
import { foodListings } from "../../database/schema/food-listings.js";
import { locations } from "../../database/schema/locations.js";
import { pickupSchedules } from "../../database/schema/pickup-schedules.js";
import { deliveryTasks } from "../../database/schema/delivery-tasks.js";
import { taskEvents } from "../../database/schema/task-events.js";

import type {
  AvailableTasksInput,
  UpdateDeliveryTaskStatusInput,
} from "./delivery-tasks.types.js";

// =====================================================
// VOLUNTEER VALIDATION
// =====================================================

export async function findEligibleVolunteer(
  volunteerId: string,
) {
  const [result] = await db
    .select({
      userId: users.id,
      isAvailable: volunteerProfiles.isAvailable,
      verificationStatus: verifications.status,
    })
    .from(users)
    .innerJoin(
      volunteerProfiles,
      eq(volunteerProfiles.userId, users.id),
    )
    .leftJoin(
      verifications,
      and(
        eq(verifications.userId, users.id),
        eq(verifications.verificationType, "VOLUNTEER"),
        eq(verifications.status, "APPROVED"),
      ),
    )
    .where(eq(users.id, volunteerId))
    .limit(1);

  return result;
}

// =====================================================
// AVAILABLE TASKS
// =====================================================

export async function findAvailableTasks(
  input: AvailableTasksInput,
) {
  const offset = (input.page - 1) * input.limit;
  const now = new Date();

  const availabilityCondition = and(
    eq(deliveryTasks.status, "OPEN"),
    eq(foodRequests.status, "APPROVED"),
    or(
      isNull(deliveryTasks.expiresAt),
      gt(deliveryTasks.expiresAt, now),
    ),
  );

  const items = await db
    .select({
      id: deliveryTasks.id,
      requestId: deliveryTasks.requestId,
      status: deliveryTasks.status,
      expiresAt: deliveryTasks.expiresAt,
      createdAt: deliveryTasks.createdAt,

      scheduledStartAt: pickupSchedules.scheduledStartAt,
      scheduledEndAt: pickupSchedules.scheduledEndAt,

      listingId: foodListings.id,
      listingName: foodListings.name,
      listingDescription: foodListings.description,

      requestedPortions: foodRequests.requestedPortions,
    })
    .from(deliveryTasks)
    .innerJoin(
      foodRequests,
      eq(deliveryTasks.requestId, foodRequests.id),
    )
    .innerJoin(
      foodListings,
      eq(foodRequests.listingId, foodListings.id),
    )
    .innerJoin(
      pickupSchedules,
      eq(pickupSchedules.requestId, foodRequests.id),
    )
    .where(availabilityCondition)
    .orderBy(
      asc(pickupSchedules.scheduledStartAt),
      desc(deliveryTasks.createdAt),
    )
    .limit(input.limit)
    .offset(offset);

  const [countResult] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(deliveryTasks)
    .innerJoin(
      foodRequests,
      eq(deliveryTasks.requestId, foodRequests.id),
    )
    .innerJoin(
      pickupSchedules,
      eq(pickupSchedules.requestId, foodRequests.id),
    )
    .where(availabilityCondition);

  const total = countResult?.count ?? 0;

  return {
    items,
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
    },
  };
}

// =====================================================
// VOLUNTEER TASKS
// =====================================================

export async function findVolunteerTasks(
  volunteerId: string,
) {
  return db
    .select({
      id: deliveryTasks.id,
      requestId: deliveryTasks.requestId,
      status: deliveryTasks.status,

      assignedAt: deliveryTasks.assignedAt,
      pickedUpAt: deliveryTasks.pickedUpAt,
      deliveredAt: deliveryTasks.deliveredAt,
      completedAt: deliveryTasks.completedAt,

      expiresAt: deliveryTasks.expiresAt,
      createdAt: deliveryTasks.createdAt,
      updatedAt: deliveryTasks.updatedAt,

      scheduledStartAt: pickupSchedules.scheduledStartAt,
      scheduledEndAt: pickupSchedules.scheduledEndAt,

      listingName: foodListings.name,
      requestedPortions: foodRequests.requestedPortions,
      recipientId: foodRequests.recipientId,
    })
    .from(deliveryTasks)
    .innerJoin(
      foodRequests,
      eq(deliveryTasks.requestId, foodRequests.id),
    )
    .innerJoin(
      foodListings,
      eq(foodRequests.listingId, foodListings.id),
    )
    .leftJoin(
      pickupSchedules,
      eq(pickupSchedules.requestId, foodRequests.id),
    )
    .where(eq(deliveryTasks.volunteerId, volunteerId))
    .orderBy(desc(deliveryTasks.createdAt));
}

// =====================================================
// TASK DETAIL
// =====================================================

export async function findDeliveryTaskById(
  taskId: string,
) {
  const [task] = await db
    .select({
      id: deliveryTasks.id,
      requestId: deliveryTasks.requestId,
      volunteerId: deliveryTasks.volunteerId,
      status: deliveryTasks.status,

      assignedAt: deliveryTasks.assignedAt,
      pickedUpAt: deliveryTasks.pickedUpAt,
      deliveredAt: deliveryTasks.deliveredAt,
      completedAt: deliveryTasks.completedAt,
      cancelledAt: deliveryTasks.cancelledAt,

      expiresAt: deliveryTasks.expiresAt,
      cancellationReason: deliveryTasks.cancellationReason,

      createdAt: deliveryTasks.createdAt,
      updatedAt: deliveryTasks.updatedAt,

      recipientId: foodRequests.recipientId,
      requestedPortions: foodRequests.requestedPortions,

      donorId: foodListings.donorId,
      listingId: foodListings.id,
      listingName: foodListings.name,
      listingDescription: foodListings.description,

      scheduledStartAt: pickupSchedules.scheduledStartAt,
      scheduledEndAt: pickupSchedules.scheduledEndAt,
      handoverCode: pickupSchedules.handoverCode,

      pickupAddress: locations.address,
      pickupLatitude: locations.latitude,
      pickupLongitude: locations.longitude,
    })
    .from(deliveryTasks)
    .innerJoin(
      foodRequests,
      eq(deliveryTasks.requestId, foodRequests.id),
    )
    .innerJoin(
      foodListings,
      eq(foodRequests.listingId, foodListings.id),
    )
    .innerJoin(
      locations,
      eq(foodListings.locationId, locations.id),
    )
    .leftJoin(
      pickupSchedules,
      eq(pickupSchedules.requestId, foodRequests.id),
    )
    .where(eq(deliveryTasks.id, taskId))
    .limit(1);

  if (!task) {
    return undefined;
  }

  const events = await db
    .select()
    .from(taskEvents)
    .where(eq(taskEvents.deliveryTaskId, taskId))
    .orderBy(asc(taskEvents.createdAt));

  return {
    ...task,
    events,
  };
}

// =====================================================
// CLAIM TASK
// =====================================================

export async function claimDeliveryTask(
  taskId: string,
  volunteerId: string,
) {
  return db.transaction(async (tx) => {
    // Lock volunteer profile to serialize claims
    // made by the same volunteer.
    const [volunteer] = await tx
      .select({
        isAvailable: volunteerProfiles.isAvailable,
      })
      .from(volunteerProfiles)
      .where(
        eq(volunteerProfiles.userId, volunteerId),
      )
      .for("update")
      .limit(1);

    if (!volunteer) {
      return {
        error: "VOLUNTEER_PROFILE_NOT_FOUND" as const,
      };
    }

    if (!volunteer.isAvailable) {
      return {
        error: "VOLUNTEER_NOT_AVAILABLE" as const,
      };
    }

    // Check approved volunteer verification.
    const [approvedVerification] = await tx
      .select({
        id: verifications.id,
      })
      .from(verifications)
      .where(
        and(
          eq(verifications.userId, volunteerId),
          eq(verifications.verificationType, "VOLUNTEER"),
          eq(verifications.status, "APPROVED"),
        ),
      )
      .limit(1);

    if (!approvedVerification) {
      return {
        error: "VOLUNTEER_NOT_VERIFIED" as const,
      };
    }

    // Lock task to prevent concurrent claims.
    const [task] = await tx
      .select({
        id: deliveryTasks.id,
        requestId: deliveryTasks.requestId,
        status: deliveryTasks.status,
        expiresAt: deliveryTasks.expiresAt,
      })
      .from(deliveryTasks)
      .where(eq(deliveryTasks.id, taskId))
      .for("update")
      .limit(1);

    if (!task) {
      return {
        error: "TASK_NOT_FOUND" as const,
      };
    }

    if (task.status !== "OPEN") {
      return {
        error: "TASK_NOT_OPEN" as const,
      };
    }

    if (
      task.expiresAt &&
      task.expiresAt.getTime() <= Date.now()
    ) {
      const now = new Date();

      await tx
        .update(deliveryTasks)
        .set({
          status: "EXPIRED",
          updatedAt: now,
        })
        .where(eq(deliveryTasks.id, taskId));

      await tx.insert(taskEvents).values({
        deliveryTaskId: taskId,
        actorId: null,
        eventType: "TASK_EXPIRED",
        previousStatus: "OPEN",
        newStatus: "EXPIRED",
        notes: "Task expired before being claimed",
      });

      return {
        error: "TASK_EXPIRED" as const,
      };
    }

    // Recheck status during update as an additional safeguard.
    const now = new Date();

    const [updated] = await tx
      .update(deliveryTasks)
      .set({
        volunteerId,
        status: "ASSIGNED",
        assignedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(deliveryTasks.id, taskId),
          eq(deliveryTasks.status, "OPEN"),
          isNull(deliveryTasks.volunteerId),
        ),
      )
      .returning();

    if (!updated) {
      return {
        error: "TASK_ALREADY_CLAIMED" as const,
      };
    }

    await tx.insert(taskEvents).values({
      deliveryTaskId: taskId,
      actorId: volunteerId,
      eventType: "TASK_CLAIMED",
      previousStatus: "OPEN",
      newStatus: "ASSIGNED",
      notes: "Volunteer claimed the delivery task",
    });

    return {
      data: updated,
      requestId: task.requestId,
    };
  });
}

// =====================================================
// UPDATE TASK STATUS BY VOLUNTEER
// =====================================================

export async function updateDeliveryTaskStatus(
  taskId: string,
  volunteerId: string,
  input: UpdateDeliveryTaskStatusInput,
) {
  return db.transaction(async (tx) => {
    const [task] = await tx
      .select({
        id: deliveryTasks.id,
        requestId: deliveryTasks.requestId,
        status: deliveryTasks.status,
        volunteerId: deliveryTasks.volunteerId,
      })
      .from(deliveryTasks)
      .where(eq(deliveryTasks.id, taskId))
      .for("update")
      .limit(1);

    if (!task) {
      return {
        error: "TASK_NOT_FOUND" as const,
      };
    }

    if (task.volunteerId !== volunteerId) {
      return {
        error: "NOT_TASK_OWNER" as const,
      };
    }

    const allowedTransitions: Record<string, string[]> = {
      ASSIGNED: ["PICKED_UP"],
      PICKED_UP: ["DELIVERED"],
    };

    const allowed = allowedTransitions[task.status] ?? [];

    if (!allowed.includes(input.status)) {
      return {
        error: "INVALID_STATUS_TRANSITION" as const,
      };
    }

    const now = new Date();

    // Update food request when volunteer picks up food.
    if (input.status === "PICKED_UP") {
      const [updatedRequest] = await tx
        .update(foodRequests)
        .set({
          status: "IN_PROGRESS",
          updatedAt: now,
        })
        .where(
          and(
            eq(foodRequests.id, task.requestId),
            eq(foodRequests.status, "APPROVED"),
          ),
        )
        .returning({
          id: foodRequests.id,
        });

      if (!updatedRequest) {
        return {
          error: "REQUEST_NOT_IN_PROGRESS" as const,
        };
      }
    }

    const [updated] = await tx
      .update(deliveryTasks)
      .set({
        status: input.status,
        updatedAt: now,
        ...(input.status === "PICKED_UP" && {
          pickedUpAt: now,
        }),
        ...(input.status === "DELIVERED" && {
          deliveredAt: now,
        }),
      })
      .where(
        and(
          eq(deliveryTasks.id, taskId),
          eq(deliveryTasks.volunteerId, volunteerId),
        ),
      )
      .returning();

    if (!updated) {
      // Throw to rollback any previous request update.
      throw new Error("Failed to update delivery task");
    }

    await tx.insert(taskEvents).values({
      deliveryTaskId: taskId,
      actorId: volunteerId,
      eventType: `TASK_${input.status}`,
      previousStatus: task.status,
      newStatus: input.status,
      proofImageUrl: input.proofImageUrl,
      notes: input.notes ?? null,
    });

    return {
      data: updated,
      requestId: task.requestId,
    };
  });
}

// =====================================================
// CONFIRM DELIVERY HANDOVER BY RECEIVER
// =====================================================

export async function confirmDeliveryHandover(
  taskId: string,
  recipientId: string,
  handoverCode: string,
) {
  return db.transaction(async (tx) => {
    // Lock delivery task to prevent concurrent confirmations.
    const [task] = await tx
      .select({
        id: deliveryTasks.id,
        requestId: deliveryTasks.requestId,
        volunteerId: deliveryTasks.volunteerId,
        status: deliveryTasks.status,

        recipientId: foodRequests.recipientId,
        handoverCode: pickupSchedules.handoverCode,
      })
      .from(deliveryTasks)
      .innerJoin(
        foodRequests,
        eq(deliveryTasks.requestId, foodRequests.id),
      )
      .innerJoin(
        pickupSchedules,
        eq(pickupSchedules.requestId, foodRequests.id),
      )
      .where(eq(deliveryTasks.id, taskId))
      .for("update", {
        of: deliveryTasks,
      })
      .limit(1);

    if (!task) {
      return {
        error: "TASK_NOT_FOUND" as const,
      };
    }

    if (task.recipientId !== recipientId) {
      return {
        error: "NOT_REQUEST_OWNER" as const,
      };
    }

    if (task.status !== "DELIVERED") {
      return {
        error: "TASK_NOT_DELIVERED" as const,
      };
    }

    if (
      !task.handoverCode ||
      task.handoverCode !== handoverCode
    ) {
      return {
        error: "INVALID_HANDOVER_CODE" as const,
      };
    }

    const now = new Date();

    // Complete the food request.
    const [updatedRequest] = await tx
      .update(foodRequests)
      .set({
        status: "COMPLETED",
        completedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(foodRequests.id, task.requestId),
          eq(foodRequests.status, "IN_PROGRESS"),
        ),
      )
      .returning({
        id: foodRequests.id,
      });

    if (!updatedRequest) {
      return {
        error: "REQUEST_NOT_IN_PROGRESS" as const,
      };
    }

    // Complete delivery task.
    const [updatedTask] = await tx
      .update(deliveryTasks)
      .set({
        status: "COMPLETED",
        completedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(deliveryTasks.id, taskId),
          eq(deliveryTasks.status, "DELIVERED"),
        ),
      )
      .returning();

    if (!updatedTask) {
      // Throw to rollback the food request update.
      throw new Error("Failed to complete delivery task");
    }

    // Record handover confirmation.
    await tx.insert(taskEvents).values({
      deliveryTaskId: taskId,
      actorId: recipientId,
      eventType: "HANDOVER_CONFIRMED",
      previousStatus: "DELIVERED",
      newStatus: "COMPLETED",
      notes: "Receiver confirmed food handover using the handover code",
    });

    return {
      data: updatedTask,
      requestId: task.requestId,
      volunteerId: task.volunteerId,
    };
  });
}
