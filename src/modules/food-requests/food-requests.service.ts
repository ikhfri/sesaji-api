
import { AppError } from "../../shared/middleware/error-handler.js";

import {
  createFoodRequest,
  findFoodRequestById,
  findRequestsByRecipient,
  findIncomingRequests,
  respondToFoodRequest,
  cancelFoodRequest,
} from "./food-requests.repository.js";

import {
  createNotificationSafely,
} from "../notifications/notifications.service.js";

import type {
  CreateFoodRequestInput,
  FoodRequestQuery,
} from "./food-requests.types.js";

// =====================================================
// CREATE FOOD REQUEST
// =====================================================

export async function createRequest(
  recipientId: string,
  role: string,
  input: CreateFoodRequestInput,
) {
  if (role !== "RECEIVER") {
    throw new AppError(
      403,
      "Only receivers can create food requests",
    );
  }

  const result = await createFoodRequest(
    recipientId,
    input,
  );

  if (!result.success) {
    switch (result.reason) {
      case "RECEIVER_NOT_FOUND":
        throw new AppError(404, "Receiver not found");

      case "RECEIVER_NOT_VERIFIED":
        throw new AppError(
          403,
          "Receiver verification is required",
        );

      case "LISTING_NOT_FOUND":
        throw new AppError(404, "Food listing not found");

      case "LISTING_NOT_AVAILABLE":
        throw new AppError(
          409,
          "Food listing is no longer available",
        );

      case "CANNOT_REQUEST_OWN_LISTING":
        throw new AppError(
          403,
          "You cannot request your own food listing",
        );

      case "INVALID_PORTIONS":
        throw new AppError(
          400,
          "Requested portions exceed available portions",
        );

      default:
        throw new AppError(
          500,
          "Failed to create food request",
        );
    }
  }

  const request = result.request;

  // Retrieve donor information for notification.
  const detail = await findFoodRequestById(request.id);

  if (detail) {
    await createNotificationSafely({
      userId: detail.donorId,
      type: "NEW_FOOD_REQUEST",
      title: "Permintaan makanan baru",
      body: "Ada penerima yang mengajukan permintaan untuk listing makanan Anda.",
      data: {
        requestId: request.id,
        listingId: detail.listingId,
      },
    });
  }

  return request;
}

// =====================================================
// GET FOOD REQUEST BY ID
// =====================================================

export async function getRequestById(
  requestId: string,
  userId: string,
  role: string,
) {
  const request = await findFoodRequestById(requestId);

  if (!request) {
    throw new AppError(404, "Food request not found");
  }

  const isRecipient = request.recipientId === userId;
  const isDonor = request.donorId === userId;

  if (!isRecipient && !isDonor && role !== "ADMIN") {
    throw new AppError(
      403,
      "You are not authorized to view this food request",
    );
  }

  return request;
}

export async function getMyRequests(
  userId: string,
  role: string,
  query: FoodRequestQuery,
) {
  if (role === "RECEIVER") {
    return findRequestsByRecipient(userId, query);
  }

  if (
    role === "DONOR_INDIVIDUAL" ||
    role === "DONOR_BUSINESS"
  ) {
    return findIncomingRequests(userId, query);
  }

  throw new AppError(
    403,
    "Your role cannot access food requests",
  );
}

// =====================================================
// GET INCOMING FOOD REQUESTS
// =====================================================

export async function getIncomingRequests(
  donorId: string,
  query: FoodRequestQuery,
) {
  return findIncomingRequests(donorId, query);
}

// =====================================================
// RESPOND TO FOOD REQUEST
// =====================================================

export async function respondToRequest(
  donorId: string,
  requestId: string,
  action: "APPROVE" | "REJECT",
  rejectionReason?: string,
) {
  // Get request details before changing its status.
  const existingRequest = await findFoodRequestById(
    requestId,
  );

  if (!existingRequest) {
    throw new AppError(404, "Food request not found");
  }

  const result = await respondToFoodRequest(
    donorId,
    requestId,
    action,
    rejectionReason,
  );

  if (!result.success) {
    switch (result.reason) {
      case "REQUEST_NOT_FOUND":
      case "LISTING_NOT_FOUND":
        throw new AppError(404, "Food request not found");

      case "NOT_AUTHORIZED":
        throw new AppError(
          403,
          "You are not authorized to respond to this request",
        );

      case "REQUEST_ALREADY_PROCESSED":
        throw new AppError(
          409,
          "This food request has already been processed",
        );

      case "INSUFFICIENT_STOCK":
        throw new AppError(
          409,
          "Listing is no longer available or has insufficient stock",
        );

      default:
        throw new AppError(
          500,
          "Failed to respond to food request",
        );
    }
  }

  // Notify receiver after successful response.
  await createNotificationSafely({
    userId: existingRequest.recipientId,
    type:
      action === "APPROVE"
        ? "REQUEST_APPROVED"
        : "REQUEST_REJECTED",
    title:
      action === "APPROVE"
        ? "Permintaan disetujui"
        : "Permintaan ditolak",
    body:
      action === "APPROVE"
        ? "Donor telah menyetujui permintaan makanan Anda."
        : "Donor belum dapat memenuhi permintaan makanan Anda.",
    data: {
      requestId,
      listingId: existingRequest.listingId,
    },
  });

  return result.request;
}

// =====================================================
// CANCEL FOOD REQUEST
// =====================================================

export async function cancelRequest(
  recipientId: string,
  requestId: string,
) {
  const result = await cancelFoodRequest(
    recipientId,
    requestId,
  );

  if (!result.success) {
    switch (result.reason) {
      case "REQUEST_NOT_FOUND":
        throw new AppError(404, "Food request not found");

      case "NOT_AUTHORIZED":
        throw new AppError(
          403,
          "You are not authorized to cancel this request",
        );

      case "REQUEST_ALREADY_PROCESSED":
        throw new AppError(
          409,
          "Only pending requests can be cancelled",
        );

      default:
        throw new AppError(
          500,
          "Failed to cancel food request",
        );
    }
  }

  return result.request;
}
