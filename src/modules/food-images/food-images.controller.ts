
import type { Request, Response, NextFunction } from "express";

import { AppError } from "../../shared/middleware/error-handler.js";

import * as foodImagesService from "./food-images.service.js";

import type {
  CreateUploadUrlInput,
  CreateFoodImageInput,
} from "./food-images.types.js";

export async function generateUploadUrl(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await foodImagesService.generateUploadUrl(
      req.auth!.userId,
      req.body as CreateUploadUrlInput,
    );

    res.status(200).json({
      success: true,
      message: "Upload URL generated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function registerFoodImage(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const image = await foodImagesService.registerFoodImage(
      req.auth!.userId,
      req.body as CreateFoodImageInput,
    );

    res.status(201).json({
      success: true,
      message: "Food image registered successfully",
      data: image,
    });
  } catch (error) {
    next(error);
  }
}

export async function getListingImages(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const listingId = Array.isArray(req.params.listingId)
      ? req.params.listingId[0]
      : req.params.listingId;

    if (!listingId) {
      throw new AppError(400, "Invalid food listing ID");
    }

    const images = await foodImagesService.getListingImages(
      listingId,
    );

    res.status(200).json({
      success: true,
      message: "Food images retrieved successfully",
      data: images,
    });
  } catch (error) {
    next(error);
  }
}

export async function makePrimaryImage(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const imageId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    if (!imageId) {
      throw new AppError(400, "Invalid food image ID");
    }

    const image = await foodImagesService.makePrimaryImage(
      req.auth!.userId,
      imageId,
    );

    res.status(200).json({
      success: true,
      message: "Primary image updated successfully",
      data: image,
    });
  } catch (error) {
    next(error);
  }
}

export async function removeFoodImage(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const imageId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    if (!imageId) {
      throw new AppError(400, "Invalid food image ID");
    }

    const image = await foodImagesService.removeFoodImage(
      req.auth!.userId,
      imageId,
    );

    res.status(200).json({
      success: true,
      message: "Food image deleted successfully",
      data: image,
    });
  } catch (error) {
    next(error);
  }
}
