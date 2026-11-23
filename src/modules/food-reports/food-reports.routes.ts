
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";

import { authenticate } from "../../shared/middleware/authenticate.js";
import { authorize } from "../../shared/middleware/authorize.js";
import { validate } from "../../shared/middleware/validate.js";
import { validateQuery } from "../../shared/middleware/validate-query.js";

import {
  createFoodReportSchema,
  foodReportParamsSchema,
  foodReportsQuerySchema,
  reviewFoodReportSchema,
  resolveFoodReportSchema,
  rejectFoodReportSchema,
} from "./food-reports.validation.js";

import {
  createFoodReportController,
  getAdminFoodReportsController,
  getFoodReportDetailController,
  getMyFoodReportsController,
  rejectFoodReportController,
  resolveFoodReportController,
  reviewFoodReportController,
} from "./food-reports.controller.js";

const router = Router();

function validateReportId(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const result = foodReportParamsSchema.safeParse({
    id: req.params.id,
  });

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Invalid food report ID",
      errors: result.error.issues,
    });
    return;
  }

  next();
}

router.use(authenticate);

// User routes
router.post(
  "/",
  validate(createFoodReportSchema),
  createFoodReportController,
);

router.get(
  "/me",
  validateQuery(foodReportsQuerySchema),
  getMyFoodReportsController,
);

// Admin list
router.get(
  "/admin",
  authorize("ADMIN"),
  validateQuery(foodReportsQuerySchema),
  getAdminFoodReportsController,
);

// Admin review actions
router.patch(
  "/:id/review",
  authorize("ADMIN"),
  validateReportId,
  validate(reviewFoodReportSchema),
  reviewFoodReportController,
);

router.patch(
  "/:id/resolve",
  authorize("ADMIN"),
  validateReportId,
  validate(resolveFoodReportSchema),
  resolveFoodReportController,
);

router.patch(
  "/:id/reject",
  authorize("ADMIN"),
  validateReportId,
  validate(rejectFoodReportSchema),
  rejectFoodReportController,
);

// Detail route — keep after specific routes
router.get(
  "/:id",
  validateReportId,
  getFoodReportDetailController,
);

export default router;
