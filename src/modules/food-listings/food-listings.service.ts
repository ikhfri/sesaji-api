
import { AppError } from "../../shared/middleware/error-handler.js";

import {
  createFoodListing,
  findActiveFoodCategories,
  findExploreFoodListings,
  findFoodListingById,
  findFoodListingsByDonor,
    updateFoodListing,
  closeFoodListing,
} from "./food-listings.repository.js";

import type {
  CreateFoodListingInput,
  ExploreFoodListingsQuery,
  UpdateFoodListingInput
} from "./food-listings.types.js";

export async function createListing(
  donorId: string,
  role: string,
  input: CreateFoodListingInput,
) {
  if (
    role !== "DONOR_INDIVIDUAL" &&
    role !== "DONOR_BUSINESS"
  ) {
    throw new AppError(
      403,
      "Only donors can create food listings",
    );
  }

  const result = await createFoodListing(donorId, input);

  if (!result.success) {
    switch (result.reason) {
      case "DONOR_NOT_FOUND":
        throw new AppError(404, "Donor profile not found");

      case "EMAIL_NOT_VERIFIED":
        throw new AppError(
          403,
          "Verify your email before creating a listing",
        );

      case "BUSINESS_NOT_VERIFIED":
        throw new AppError(
          403,
          "Business donor verification is required",
        );

      case "CATEGORY_NOT_FOUND":
        throw new AppError(
          400,
          "Food category is invalid or inactive",
        );

      case "LOCATION_NOT_FOUND":
        throw new AppError(
          400,
          "Location does not belong to this donor",
        );

      case "INDIVIDUAL_LISTING_LIMIT":
        throw new AppError(
          409,
          "Individual donors can only have 3 active listings",
        );

      case "INDIVIDUAL_PORTION_LIMIT":
        throw new AppError(
          400,
          "Individual donors can list a maximum of 20 portions",
        );
    }
  }

  return result.listing;
}

export async function getListingById(id: string) {
  const listing = await findFoodListingById(id);

  if (!listing) {
    throw new AppError(404, "Food listing not found");
  }

  return listing;
}

export async function getMyListings(donorId: string) {
  return findFoodListingsByDonor(donorId);
}

export async function exploreListings(
  query: ExploreFoodListingsQuery,
) {
  return findExploreFoodListings(query);
}

export async function getFoodCategories() {
  return findActiveFoodCategories();
}



function handleListingMutationError(
  reason: string,
): never {
  switch (reason) {
    case "NOT_FOUND":
      throw new AppError(404, "Food listing not found");

    case "CATEGORY_NOT_FOUND":
      throw new AppError(400, "Food category is invalid or inactive");

    case "LOCATION_NOT_FOUND":
      throw new AppError(400, "Location does not belong to this donor");

    case "LISTING_NOT_ACTIVE":
      throw new AppError(409, "Only active listings can be modified or closed");

    case "PORTIONS_BELOW_RESERVED":
      throw new AppError(
        409,
        "Total portions cannot be lower than already reserved portions",
      );

    case "INVALID_DEADLINE":
      throw new AppError(
        400,
        "Pickup deadline must be later than produced date",
      );

    case "UNRESOLVED_REQUESTS":
      throw new AppError(
        409,
        "Resolve pending or active requests before closing this listing",
      );

    default:
      throw new AppError(500, "Food listing operation failed");
  }
}

export async function updateListing(
  donorId: string,
  listingId: string,
  input: UpdateFoodListingInput,
) {
  const result = await updateFoodListing(
    donorId,
    listingId,
    input,
  );

  if (!result.success) {
    handleListingMutationError(result.reason);
  }

  return result.listing;
}

export async function closeListing(
  donorId: string,
  listingId: string,
) {
  const result = await closeFoodListing(
    donorId,
    listingId,
  );

  if (!result.success) {
    handleListingMutationError(result.reason);
  }

  return result.listing;
}
