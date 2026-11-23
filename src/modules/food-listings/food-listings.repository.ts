
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  sql,
} from "drizzle-orm";

import { db } from "../../database/index.js";

import {
  users,
  donorProfiles,
  userLocations,
  locations,
  foodCategories,
  foodListings,
  foodImages,
  foodRequests,
  verifications,
} from "../../database/schema/index.js";

import type {
  CreateFoodListingInput,
  ExploreFoodListingsQuery,
} from "./food-listings.types.js";

const ACTIVE_LISTING_STATUSES = [
  "ACTIVE",
  "FULLY_RESERVED",
] as const;

export type CreateListingResult =
  | { success: true; listing: typeof foodListings.$inferSelect }
  | {
      success: false;
      reason:
        | "DONOR_NOT_FOUND"
        | "EMAIL_NOT_VERIFIED"
        | "BUSINESS_NOT_VERIFIED"
        | "CATEGORY_NOT_FOUND"
        | "LOCATION_NOT_FOUND"
        | "INDIVIDUAL_LISTING_LIMIT"
        | "INDIVIDUAL_PORTION_LIMIT";
    };

export async function createFoodListing(
  donorId: string,
  input: CreateFoodListingInput,
): Promise<CreateListingResult> {
  return db.transaction(async (tx) => {
    // Serialize listing creation for the same donor.
    const [user] = await tx
      .select({
        id: users.id,
        emailVerifiedAt: users.emailVerifiedAt,
      })
      .from(users)
      .where(eq(users.id, donorId))
      .for("update")
      .limit(1);

    if (!user) {
      return { success: false, reason: "DONOR_NOT_FOUND" };
    }

    if (!user.emailVerifiedAt) {
      return { success: false, reason: "EMAIL_NOT_VERIFIED" };
    }

    const [profile] = await tx
      .select({
        donorType: donorProfiles.donorType,
      })
      .from(donorProfiles)
      .where(eq(donorProfiles.userId, donorId))
      .limit(1);

    if (!profile) {
      return { success: false, reason: "DONOR_NOT_FOUND" };
    }

    if (profile.donorType === "BUSINESS") {
      const [verification] = await tx
        .select({ id: verifications.id })
        .from(verifications)
        .where(
          and(
            eq(verifications.userId, donorId),
            eq(verifications.verificationType, "DONOR_BUSINESS"),
            eq(verifications.status, "APPROVED"),
          ),
        )
        .limit(1);

      if (!verification) {
        return {
          success: false,
          reason: "BUSINESS_NOT_VERIFIED",
        };
      }
    }

    // Validate category.
    const [category] = await tx
      .select({ id: foodCategories.id })
      .from(foodCategories)
      .where(
        and(
          eq(foodCategories.id, input.categoryId),
          eq(foodCategories.isActive, true),
        ),
      )
      .limit(1);

    if (!category) {
      return {
        success: false,
        reason: "CATEGORY_NOT_FOUND",
      };
    }

    // locationId from API refers to user_locations.id.
    const [userLocation] = await tx
      .select({ locationId: userLocations.locationId })
      .from(userLocations)
      .where(
        and(
          eq(userLocations.id, input.locationId),
          eq(userLocations.userId, donorId),
        ),
      )
      .limit(1);

    if (!userLocation) {
      return {
        success: false,
        reason: "LOCATION_NOT_FOUND",
      };
    }

    if (profile.donorType === "INDIVIDUAL") {
      if (input.totalPortions > 20) {
        return {
          success: false,
          reason: "INDIVIDUAL_PORTION_LIMIT",
        };
      }

      const [activeCount] = await tx
        .select({ total: count() })
        .from(foodListings)
        .where(
          and(
            eq(foodListings.donorId, donorId),
            inArray(
              foodListings.status,
              [...ACTIVE_LISTING_STATUSES],
            ),
          ),
        );

      if ((activeCount?.total ?? 0) >= 3) {
        return {
          success: false,
          reason: "INDIVIDUAL_LISTING_LIMIT",
        };
      }
    }

    const [listing] = await tx
      .insert(foodListings)
      .values({
        donorId,
        categoryId: input.categoryId,
        locationId: userLocation.locationId,
        name: input.name,
        description: input.description ?? null,
        totalPortions: input.totalPortions,
        availablePortions: input.totalPortions,
        isHalal: input.isHalal,
        isVegetarian: input.isVegetarian,
        allergens: input.allergens,
        producedAt: new Date(input.producedAt),
        storageInstructions: input.storageInstructions,
        pickupDeadline: new Date(input.pickupDeadline),
        notes: input.notes ?? null,
        status: "ACTIVE",
      })
      .returning();

    if (!listing) {
      throw new Error("FOOD_LISTING_CREATION_FAILED");
    }

    return { success: true, listing };
  });
}

