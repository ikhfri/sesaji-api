import { AppError } from "../../shared/middleware/error-handler.js";

import {
  findUserProfile,
  updateRoleProfile,
  updateUserById,
} from "./users.repository.js";

import type {
  UpdateProfileInput,
  UpdateUserInput,
} from "./users.types.js";

function isPostgresUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

export async function getMyProfile(userId: string) {
  const result = await findUserProfile(userId);

  if (!result) {
    throw new AppError(404, "User not found");
  }

  return result;
}

export async function updateMyAccount(
  userId: string,
  input: UpdateUserInput,
) {
  try {
    const updatedUser = await updateUserById(userId, input);

    if (!updatedUser) {
      throw new AppError(404, "User not found");
    }

    return await getMyProfile(userId);
  } catch (error) {
    if (error instanceof AppError) throw error;

    if (isPostgresUniqueViolation(error)) {
      throw new AppError(409, "Phone number is already registered");
    }

    throw error;
  }
}

export async function updateMyRoleProfile(
  userId: string,
  input: UpdateProfileInput,
) {
  const currentProfile = await findUserProfile(userId);

  if (!currentProfile) {
    throw new AppError(404, "User not found");
  }

  if (currentProfile.user.role !== input.type) {
    throw new AppError(403, "Profile type does not match your account role");
  }

  if (input.type === "DONOR_INDIVIDUAL") {
    throw new AppError(400, "Individual donor profile has no editable fields");
  }

  const updatedProfile = await updateRoleProfile(userId, input);

  if (!updatedProfile) {
    throw new AppError(404, "User profile not found");
  }

  return await getMyProfile(userId);
}