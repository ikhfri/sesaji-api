import { Router } from "express";

import { authenticate } from "../../shared/middleware/authenticate.js";
import { validate } from "../../shared/middleware/validate.js";

import {
  registerDeviceToken,
  revokeDeviceToken,
} from "./device-tokens.controller.js";

import {
  registerDeviceTokenSchema,
  revokeDeviceTokenSchema,
} from "./device-tokens.validation.js";

const router = Router();

router.use(authenticate);

// POST /device-tokens
router.post(
  "/",
  validate(registerDeviceTokenSchema),
  registerDeviceToken,
);

// DELETE /device-tokens
router.delete(
  "/",
  validate(revokeDeviceTokenSchema),
  revokeDeviceToken,
);

export default router;
