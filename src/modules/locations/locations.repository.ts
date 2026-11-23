
import { and, eq } from "drizzle-orm";

import { db } from "../../database/index.js";
import {
  locations,
  userLocations,
  users,
  donorProfiles,
  receiverProfiles,
} from "../../database/schema/index.js";

import type {
  CreateLocationInput,
  UpdateLocationInput,
} from "./locations.types.js";

async function lockUser(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], userId: string) {
  await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .for("update");
}

async function syncDefaultLocation(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  userLocationId: string | null,
) {
  await tx
    .update(donorProfiles)
    .set({ defaultUserLocationId: userLocationId })
    .where(eq(donorProfiles.userId, userId));

  await tx
    .update(receiverProfiles)
    .set({ defaultUserLocationId: userLocationId })
    .where(eq(receiverProfiles.userId, userId));
}

export async function findLocationsByUserId(userId: string) {
  return db
    .select({
      id: userLocations.id,
      locationId: locations.id,
      locationType: userLocations.locationType,
      isDefault: userLocations.isDefault,
      address: locations.address,
      latitude: locations.latitude,
      longitude: locations.longitude,
      postalCode: locations.postalCode,
      label: locations.label,
      createdAt: userLocations.createdAt,
    })
    .from(userLocations)
    .innerJoin(
      locations,
      eq(userLocations.locationId, locations.id),
    )
    .where(eq(userLocations.userId, userId));
}

export async function findUserLocation(
  userId: string,
  userLocationId: string,
) {
  const [result] = await db
    .select({
      id: userLocations.id,
      userId: userLocations.userId,
      locationId: locations.id,
      locationType: userLocations.locationType,
      isDefault: userLocations.isDefault,
      address: locations.address,
      latitude: locations.latitude,
      longitude: locations.longitude,
      postalCode: locations.postalCode,
      label: locations.label,
      createdAt: userLocations.createdAt,
    })
    .from(userLocations)
    .innerJoin(
      locations,
      eq(userLocations.locationId, locations.id),
    )
    .where(
      and(
        eq(userLocations.id, userLocationId),
        eq(userLocations.userId, userId),
      ),
    )
    .limit(1);

  return result ?? null;
}

export async function createUserLocation(
  userId: string,
  input: CreateLocationInput,
) {
  return db.transaction(async (tx) => {
    await lockUser(tx, userId);

    const [existingDefault] = await tx
      .select({ id: userLocations.id })
      .from(userLocations)
      .where(
        and(
          eq(userLocations.userId, userId),
          eq(userLocations.isDefault, true),
        ),
      )
      .limit(1);

    const isDefault = input.isDefault === true || !existingDefault;

    if (isDefault) {
      await tx
        .update(userLocations)
        .set({ isDefault: false })
        .where(eq(userLocations.userId, userId));
    }

    const [location] = await tx
      .insert(locations)
      .values({
        address: input.address,
        latitude: input.latitude,
        longitude: input.longitude,
        postalCode: input.postalCode ?? null,
        label: input.label ?? null,
      })
      .returning();

    if (!location) {
      throw new Error("LOCATION_CREATION_FAILED");
    }

    const [userLocation] = await tx
      .insert(userLocations)
      .values({
        userId,
        locationId: location.id,
        locationType: input.locationType,
        isDefault,
      })
      .returning();

    if (!userLocation) {
      throw new Error("USER_LOCATION_CREATION_FAILED");
    }

    if (isDefault) {
      await syncDefaultLocation(tx, userId, userLocation.id);
    }

    return {
      id: userLocation.id,
      locationId: location.id,
      locationType: userLocation.locationType,
      isDefault: userLocation.isDefault,
      address: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
      postalCode: location.postalCode,
      label: location.label,
      createdAt: userLocation.createdAt,
    };
  });
}

export async function updateUserLocation(
  userId: string,
  userLocationId: string,
  input: UpdateLocationInput,
) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: userLocations.id,
        locationId: userLocations.locationId,
      })
      .from(userLocations)
      .where(
        and(
          eq(userLocations.id, userLocationId),
          eq(userLocations.userId, userId),
        ),
      )
      .limit(1);

    if (!existing) return null;

    const { locationType, ...locationInput } = input;

    if (Object.keys(locationInput).length > 0) {
      await tx
        .update(locations)
        .set(locationInput)
        .where(eq(locations.id, existing.locationId));
    }

    if (locationType !== undefined) {
      await tx
        .update(userLocations)
        .set({ locationType })
        .where(eq(userLocations.id, userLocationId));
    }

    const [updated] = await tx
      .select({
        id: userLocations.id,
        locationId: locations.id,
        locationType: userLocations.locationType,
        isDefault: userLocations.isDefault,
        address: locations.address,
        latitude: locations.latitude,
        longitude: locations.longitude,
        postalCode: locations.postalCode,
        label: locations.label,
        createdAt: userLocations.createdAt,
      })
      .from(userLocations)
      .innerJoin(
        locations,
        eq(userLocations.locationId, locations.id),
      )
      .where(eq(userLocations.id, userLocationId))
      .limit(1);

    return updated ?? null;
  });
}

export async function setDefaultUserLocation(
  userId: string,
  userLocationId: string,
) {
  return db.transaction(async (tx) => {
    await lockUser(tx, userId);

    const [target] = await tx
      .select({ id: userLocations.id })
      .from(userLocations)
      .where(
        and(
          eq(userLocations.id, userLocationId),
          eq(userLocations.userId, userId),
        ),
      )
      .limit(1);

    if (!target) return null;

    await tx
      .update(userLocations)
      .set({ isDefault: false })
      .where(eq(userLocations.userId, userId));

    const [updated] = await tx
      .update(userLocations)
      .set({ isDefault: true })
      .where(
        and(
          eq(userLocations.id, userLocationId),
          eq(userLocations.userId, userId),
        ),
      )
      .returning();

    if (!updated) return null;

    await syncDefaultLocation(tx, userId, updated.id);

    return updated;
  });
}

export async function deleteUserLocation(
  userId: string,
  userLocationId: string,
) {
  return db.transaction(async (tx) => {
    const [deleted] = await tx
      .delete(userLocations)
      .where(
        and(
          eq(userLocations.id, userLocationId),
          eq(userLocations.userId, userId),
        ),
      )
      .returning({
        id: userLocations.id,
        locationId: userLocations.locationId,
      });

    return deleted ?? null;
  });
}
