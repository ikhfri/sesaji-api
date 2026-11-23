
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";

import * as foodRequestsController from "./food-requests.controller.js";

import {
  createFoodRequestSchema,
  respondFoodRequestSchema,
  foodRequestParamsSchema,
  foodRequestQuerySchema,
} from "./food-requests.validation.js";

import { authenticate } from "../../shared/middleware/authenticate.js";
import { authorize } from "../../shared/middleware/authorize.js";
import { validate } from "../../shared/middleware/validate.js";
import { AppError } from "../../shared/middleware/error-handler.js";

const router = Router();

function validateRequestId(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const result = foodRequestParamsSchema.safeParse(req.params);

  if (!result.success) {
    return next(new AppError(400, "Invalid food request ID"));
  }

  next();
}

function validateRequestQuery(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const result = foodRequestQuerySchema.safeParse(req.query);

  if (!result.success) {
    return next(
      new AppError(400, "Invalid food request query parameters"),
    );
  }

  res.locals.validatedQuery = result.data;
  next();
}

router.use(authenticate);

router.post(
  "/",
  authorize("RECEIVER"),
  validate(createFoodRequestSchema),
  foodRequestsController.createRequest,
);

router.get(
  "/me",
  authorize(
    "RECEIVER",
    "DONOR_INDIVIDUAL",
    "DONOR_BUSINESS",
  ),
  validateRequestQuery,
  foodRequestsController.getMyRequests,
);

router.get(
  "/incoming",
  authorize("DONOR_INDIVIDUAL", "DONOR_BUSINESS"),
  validateRequestQuery,
  foodRequestsController.getIncomingRequests,
);

router.patch(
  "/:id/respond",
  authorize("DONOR_INDIVIDUAL", "DONOR_BUSINESS"),
  validateRequestId,
  validate(respondFoodRequestSchema),
  foodRequestsController.respondToRequest,
);

router.patch(
  "/:id/cancel",
  authorize("RECEIVER"),
  validateRequestId,
  foodRequestsController.cancelRequest,
);

router.get(
  "/:id",
  authorize(
    "RECEIVER",
    "DONOR_INDIVIDUAL",
    "DONOR_BUSINESS",
    "ADMIN",
  ),
  validateRequestId,
  foodRequestsController.getRequestById,
);

export default router;
