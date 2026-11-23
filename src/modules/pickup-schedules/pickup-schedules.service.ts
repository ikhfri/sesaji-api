
import { randomInt } from "node:crypto";

import { AppError } from "../../shared/middleware/error-handler.js";

import {
  createPickupSchedule,
  deletePickupSchedule,
  findPickupScheduleById,
  findPickupSchedulesByUser,
  updatePickupSchedule,
} from "./pickup-schedules.repository.js";

import {
  createNotificationSafely,
} from "../notifications/notifications.service.js";

import type {
  CreatePickupScheduleInput,
  UpdatePickupScheduleInput,
} from "./pickup-schedules.types.js";

function isDonor(role: string): boolean {
  return (
    role === "DONOR_INDIVIDUAL" ||
    role === "DONOR_BUSINESS"
  );
}

function generateHandoverCode(): string {
  return randomInt(0, 10000)
    .toString()
    .padStart(4, "0");
}

export async function createSchedule(
  donorId: string,
  role: string,
  input: CreatePickupScheduleInput,
) {
  if (!isDonor(role)) {
    throw new AppError(
      403,
      "Only donors can create pickup schedules",
    );
  }

  const result = await createPickupSchedule(
    donorId,
    input,
    generateHandoverCode(),
  );

  if ("error" in result) {
    switch (result.error) {
      case "REQUEST_NOT_FOUND":
        throw new AppError(404, "Food request not found");

      case "REQUEST_NOT_APPROVED":
        throw new AppError(
          409,
          "Pickup schedule can only be created for approved requests",
        );

      case "AFTER_PICKUP_DEADLINE":
        throw new AppError(
          422,
          "Pickup schedule cannot exceed the listing pickup deadline",
        );

      case "SCHEDULE_ALREADY_EXISTS":
        throw new AppError(
          409,
          "Pickup schedule already exists for this request",
        );
    }
  }

  if (!result.data) {
    throw new AppError(
      500,
      "Failed to create pickup schedule",
    );
  }

  await createNotificationSafely({
    userId: result.recipientId,
    type: "SYSTEM",
    title: "Jadwal pengambilan tersedia",
    body: "Donor telah mengatur jadwal pengambilan makanan untuk permintaanmu.",
    data: {
      scheduleId: result.data.id,
      requestId: input.requestId,
    },
  });

  return result.data;
}

export async function getMySchedules(
  userId: string,
  role: string,
) {
  if (!isDonor(role) && role !== "RECEIVER") {
    throw new AppError(
      403,
      "You are not allowed to access pickup schedules",
    );
  }

  return findPickupSchedulesByUser(userId, role);
}

export async function getScheduleDetail(
  id: string,
  userId: string,
  role: string,
) {
  const schedule = await findPickupScheduleById(id);

  if (!schedule) {
    throw new AppError(404, "Pickup schedule not found");
  }

  const isAdmin = role === "ADMIN";
  const isDonorOwner = schedule.donorId === userId;
  const isRecipientOwner = schedule.recipientId === userId;

  if (!isAdmin && !isDonorOwner && !isRecipientOwner) {
    throw new AppError(
      403,
      "You are not allowed to access this pickup schedule",
    );
  }

  return schedule;
}

export async function updateSchedule(
  id: string,
  donorId: string,
  role: string,
  input: UpdatePickupScheduleInput,
) {
  if (!isDonor(role)) {
    throw new AppError(
      403,
      "Only donors can update pickup schedules",
    );
  }

  const result = await updatePickupSchedule(
    id,
    donorId,
    input,
  );

  if ("error" in result) {
    switch (result.error) {
      case "SCHEDULE_NOT_FOUND":
        throw new AppError(404, "Pickup schedule not found");

      case "REQUEST_NOT_APPROVED":
        throw new AppError(
          409,
          "Pickup schedule cannot be changed because the request is no longer approved",
        );

      case "INVALID_TIME_RANGE":
        throw new AppError(
          422,
          "Scheduled end time must be after start time",
        );

      case "AFTER_PICKUP_DEADLINE":
        throw new AppError(
          422,
          "Pickup schedule cannot exceed the listing pickup deadline",
        );
    }
  }

  if (!result.data) {
    throw new AppError(500, "Failed to update pickup schedule");
  }

  return result.data;
}

export async function removeSchedule(
  id: string,
  donorId: string,
  role: string,
) {
  if (!isDonor(role)) {
    throw new AppError(
      403,
      "Only donors can delete pickup schedules",
    );
  }

  const result = await deletePickupSchedule(id, donorId);

  if ("error" in result) {
    switch (result.error) {
      case "SCHEDULE_NOT_FOUND":
        throw new AppError(404, "Pickup schedule not found");

      case "REQUEST_NOT_APPROVED":
        throw new AppError(
          409,
          "Pickup schedule cannot be deleted because the request is no longer approved",
        );
    }
  }

  return result.data;
}
