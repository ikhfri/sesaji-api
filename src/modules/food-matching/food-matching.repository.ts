
import { and, eq, gt } from "drizzle-orm";

import { db } from "../../database/index.js";
import {
  foodListings,
  foodCategories,
  locations,
  receiverProfiles,
  receiverNeeds,
  userLocations,
  users,
  verifications,
} from "../../database/schema/index.js";

import type {
  FoodMatchingCandidate,
  ReceiverMatchingContext,
} from "./food-matching.types.js";

export async function findVerifiedReceiverContext(
  userId: string,
): Promise<ReceiverMatchingContext | null> {
  const [verification] = await db
    .select({
      id: verifications.id,
    })
    .from(verifications)
    .where(
      and(
        eq(verifications.userId, userId),
        eq(verifications.verificationType, "RECEIVER"),
        eq(verifications.status, "APPROVED"),
      ),
    )
    .limit(1);

  if (!verification) {
    return null;
  }

  const [receiver] = await db
    .select({
      profileId: receiverProfiles.id,
      userId: receiverProfiles.userId,
      latitude: locations.latitude,
      longitude: locations.longitude,
    })
    .from(receiverProfiles)
    .innerJoin(
      userLocations,
      eq(
        receiverProfiles.defaultUserLocationId,
        userLocations.id,
      ),
    )
    .innerJoin(
      locations,
      eq(userLocations.locationId, locations.id),
    )
    .innerJoin(
      users,
      eq(receiverProfiles.userId, users.id),
    )
    .where(
      and(
        eq(receiverProfiles.userId, userId),
        eq(userLocations.userId, userId),
        eq(userLocations.isDefault, true),
        eq(users.accountStatus, "ACTIVE"),
      ),
    )
    .limit(1);

  if (!receiver) {
    return null;
  }

  const needs = await db
    .select({
      categoryId: receiverNeeds.categoryId,
      requiredPortions: receiverNeeds.requiredPortions,
      specialTags: receiverNeeds.specialTags,
    })
    .from(receiverNeeds)
    .where(
      and(
        eq(receiverNeeds.receiverProfileId, receiver.profileId),
        eq(receiverNeeds.isActive, true),
      ),
    );

  return {
    userId: receiver.userId,
    profileId: receiver.profileId,
    latitude: receiver.latitude,
    longitude: receiver.longitude,
    needs: needs.map((need) => ({
      categoryId: need.categoryId,
      requiredPortions: need.requiredPortions,
      specialTags: need.specialTags,
    })),
  };
}

export async function findMatchingFoodListings(): Promise<
  FoodMatchingCandidate[]
> {
  const listings = await db
    .select({
      id: foodListings.id,
      name: foodListings.name,
      description: foodListings.description,
      categoryId: foodListings.categoryId,
      categoryName: foodCategories.name,
      availablePortions: foodListings.availablePortions,
      isHalal: foodListings.isHalal,
      isVegetarian: foodListings.isVegetarian,
      allergens: foodListings.allergens,
      pickupDeadline: foodListings.pickupDeadline,
      latitude: locations.latitude,
      longitude: locations.longitude,
      locationLabel: locations.label,
    })
    .from(foodListings)
    .innerJoin(
      foodCategories,
      eq(foodListings.categoryId, foodCategories.id),
    )
    .innerJoin(
      locations,
      eq(foodListings.locationId, locations.id),
    )
    .where(
      and(
        eq(foodListings.status, "ACTIVE"),
        gt(foodListings.availablePortions, 0),
        gt(foodListings.pickupDeadline, new Date()),
      ),
    );

  return listings;
}
