import { AppError } from "../../shared/middleware/error-handler.js";

import {
  createUserLocation,
  deleteUserLocation,
  findLocationsByUserId,
  findUserLocation,
  setDefaultUserLocation,
  updateUserLocation,
} from "./locations.repository.js";

import type {
  CreateLocationInput,
  UpdateLocationInput,
} from "./locations.types.js";

export async function getMyLocations(userId: string) {
  return findLocationsByUserId(userId);
}

export async function addMyLocation(
  userId: string,
  input: CreateLocationInput,
) {
  try {
    return await createUserLocation(userId, input);
  } catch (error) {
    throw error;
  }
}

export async function updateMyLocation(
  userId: string,
  locationId: string,
  input: UpdateLocationInput,
) {
  const existing = await findUserLocation(userId, locationId);

  if (!existing) {
    throw new AppError(404, "Location not found");
  }

  const updated = await updateUserLocation(
    userId,
    locationId,
    input,
  );

  if (!updated) {
    throw new AppError(404, "Location not found");
  }

  return updated;
}

export async function setMyDefaultLocation(
  userId: string,
  locationId: string,
) {
  const existing = await findUserLocation(userId, locationId);

  if (!existing) {
    throw new AppError(404, "Location not found");
  }

  if (existing.isDefault) {
    return existing;
  }

  const updated = await setDefaultUserLocation(
    userId,
    locationId,
  );

  if (!updated) {
    throw new AppError(404, "Location not found");
  }

  return findUserLocation(userId, locationId);
}

export async function removeMyLocation(
  userId: string,
  locationId: string,
) {
  const existing = await findUserLocation(userId, locationId);

  if (!existing) {
    throw new AppError(404, "Location not found");
  }

  if (existing.isDefault) {
    throw new AppError(
      409,
      "Cannot delete the default location. Set another location as default first.",
    );
  }

  const deleted = await deleteUserLocation(userId, locationId);

  if (!deleted) {
    throw new AppError(404, "Location not found");
  }

  return {
    id: deleted.id,
    message: "Location deleted successfully",
  };
}