import { Router } from "express";

import { authenticate } from "../../shared/middleware/authenticate.js";
import { validate } from "../../shared/middleware/validate.js";

import {
  getProfile,
  updateMe,
  updateProfile,
} from "./users.controller.js";

import {
  updateProfileSchema,
  updateUserSchema,
} from "./users.validation.js";

const router = Router();

router.use(authenticate);

router.get("/me/profile", getProfile);

router.patch(
  "/me",
  validate(updateUserSchema),
  updateMe,
);

router.patch(
  "/me/profile",
  validate(updateProfileSchema),
  updateProfile,
);

export default router;