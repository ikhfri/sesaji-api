
import type { Request, Response, NextFunction } from "express";

import { AppError } from "../../shared/middleware/error-handler.js";

import * as foodListingsService from "./food-listings.service.js";

import type {
  CreateFoodListingInput,
  ExploreFoodListingsQuery,
  UpdateFoodListingInput,
} from "./food-listings.types.js";

export async function createListing(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const listing = await foodListingsService.createListing(
      req.auth!.userId,
      req.auth!.role,
      req.body as CreateFoodListingInput,
    );

    res.status(201).json({
      success: true,
      message: "Food listing created successfully",
      data: listing,
    });
  } catch (error) {
    next(error);
  }
}

export async function getListingById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const listingId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    if (!listingId) {
      throw new AppError(400, "Invalid food listing ID");
    }

    const listing = await foodListingsService.getListingById(listingId);

    res.status(200).json({
      success: true,
      message: "Food listing retrieved successfully",
      data: listing,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyListings(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const listings = await foodListingsService.getMyListings(
      req.auth!.userId,
    );

    res.status(200).json({
      success: true,
      message: "My food listings retrieved successfully",
      data: listings,
    });
  } catch (error) {
    next(error);
  }
}

export async function exploreListings(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await foodListingsService.exploreListings(
      res.locals.validatedQuery as ExploreFoodListingsQuery,
    );

    res.status(200).json({
      success: true,
      message: "Food listings retrieved successfully",
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function getFoodCategories(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const categories = await foodListingsService.getFoodCategories();

    res.status(200).json({
      success: true,
      message: "Food categories retrieved successfully",
      data: categories,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateListing(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const listingId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    if (!listingId) {
      throw new AppError(400, "Invalid food listing ID");
    }

    const listing = await foodListingsService.updateListing(
      req.auth!.userId,
      listingId,
      req.body as UpdateFoodListingInput,
    );

    res.status(200).json({
      success: true,
      message: "Food listing updated successfully",
      data: listing,
    });
  } catch (error) {
    next(error);
  }
}

export async function closeListing(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const listingId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    if (!listingId) {
      throw new AppError(400, "Invalid food listing ID");
    }

    const listing = await foodListingsService.closeListing(
      req.auth!.userId,
      listingId,
    );

    res.status(200).json({
      success: true,
      message: "Food listing closed successfully",
      data: listing,
    });
  } catch (error) {
    next(error);
  }
}
