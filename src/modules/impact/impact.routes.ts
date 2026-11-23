
import { Router } from "express";

import { authenticate } from "../../shared/middleware/authenticate.js";
import { authorize } from "../../shared/middleware/authorize.js";

import {
  getAdminImpactDashboardController,
  getMyPersonalImpactController,
} from "./impact.controller.js";

const router = Router();

router.get(
  "/admin",
  authenticate,
  authorize("ADMIN"),
  getAdminImpactDashboardController,
);

router.get(
  "/me",
  authenticate,
  authorize(
    "DONOR_INDIVIDUAL",
    "DONOR_BUSINESS",
    "RECEIVER",
    "VOLUNTEER",
  ),
  getMyPersonalImpactController,
);

export default router;