export async function findFoodListingById(id: string) {
  const [listing] = await db
    .select({
      id: foodListings.id,
      donorId: foodListings.donorId,
      categoryId: foodListings.categoryId,
      locationId: foodListings.locationId,
      name: foodListings.name,
      description: foodListings.description,
      totalPortions: foodListings.totalPortions,
      availablePortions: foodListings.availablePortions,
      isHalal: foodListings.isHalal,
      isVegetarian: foodListings.isVegetarian,
      allergens: foodListings.allergens,
      producedAt: foodListings.producedAt,
      storageInstructions: foodListings.storageInstructions,
      pickupDeadline: foodListings.pickupDeadline,
      notes: foodListings.notes,
      status: foodListings.status,
      createdAt: foodListings.createdAt,
      updatedAt: foodListings.updatedAt,
      closedAt: foodListings.closedAt,
      categoryName: foodCategories.name,
      categorySlug: foodCategories.slug,
    })
    .from(foodListings)
    .innerJoin(
      foodCategories,
      eq(foodListings.categoryId, foodCategories.id),
    )
    .where(eq(foodListings.id, id))
    .limit(1);

  if (!listing) return null;

  const images = await db
    .select()
    .from(foodImages)
    .where(eq(foodImages.listingId, id))
    .orderBy(
      desc(foodImages.isPrimary),
      foodImages.sortOrder,
    );

  return { ...listing, images };
}

export async function findFoodListingsByDonor(
  donorId: string,
) {
  return db
    .select({
      id: foodListings.id,
      name: foodListings.name,
      totalPortions: foodListings.totalPortions,
      availablePortions: foodListings.availablePortions,
      status: foodListings.status,
      pickupDeadline: foodListings.pickupDeadline,
      createdAt: foodListings.createdAt,
      categoryName: foodCategories.name,
    })
    .from(foodListings)
    .innerJoin(
      foodCategories,
      eq(foodListings.categoryId, foodCategories.id),
    )
    .where(eq(foodListings.donorId, donorId))
    .orderBy(desc(foodListings.createdAt));
}

