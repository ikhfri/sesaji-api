
import { AppError } from "../../shared/middleware/error-handler.js";

import {
  claimDeliveryTask,
  confirmDeliveryHandover,
  findAvailableTasks,
  findDeliveryTaskById,
  findEligibleVolunteer,
  findVolunteerTasks,
  updateDeliveryTaskStatus,
} from "./delivery-tasks.repository.js";

import type {
  AvailableTasksInput,
  ConfirmDeliveryHandoverInput,
  UpdateDeliveryTaskStatusInput,
} from "./delivery-tasks.types.js";

// =====================================================
// HELPERS
// =====================================================

function assertVolunteer(role: string): void {
  if (role !== "VOLUNTEER") {
    throw new AppError(
      403,
      "Only volunteers can perform this action",
    );
  }
}

// =====================================================
// AVAILABLE TASKS
// =====================================================

export async function getAvailableTasks(
  userId: string,
  role: string,
  input: AvailableTasksInput,
) {
  assertVolunteer(role);

  const volunteer = await findEligibleVolunteer(userId);

  if (!volunteer) {
    throw new AppError(
      404,
      "Volunteer profile not found",
    );
  }

  if (!volunteer.isAvailable) {
    throw new AppError(
      403,
      "Set your volunteer availability before viewing tasks",
    );
  }

  if (!volunteer.verificationStatus) {
    throw new AppError(
      403,
      "Volunteer verification is required",
    );
  }

  return findAvailableTasks(input);
}

// =====================================================
// MY DELIVERY TASKS
// =====================================================

export async function getMyDeliveryTasks(
  userId: string,
  role: string,
) {
  assertVolunteer(role);

  return findVolunteerTasks(userId);
}

// =====================================================
// DELIVERY TASK DETAIL
// =====================================================

export async function getDeliveryTaskDetail(
  taskId: string,
  userId: string,
  role: string,
) {
  const task = await findDeliveryTaskById(taskId);

  if (!task) {
    throw new AppError(
      404,
      "Delivery task not found",
    );
  }

  const isAdmin = role === "ADMIN";
  const isVolunteer = task.volunteerId === userId;
  const isDonor = task.donorId === userId;
  const isRecipient = task.recipientId === userId;

  if (
    !isAdmin &&
    !isVolunteer &&
    !isDonor &&
    !isRecipient
  ) {
    throw new AppError(
      403,
      "You are not allowed to access this delivery task",
    );
  }

  // Handover code is exclusively visible to the receiver.
  if (!isRecipient) {
    const {
      handoverCode: _hidden,
      ...safeTask
    } = task;

    return safeTask;
  }

  return task;
}

// =====================================================
// CLAIM DELIVERY TASK
// =====================================================

export async function claimTask(
  taskId: string,
  volunteerId: string,
  role: string,
) {
  assertVolunteer(role);

  const result = await claimDeliveryTask(
    taskId,
    volunteerId,
  );

  if ("error" in result) {
    switch (result.error) {
      case "VOLUNTEER_PROFILE_NOT_FOUND":
        throw new AppError(
          404,
          "Volunteer profile not found",
        );

      case "VOLUNTEER_NOT_AVAILABLE":
        throw new AppError(
          409,
          "You must be available to claim a task",
        );

      case "VOLUNTEER_NOT_VERIFIED":
        throw new AppError(
          403,
          "Volunteer verification is required",
        );

      case "TASK_NOT_FOUND":
        throw new AppError(
          404,
          "Delivery task not found",
        );

      case "TASK_NOT_OPEN":
      case "TASK_ALREADY_CLAIMED":
        throw new AppError(
          409,
          "Delivery task is no longer available",
        );

      case "TASK_EXPIRED":
        throw new AppError(
          410,
          "Delivery task has expired",
        );

      default:
        throw new AppError(
          500,
          "Failed to claim delivery task",
        );
    }
  }

  if (!result.data) {
    throw new AppError(
      500,
      "Failed to claim delivery task",
    );
  }

  return result.data;
}

// =====================================================
// UPDATE DELIVERY TASK STATUS
// =====================================================

export async function updateTaskStatus(
  taskId: string,
  volunteerId: string,
  role: string,
  input: UpdateDeliveryTaskStatusInput,
) {
  assertVolunteer(role);

  const result = await updateDeliveryTaskStatus(
    taskId,
    volunteerId,
    input,
  );

  if ("error" in result) {
    switch (result.error) {
      case "TASK_NOT_FOUND":
        throw new AppError(
          404,
          "Delivery task not found",
        );

      case "NOT_TASK_OWNER":
        throw new AppError(
          403,
          "This task is not assigned to you",
        );

      case "INVALID_STATUS_TRANSITION":
        throw new AppError(
          409,
          "Invalid delivery task status transition",
        );

      case "REQUEST_NOT_IN_PROGRESS":
        throw new AppError(
          409,
          "Food request is not in the expected state for pickup",
        );

      default:
        throw new AppError(
          500,
          "Failed to update delivery task",
        );
    }
  }

  if (!result.data) {
    throw new AppError(
      500,
      "Failed to update delivery task",
    );
  }

  return result.data;
}

// =====================================================
// CONFIRM DELIVERY HANDOVER
// =====================================================

export async function confirmHandover(
  taskId: string,
  recipientId: string,
  role: string,
  input: ConfirmDeliveryHandoverInput,
) {
  if (role !== "RECEIVER") {
    throw new AppError(
      403,
      "Only receivers can confirm food handover",
    );
  }

  const result = await confirmDeliveryHandover(
    taskId,
    recipientId,
    input.handoverCode,
  );

  if ("error" in result) {
    switch (result.error) {
      case "TASK_NOT_FOUND":
        throw new AppError(
          404,
          "Delivery task not found",
        );

      case "NOT_REQUEST_OWNER":
        throw new AppError(
          403,
          "This delivery task does not belong to you",
        );

      case "TASK_NOT_DELIVERED":
        throw new AppError(
          409,
          "Delivery task has not been marked as delivered",
        );

      case "INVALID_HANDOVER_CODE":
        throw new AppError(
          422,
          "Invalid handover code",
        );

      case "REQUEST_NOT_IN_PROGRESS":
        throw new AppError(
          409,
          "Food request is not in progress",
        );

      default:
        throw new AppError(
          500,
          "Failed to confirm food handover",
        );
    }
  }

  if (!result.data) {
    throw new AppError(
      500,
      "Failed to confirm food handover",
    );
  }

  return result.data;
}
