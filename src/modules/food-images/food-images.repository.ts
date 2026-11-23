
import {
  and,
  count,
  desc,
  eq,
} from "drizzle-orm";

import { db } from "../../database/index.js";

import {
  foodListings,
  foodImages,
} from "../../database/schema/index.js";

import type {
  CreateFoodImageInput,
} from "./food-images.types.js";

const MAX_IMAGES_PER_LISTING = 5;

export async function findOwnedListing(
  listingId: string,
  donorId: string,
) {
  const [listing] = await db
    .select({
      id: foodListings.id,
      donorId: foodListings.donorId,
    })
    .from(foodListings)
    .where(
      and(
        eq(foodListings.id, listingId),
        eq(foodListings.donorId, donorId),
      ),
    )
    .limit(1);

  return listing ?? null;
}

export async function createFoodImage(
  donorId: string,
  input: CreateFoodImageInput,
  fileUrl: string,
) {
  return db.transaction(async (tx) => {
    // Lock listing to serialize image creation.
    const [listing] = await tx
      .select({
        id: foodListings.id,
      })
      .from(foodListings)
      .where(
        and(
          eq(foodListings.id, input.listingId),
          eq(foodListings.donorId, donorId),
        ),
      )
      .for("update")
      .limit(1);

    if (!listing) {
      return {
        success: false as const,
        reason: "LISTING_NOT_FOUND" as const,
      };
    }

    const [imageCount] = await tx
      .select({
        total: count(),
      })
      .from(foodImages)
      .where(
        eq(foodImages.listingId, input.listingId),
      );

    const totalImages = imageCount?.total ?? 0;

    if (totalImages >= MAX_IMAGES_PER_LISTING) {
      return {
        success: false as const,
        reason: "IMAGE_LIMIT_REACHED" as const,
      };
    }

    // The first image automatically becomes primary.
    const shouldBePrimary =
      input.isPrimary || totalImages === 0;

    // Ensure only one primary image per listing.
    if (shouldBePrimary) {
      await tx
        .update(foodImages)
        .set({
          isPrimary: false,
        })
        .where(
          eq(foodImages.listingId, input.listingId),
        );
    }

    const [image] = await tx
      .insert(foodImages)
      .values({
        listingId: input.listingId,
        fileUrl,
        originalFilename: input.originalFilename,
        altText: input.altText ?? null,
        isPrimary: shouldBePrimary,
        sortOrder: totalImages,
      })
      .returning();

    if (!image) {
      throw new Error("FOOD_IMAGE_CREATION_FAILED");
    }

    return {
      success: true as const,
      image,
    };
  });
}

export async function findFoodImagesByListing(
  listingId: string,
) {
  return db
    .select()
    .from(foodImages)
    .where(
      eq(foodImages.listingId, listingId),
    )
    .orderBy(
      desc(foodImages.isPrimary),
      foodImages.sortOrder,
    );
}

export async function setPrimaryFoodImage(
  donorId: string,
  imageId: string,
) {
  return db.transaction(async (tx) => {
    // Find image and its listing.
    const [image] = await tx
      .select({
        id: foodImages.id,
        listingId: foodImages.listingId,
      })
      .from(foodImages)
      .where(
        eq(foodImages.id, imageId),
      )
      .limit(1);

    if (!image) {
      return {
        success: false as const,
        reason: "IMAGE_NOT_FOUND" as const,
      };
    }

    // Lock listing and verify ownership.
    const [listing] = await tx
      .select({
        id: foodListings.id,
      })
      .from(foodListings)
      .where(
        and(
          eq(foodListings.id, image.listingId),
          eq(foodListings.donorId, donorId),
        ),
      )
      .for("update")
      .limit(1);

    if (!listing) {
      return {
        success: false as const,
        reason: "LISTING_NOT_FOUND" as const,
      };
    }

    // Reset existing primary image.
    await tx
      .update(foodImages)
      .set({
        isPrimary: false,
      })
      .where(
        eq(foodImages.listingId, image.listingId),
      );

    // Set selected image as primary.
    const [updatedImage] = await tx
      .update(foodImages)
      .set({
        isPrimary: true,
      })
      .where(
        eq(foodImages.id, imageId),
      )
      .returning();

    if (!updatedImage) {
      throw new Error("FOOD_IMAGE_UPDATE_FAILED");
    }

    return {
      success: true as const,
      image: updatedImage,
    };
  });
}


export async function deleteFoodImage(
  donorId: string,
  imageId: string,
) {
  return db.transaction(async (tx) => {
    const [image] = await tx
      .select()
      .from(foodImages)
      .where(eq(foodImages.id, imageId))
      .limit(1);

    if (!image) {
      return {
        success: false as const,
        reason: "IMAGE_NOT_FOUND" as const,
      };
    }

    const [listing] = await tx
      .select({
        id: foodListings.id,
      })
      .from(foodListings)
      .where(
        and(
          eq(foodListings.id, image.listingId),
          eq(foodListings.donorId, donorId),
        ),
      )
      .for("update")
      .limit(1);

    if (!listing) {
      return {
        success: false as const,
        reason: "LISTING_NOT_FOUND" as const,
      };
    }

    await tx
      .delete(foodImages)
      .where(eq(foodImages.id, imageId));

    return {
      success: true as const,
      image,
    };
  });
}




export async function findOwnedFoodImage(
  donorId: string,
  imageId: string,
) {
  const [image] = await db
    .select({
      id: foodImages.id,
      listingId: foodImages.listingId,
      fileUrl: foodImages.fileUrl,
      originalFilename: foodImages.originalFilename,
      altText: foodImages.altText,
      isPrimary: foodImages.isPrimary,
      sortOrder: foodImages.sortOrder,
    })
    .from(foodImages)
    .innerJoin(
      foodListings,
      eq(foodImages.listingId, foodListings.id),
    )
    .where(
      and(
        eq(foodImages.id, imageId),
        eq(foodListings.donorId, donorId),
      ),
    )
    .limit(1);

  return image ?? null;
}