export async function findExploreFoodListings(
  query: ExploreFoodListingsQuery,
) {
  const conditions = [
    eq(foodListings.status, "ACTIVE"),
    gte(foodListings.availablePortions, 1),
    gte(foodListings.pickupDeadline, new Date()),
  ];

  if (query.categoryId) {
    conditions.push(
      eq(foodListings.categoryId, query.categoryId),
    );
  }

  if (query.isHalal !== undefined) {
    conditions.push(
      eq(foodListings.isHalal, query.isHalal === "true"),
    );
  }

  if (query.isVegetarian !== undefined) {
    conditions.push(
      eq(
        foodListings.isVegetarian,
        query.isVegetarian === "true",
      ),
    );
  }

  if (query.search) {
    conditions.push(
      ilike(foodListings.name, `%${query.search}%`),
    );
  }

  if (query.regionId) {
    conditions.push(
      eq(locations.regionId, query.regionId),
    );
  }

  const offset = (query.page - 1) * query.limit;

  const orderBy =
    query.sortBy === "deadline"
      ? foodListings.pickupDeadline
      : foodListings.createdAt;

  const [items, totalResult] = await Promise.all([
    db
      .select({
        id: foodListings.id,
        name: foodListings.name,
        description: foodListings.description,
        availablePortions: foodListings.availablePortions,
        isHalal: foodListings.isHalal,
        isVegetarian: foodListings.isVegetarian,
        allergens: foodListings.allergens,
        producedAt: foodListings.producedAt,
        pickupDeadline: foodListings.pickupDeadline,
        createdAt: foodListings.createdAt,
        category: foodCategories.name,
        categorySlug: foodCategories.slug,
        regionId: locations.regionId,
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
      .where(and(...conditions))
      .orderBy(
        query.sortBy === "deadline"
          ? foodListings.pickupDeadline
          : desc(foodListings.createdAt),
      )
      .limit(query.limit)
      .offset(offset),

    db
      .select({ total: count() })
      .from(foodListings)
      .innerJoin(
        locations,
        eq(foodListings.locationId, locations.id),
      )
      .where(and(...conditions)),
  ]);

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: totalResult[0]?.total ?? 0,
      totalPages: Math.ceil(
        (totalResult[0]?.total ?? 0) / query.limit,
      ),
    },
  };
}

export async function findActiveFoodCategories() {
  return db
    .select({
      id: foodCategories.id,
      name: foodCategories.name,
      slug: foodCategories.slug,
      description: foodCategories.description,
    })
    .from(foodCategories)
    .where(eq(foodCategories.isActive, true))
    .orderBy(foodCategories.name);
}


import type { UpdateFoodListingInput } from "./food-listings.types.js";

const RESERVED_REQUEST_STATUSES = [
  "APPROVED",
  "IN_PROGRESS",
] as const;

const UNRESOLVED_REQUEST_STATUSES = [
  "PENDING",
  "APPROVED",
  "IN_PROGRESS",
] as const;

type ListingMutationResult =
  | { success: true; listing: typeof foodListings.$inferSelect }
  | {
      success: false;
      reason:
        | "NOT_FOUND"
        | "CATEGORY_NOT_FOUND"
        | "LOCATION_NOT_FOUND"
        | "LISTING_NOT_ACTIVE"
        | "PORTIONS_BELOW_RESERVED"
        | "INVALID_DEADLINE";
    };

