
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";

import { authenticate } from "../../shared/middleware/authenticate.js";
import { authorize } from "../../shared/middleware/authorize.js";
import { validate } from "../../shared/middleware/validate.js";
import { AppError } from "../../shared/middleware/error-handler.js";

import {
  createRegion,
  deleteRegion,
  getRegion,
  getRegionChildren,
  getRegions,
  updateRegion,
} from "./regions.controller.js";

import {
  createRegionSchema,
  updateRegionSchema,
  regionParamsSchema,
} from "./regions.validation.js";

const router = Router();

function validateRegionId(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const result = regionParamsSchema.safeParse(req.params);

  if (!result.success) {
    next(new AppError(400, "Invalid region ID"));
    return;
  }

  next();
}

// Public endpoints
router.get("/", getRegions);

router.get(
  "/:id/children",
  validateRegionId,
  getRegionChildren,
);

router.get(
  "/:id",
  validateRegionId,
  getRegion,
);

// Admin-only endpoints
router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  validate(createRegionSchema),
  createRegion,
);

router.patch(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validateRegionId,
  validate(updateRegionSchema),
  updateRegion,
);

router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validateRegionId,
  deleteRegion,
);

export default router;
