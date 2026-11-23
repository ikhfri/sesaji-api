
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";

import { authenticate } from "../../shared/middleware/authenticate.js";
import { authorize } from "../../shared/middleware/authorize.js";
import { validateQuery } from "../../shared/middleware/validate-query.js";

import {
  donationHistoryParamsSchema,
  donationHistoryQuerySchema,
} from "./donation-histories.validation.js";

import {
  getDonationHistoryDetailController,
  getMyDonationHistoriesController,
} from "./donation-histories.controller.js";

const router = Router();

function validateHistoryId(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const result = donationHistoryParamsSchema.safeParse({
    id: req.params.id,
  });

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Invalid donation history ID",
      errors: result.error.issues,
    });
    return;
  }

  next();
}

router.use(authenticate);

const historyRoles = [
  "DONOR_INDIVIDUAL",
  "DONOR_BUSINESS",
  "RECEIVER",
  "VOLUNTEER",
  "ADMIN",
] as const;

router.get(
  "/me",
  authorize(...historyRoles),
  validateQuery(donationHistoryQuerySchema),
  getMyDonationHistoriesController,
);

router.get(
  "/:id",
  authorize(...historyRoles),
  validateHistoryId,
  getDonationHistoryDetailController,
);

export default router;
