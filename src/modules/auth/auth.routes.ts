
import { Router } from "express";

import * as authController from "./auth.controller.js";
import { authenticate } from "../../shared/middleware/authenticate.js";
import { validate } from "../../shared/middleware/validate.js";
import {
  registerLimiter,
  loginLimiter,
  verificationLimiter,
  resendVerificationLimiter,
  refreshLimiter,
} from "../../shared/middleware/auth-rate-limit.js";
import { csrfProtection } from "../../shared/middleware/csrf-protection.js";
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema
} from "./auth.validation.js";

const router = Router();

router.post(
  "/register",
  registerLimiter,
  validate(registerSchema),
  authController.register,
);

router.post(
  "/login",
  loginLimiter,
  validate(loginSchema),
  authController.login,
);

router.post(
  "/verify-email",
  verificationLimiter,
  validate(verifyEmailSchema),
  authController.verifyEmail,
);

router.post(
  "/resend-verification",
  resendVerificationLimiter,
  validate(resendVerificationSchema),
  authController.resendVerification,
);

router.post(
  "/refresh",
  refreshLimiter,
  csrfProtection,
  authController.refresh,
);
router.post(
  "/logout",
  authenticate,
  authController.logout,
);

router.get(
  "/me",
  authenticate,
  authController.me,
);

export default router;
