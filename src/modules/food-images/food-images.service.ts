import { randomUUID } from "node:crypto";

import { AppError } from "../../shared/middleware/error-handler.js";

import {
  createUploadUrl,
  getObjectMetadata,
  getPublicObjectUrl,
  deleteObject,
} from "../../integrations/storage/r2.client.js";
import {
  findOwnedFoodImage,
} from "./food-images.repository.js";

import {
  getObjectKeyFromPublicUrl,
} from "../../integrations/storage/r2.client.js";
import {
  findOwnedListing,
  createFoodImage,
  findFoodImagesByListing,
  setPrimaryFoodImage,
  deleteFoodImage,
} from "./food-images.repository.js";

import type {
  CreateUploadUrlInput,
  CreateFoodImageInput,
} from "./food-images.types.js";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function generateUploadUrl(
  donorId: string,
  input: CreateUploadUrlInput,
) {
  const listing = await findOwnedListing(
    input.listingId,
    donorId,
  );

  if (!listing) {
    throw new AppError(404, "Food listing not found");
  }

  if (input.sizeBytes > MAX_FILE_SIZE) {
    throw new AppError(400, "Image size cannot exceed 5 MB");
  }

  const extension = MIME_EXTENSIONS[input.contentType];

  if (!extension) {
    throw new AppError(400, "Unsupported image format");
  }

  const objectKey =
    `food-listings/${input.listingId}/${randomUUID()}.${extension}`;

  const { uploadUrl, expiresIn } = await createUploadUrl(
    objectKey,
    input.contentType,
  );

  return {
    uploadUrl,
    objectKey,
    method: "PUT",
    headers: {
      "Content-Type": input.contentType,
    },
    expiresIn,
  };
}

export async function registerFoodImage(
  donorId: string,
  input: CreateFoodImageInput,
) {
  const listing = await findOwnedListing(
    input.listingId,
    donorId,
  );

  if (!listing) {
    throw new AppError(404, "Food listing not found");
  }

  const expectedPrefix = `food-listings/${input.listingId}/`;

  if (
    !input.objectKey.startsWith(expectedPrefix) ||
    input.objectKey.includes("..") ||
    input.objectKey.startsWith("/")
  ) {
    throw new AppError(400, "Invalid storage object key");
  }

  let metadata;

  try {
    metadata = await getObjectMetadata(input.objectKey);
  } catch {
    throw new AppError(
      400,
      "Uploaded image was not found in storage",
    );
  }

  if (!metadata.ContentType || !MIME_EXTENSIONS[metadata.ContentType]) {
    throw new AppError(400, "Unsupported uploaded image format");
  }

  if (
    metadata.ContentLength === undefined ||
    metadata.ContentLength <= 0 ||
    metadata.ContentLength > MAX_FILE_SIZE
  ) {
    throw new AppError(400, "Uploaded image must be between 1 byte and 5 MB");
  }

  const result = await createFoodImage(
  donorId,
  input,
  getPublicObjectUrl(input.objectKey),
);

if (!result.success) {
  try {
    await deleteObject(input.objectKey);
  } catch {
    throw new AppError(
      502,
      "Image registration failed and storage cleanup is pending",
    );
  }

  if (result.reason === "LISTING_NOT_FOUND") {
    throw new AppError(404, "Food listing not found");
  }

  throw new AppError(
    409,
    "A listing can contain a maximum of 5 images",
  );
}

return result.image;
}

export async function getListingImages(listingId: string) {
  return findFoodImagesByListing(listingId);
}

export async function makePrimaryImage(
  donorId: string,
  imageId: string,
) {
  const result = await setPrimaryFoodImage(
    donorId,
    imageId,
  );

  if (!result.success) {
    if (result.reason === "IMAGE_NOT_FOUND") {
      throw new AppError(404, "Food image not found");
    }

    throw new AppError(404, "Food listing not found");
  }

  return result.image;
}


export async function removeFoodImage(
  donorId: string,
  imageId: string,
) {
  const image = await findOwnedFoodImage(
    donorId,
    imageId,
  );

  if (!image) {
    throw new AppError(404, "Food image not found");
  }

  let objectKey: string;

  try {
    objectKey = getObjectKeyFromPublicUrl(image.fileUrl);
  } catch {
    throw new AppError(
      500,
      "Invalid image storage URL configuration",
    );
  }

  // Delete physical object first.
  try {
    await deleteObject(objectKey);
  } catch {
    throw new AppError(
      502,
      "Failed to delete image from storage",
    );
  }

  // Delete database metadata after storage deletion.
  const result = await deleteFoodImage(
    donorId,
    imageId,
  );

  if (!result.success) {
    throw new AppError(
      500,
      "Image was deleted from storage but metadata cleanup failed",
    );
  }

  return result.image;
}
