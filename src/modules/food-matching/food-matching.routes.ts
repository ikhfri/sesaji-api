
import { Router } from "express";

import { authenticate } from "../../shared/middleware/authenticate.js";
import { authorize } from "../../shared/middleware/authorize.js";

import {
  getFoodRecommendationsController,
} from "./food-matching.controller.js";

const router = Router();

router.get(
  "/recommendations",
  authenticate,
  authorize("RECEIVER"),
  getFoodRecommendationsController,
);

export default router;
