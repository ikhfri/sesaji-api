
import { Router } from "express";

import { authenticate } from "../../shared/middleware/authenticate.js";
import { authorize } from "../../shared/middleware/authorize.js";
import { validate } from "../../shared/middleware/validate.js";

import {
  createPickupScheduleSchema,
  updatePickupScheduleSchema,
  pickupScheduleParamsSchema,
} from "./pickup-schedules.validation.js";

import {
  createScheduleController,
  getMySchedulesController,
  getScheduleDetailController,
  updateScheduleController,
  deleteScheduleController,
} from "./pickup-schedules.controller.js";

const router = Router();

function validateScheduleId(
  req: Parameters<typeof Router>[0] extends never
    ? never
    : import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
) {
  const result = pickupScheduleParamsSchema.safeParse({
    id: req.params.id,
  });

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Invalid pickup schedule ID",
      errors: result.error.issues,
    });
    return;
  }

  next();
}

router.use(authenticate);

router.get(
  "/me",
  authorize(
    "DONOR_INDIVIDUAL",
    "DONOR_BUSINESS",
    "RECEIVER",
  ),
  getMySchedulesController,
);

router.post(
  "/",
  authorize(
    "DONOR_INDIVIDUAL",
    "DONOR_BUSINESS",
  ),
  validate(createPickupScheduleSchema),
  createScheduleController,
);

router.get(
  "/:id",
  validateScheduleId,
  getScheduleDetailController,
);

router.patch(
  "/:id",
  authorize(
    "DONOR_INDIVIDUAL",
    "DONOR_BUSINESS",
  ),
  validateScheduleId,
  validate(updatePickupScheduleSchema),
  updateScheduleController,
);

router.delete(
  "/:id",
  authorize(
    "DONOR_INDIVIDUAL",
    "DONOR_BUSINESS",
  ),
  validateScheduleId,
  deleteScheduleController,
);

export default router;
