
import { AppError } from "../../shared/middleware/error-handler.js";

import {
  findDonationHistoriesByUser,
  findDonationHistoryById,
} from "./donation-histories.repository.js";

import type {
  DonationHistoryQuery,
} from "./donation-histories.types.js";

const ALLOWED_ROLES = [
  "DONOR_INDIVIDUAL",
  "DONOR_BUSINESS",
  "RECEIVER",
  "VOLUNTEER",
  "ADMIN",
] as const;

function assertAllowedRole(role: string): void {
  if (!ALLOWED_ROLES.includes(role as typeof ALLOWED_ROLES[number])) {
    throw new AppError(
      403,
      "You are not allowed to access donation histories",
    );
  }
}

export async function getMyDonationHistories(
  userId: string,
  role: string,
  query: DonationHistoryQuery,
) {
  assertAllowedRole(role);

  return findDonationHistoriesByUser(
    userId,
    role,
    query,
  );
}

export async function getDonationHistoryDetail(
  requestId: string,
  userId: string,
  role: string,
) {
  assertAllowedRole(role);

  const history = await findDonationHistoryById(
    requestId,
    userId,
    role,
  );

  if (!history) {
    throw new AppError(
      404,
      "Donation history not found",
    );
  }

  return history;
}