export async function updateFoodListing(
  donorId: string,
  listingId: string,
  input: UpdateFoodListingInput,
): Promise<ListingMutationResult> {
  return db.transaction(async (tx) => {
    const [listing] = await tx
      .select()
      .from(foodListings)
      .where(
        and(
          eq(foodListings.id, listingId),
          eq(foodListings.donorId, donorId),
        ),
      )
      .for("update")
      .limit(1);

    if (!listing) {
      return { success: false, reason: "NOT_FOUND" };
    }

    if (listing.status !== "ACTIVE") {
      return { success: false, reason: "LISTING_NOT_ACTIVE" };
    }

    const nextProducedAt = input.producedAt
      ? new Date(input.producedAt)
      : listing.producedAt;

    const nextPickupDeadline = input.pickupDeadline
      ? new Date(input.pickupDeadline)
      : listing.pickupDeadline;

    if (nextPickupDeadline <= nextProducedAt) {
      return { success: false, reason: "INVALID_DEADLINE" };
    }

    if (input.categoryId) {
      const [category] = await tx
        .select({ id: foodCategories.id })
        .from(foodCategories)
        .where(
          and(
            eq(foodCategories.id, input.categoryId),
            eq(foodCategories.isActive, true),
          ),
        )
        .limit(1);

      if (!category) {
        return {
          success: false,
          reason: "CATEGORY_NOT_FOUND",
        };
      }
    }

    let nextLocationId = listing.locationId;

    if (input.locationId) {
      const [userLocation] = await tx
        .select({ locationId: userLocations.locationId })
        .from(userLocations)
        .where(
          and(
            eq(userLocations.id, input.locationId),
            eq(userLocations.userId, donorId),
          ),
        )
        .limit(1);

      if (!userLocation) {
        return {
          success: false,
          reason: "LOCATION_NOT_FOUND",
        };
      }

      nextLocationId = userLocation.locationId;
    }

    if (input.totalPortions !== undefined) {
      const requests = await tx
        .select({
          status: foodRequests.status,
          requestedPortions: foodRequests.requestedPortions,
        })
        .from(foodRequests)
        .where(eq(foodRequests.listingId, listingId));

      const reservedPortions = requests
        .filter((request) =>
          (RESERVED_REQUEST_STATUSES as readonly string[]).includes(
            request.status,
          ),
        )
        .reduce(
          (total, request) => total + request.requestedPortions,
          0,
        );

      if (input.totalPortions < reservedPortions) {
        return {
          success: false,
          reason: "PORTIONS_BELOW_RESERVED",
        };
      }
    }

    const updatedValues = {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.categoryId !== undefined && {
        categoryId: input.categoryId,
      }),
      ...(input.locationId !== undefined && {
        locationId: nextLocationId,
      }),
      ...(input.totalPortions !== undefined && {
        totalPortions: input.totalPortions,
        availablePortions: Math.max(
          0,
          input.totalPortions -
            (listing.totalPortions - listing.availablePortions),
        ),
      }),
      ...(input.isHalal !== undefined && {
        isHalal: input.isHalal,
      }),
      ...(input.isVegetarian !== undefined && {
        isVegetarian: input.isVegetarian,
      }),
      ...(input.allergens !== undefined && {
        allergens: input.allergens,
      }),
      ...(input.producedAt !== undefined && {
        producedAt: nextProducedAt,
      }),
      ...(input.storageInstructions !== undefined && {
        storageInstructions: input.storageInstructions,
      }),
      ...(input.pickupDeadline !== undefined && {
        pickupDeadline: nextPickupDeadline,
      }),
      ...(input.notes !== undefined && {
        notes: input.notes,
      }),
      updatedAt: new Date(),
    };

    const [updatedListing] = await tx
      .update(foodListings)
      .set(updatedValues)
      .where(eq(foodListings.id, listingId))
      .returning();

    if (!updatedListing) {
      throw new Error("FOOD_LISTING_UPDATE_FAILED");
    }

    return {
      success: true,
      listing: updatedListing,
    };
  });
}

export async function closeFoodListing(
  donorId: string,
  listingId: string,
): Promise<ListingMutationResult> {
  return db.transaction(async (tx) => {
    const [listing] = await tx
      .select()
      .from(foodListings)
      .where(
        and(
          eq(foodListings.id, listingId),
          eq(foodListings.donorId, donorId),
        ),
      )
      .for("update")
      .limit(1);

    if (!listing) {
      return { success: false, reason: "NOT_FOUND" };
    }

    if (listing.status !== "ACTIVE") {
      return { success: false, reason: "LISTING_NOT_ACTIVE" };
    }

    const [unresolvedRequest] = await tx
      .select({ id: foodRequests.id })
      .from(foodRequests)
      .where(
        and(
          eq(foodRequests.listingId, listingId),
          inArray(
            foodRequests.status,
            [...UNRESOLVED_REQUEST_STATUSES],
          ),
        ),
      )
      .limit(1);

    if (unresolvedRequest) {
      return {
        success: false,
        reason: "LISTING_NOT_ACTIVE",
      };
    }

    const [closedListing] = await tx
      .update(foodListings)
      .set({
        status: "CLOSED",
        availablePortions: 0,
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(foodListings.id, listingId))
      .returning();

    if (!closedListing) {
      throw new Error("FOOD_LISTING_CLOSE_FAILED");
    }

    return {
      success: true,
      listing: closedListing,
    };
  });
}
