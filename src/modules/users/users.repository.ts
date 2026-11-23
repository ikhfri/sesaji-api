import { eq } from "drizzle-orm";

import { db } from "../../database/index.js";
import {
  users,
  roles,
  donorProfiles,
  receiverProfiles,
  volunteerProfiles,
  userLocations,
  locations,
  receiverNeeds,
} from "../../database/schema/index.js";

export async function findUserProfile(userId: string) {
  const [user] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      phoneNumber: users.phoneNumber,
      role: roles.name,
      accountStatus: users.accountStatus,
      emailVerifiedAt: users.emailVerifiedAt,
      phoneVerifiedAt: users.phoneVerifiedAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return null;

  let profile: unknown = null;

  switch (user.role) {
    case "DONOR_INDIVIDUAL":
    case "DONOR_BUSINESS": {
      const [donor] = await db
        .select({
          id: donorProfiles.id,
          donorType: donorProfiles.donorType,
          businessName: donorProfiles.businessName,
          businessType: donorProfiles.businessType,
          createdAt: donorProfiles.createdAt,
          updatedAt: donorProfiles.updatedAt,
        })
        .from(donorProfiles)
        .where(eq(donorProfiles.userId, userId))
        .limit(1);

      profile = donor ?? null;
      break;
    }

    case "RECEIVER": {
      const [receiver] = await db
        .select({
          id: receiverProfiles.id,
          institutionName: receiverProfiles.institutionName,
          institutionType: receiverProfiles.institutionType,
          description: receiverProfiles.description,
          capacityPortions: receiverProfiles.capacityPortions,
          createdAt: receiverProfiles.createdAt,
          updatedAt: receiverProfiles.updatedAt,
        })
        .from(receiverProfiles)
        .where(eq(receiverProfiles.userId, userId))
        .limit(1);

      if (receiver) {
        const needs = await db
          .select({
            id: receiverNeeds.id,
            categoryId: receiverNeeds.categoryId,
            requiredPortions: receiverNeeds.requiredPortions,
            specialTags: receiverNeeds.specialTags,
            notes: receiverNeeds.notes,
            isActive: receiverNeeds.isActive,
          })
          .from(receiverNeeds)
          .where(eq(receiverNeeds.receiverProfileId, receiver.id));

        profile = {
          ...receiver,
          needs,
        };
      }

      break;
    }

    case "VOLUNTEER": {
      const [volunteer] = await db
        .select({
          id: volunteerProfiles.id,
          vehicleType: volunteerProfiles.vehicleType,
          isAvailable: volunteerProfiles.isAvailable,
          preferredRadiusKm: volunteerProfiles.preferredRadiusKm,
          currentLatitude: volunteerProfiles.currentLatitude,
          currentLongitude: volunteerProfiles.currentLongitude,
          lastLocationAt: volunteerProfiles.lastLocationAt,
          createdAt: volunteerProfiles.createdAt,
          updatedAt: volunteerProfiles.updatedAt,
        })
        .from(volunteerProfiles)
        .where(eq(volunteerProfiles.userId, userId))
        .limit(1);

      profile = volunteer ?? null;
      break;
    }
  }

  const userLocationList = await db
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
    .innerJoin(locations, eq(userLocations.locationId, locations.id))
    .where(eq(userLocations.userId, userId));

  return {
    user,
    profile,
    locations: userLocationList,
  };
}

import type {
  UpdateProfileInput,
  UpdateUserInput,
} from "./users.types.js";

export async function updateUserById(
  userId: string,
  input: UpdateUserInput,
) {
  const [updatedUser] = await db
    .update(users)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      phoneNumber: users.phoneNumber,
      accountStatus: users.accountStatus,
      updatedAt: users.updatedAt,
    });

  return updatedUser ?? null;
}

export async function updateRoleProfile(
  userId: string,
  input: UpdateProfileInput,
) {
  switch (input.type) {
    case "DONOR_INDIVIDUAL":
      // Profil donor individu belum memiliki field yang dapat diedit.
      return null;

    case "DONOR_BUSINESS": {
      const [updated] = await db
        .update(donorProfiles)
        .set({
          ...(input.businessName !== undefined && {
            businessName: input.businessName,
          }),
          ...(input.businessType !== undefined && {
            businessType: input.businessType,
          }),
          updatedAt: new Date(),
        })
        .where(eq(donorProfiles.userId, userId))
        .returning();

      return updated ?? null;
    }

    case "RECEIVER": {
      const [updated] = await db
        .update(receiverProfiles)
        .set({
          ...(input.institutionName !== undefined && {
            institutionName: input.institutionName,
          }),
          ...(input.institutionType !== undefined && {
            institutionType: input.institutionType,
          }),
          ...(input.description !== undefined && {
            description: input.description,
          }),
          ...(input.capacityPortions !== undefined && {
            capacityPortions: input.capacityPortions,
          }),
          updatedAt: new Date(),
        })
        .where(eq(receiverProfiles.userId, userId))
        .returning();

      return updated ?? null;
    }

    case "VOLUNTEER": {
      const [updated] = await db
        .update(volunteerProfiles)
        .set({
          ...(input.vehicleType !== undefined && {
            vehicleType: input.vehicleType,
          }),
          ...(input.preferredRadiusKm !== undefined && {
            preferredRadiusKm: String(input.preferredRadiusKm),
          }),
          updatedAt: new Date(),
        })
        .where(eq(volunteerProfiles.userId, userId))
        .returning();

      return updated ?? null;
    }
  }
}