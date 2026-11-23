
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";

import * as foodImagesController from "./food-images.controller.js";

import {
  createUploadUrlSchema,
  createFoodImageSchema,
  foodImageParamsSchema,
  listingImageParamsSchema,
} from "./food-images.validation.js";

import { authenticate } from "../../shared/middleware/authenticate.js";
import { authorize } from "../../shared/middleware/authorize.js";
import { validate } from "../../shared/middleware/validate.js";
import { AppError } from "../../shared/middleware/error-handler.js";

const router = Router();

function validateImageId(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const result = foodImageParamsSchema.safeParse(req.params);

  if (!result.success) {
    return next(new AppError(400, "Invalid food image ID"));
  }

  next();
}

function validateListingId(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const result = listingImageParamsSchema.safeParse(req.params);

  if (!result.success) {
    return next(new AppError(400, "Invalid food listing ID"));
  }

  next();
}

// Public endpoint.
router.get(
  "/listing/:listingId",
  validateListingId,
  foodImagesController.getListingImages,
);

// Donor endpoints.
router.use(authenticate);
router.use(authorize("DONOR_INDIVIDUAL", "DONOR_BUSINESS"));

router.post(
  "/upload-url",
  validate(createUploadUrlSchema),
  foodImagesController.generateUploadUrl,
);

router.post(
  "/",
  validate(createFoodImageSchema),
  foodImagesController.registerFoodImage,
);

router.patch(
  "/:id/primary",
  validateImageId,
  foodImagesController.makePrimaryImage,
);

router.delete(
  "/:id",
  validateImageId,
  foodImagesController.removeFoodImage,
);

export default router;
