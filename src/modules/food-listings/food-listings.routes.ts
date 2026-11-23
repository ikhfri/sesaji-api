
import { Router } from "express";
import { z } from "zod";

import * as foodListingsController from "./food-listings.controller.js";
import {
  createFoodListingSchema,
  exploreFoodListingsQuerySchema,
  foodListingParamsSchema,
  updateFoodListingSchema,
} from "./food-listings.validation.js";

import { authenticate } from "../../shared/middleware/authenticate.js";
import { authorize } from "../../shared/middleware/authorize.js";
import { validate } from "../../shared/middleware/validate.js";
import { AppError } from "../../shared/middleware/error-handler.js";

const router = Router();

function validateListingId(
  req: import("express").Request,
  _res: import("express").Response,
  next: import("express").NextFunction,
) {
  const result = foodListingParamsSchema.safeParse(req.params);

  if (!result.success) {
    return next(new AppError(400, "Invalid food listing ID"));
  }

  next();
}

function validateExploreQuery(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
) {
  const result = exploreFoodListingsQuerySchema.safeParse(req.query);

  if (!result.success) {
    return next(new AppError(400, "Invalid explore query parameters"));
  }

  res.locals.validatedQuery = result.data;
  next();
}

// Public endpoints
router.get(
  "/explore",
  validateExploreQuery,
  foodListingsController.exploreListings,
);

router.get(
  "/categories",
  foodListingsController.getFoodCategories,
);

router.get(
  "/:id",
  validateListingId,
  foodListingsController.getListingById,
);

// Authenticated donor endpoints
router.use(authenticate);

router.get(
  "/me",
  authorize("DONOR_INDIVIDUAL", "DONOR_BUSINESS"),
  foodListingsController.getMyListings,
);

router.post(
  "/",
  authorize("DONOR_INDIVIDUAL", "DONOR_BUSINESS"),
  validate(createFoodListingSchema),
  foodListingsController.createListing,
);

router.patch(
  "/:id",
  authorize("DONOR_INDIVIDUAL", "DONOR_BUSINESS"),
  validateListingId,
  validate(updateFoodListingSchema),
  foodListingsController.updateListing,
);

router.delete(
  "/:id",
  authorize("DONOR_INDIVIDUAL", "DONOR_BUSINESS"),
  validateListingId,
  foodListingsController.closeListing,
);

export default router;
