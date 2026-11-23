
import { Router } from "express";

import { authenticate } from "../../shared/middleware/authenticate.js";
import { authorize } from "../../shared/middleware/authorize.js";
import { validate } from "../../shared/middleware/validate.js";
import { validateQuery } from "../../shared/middleware/validate-query.js";

import {
  createVerificationController,
  generateUploadUrlController,
  getMyVerificationsController,
  getVerificationDetailController,
  getAdminVerificationsController,
  approveVerificationController,
  rejectVerificationController,
  getVerificationDocumentUrlController,
} from "./verifications.controller.js";

import {
  createVerificationSchema,
  verificationUploadUrlSchema,
  verificationQuerySchema,
  rejectVerificationSchema,
  verificationParamsSchema,
} from "./verifications.validation.js";

const router = Router();

function validateVerificationId(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
) {
  const result = verificationParamsSchema.safeParse({
    id: req.params.id,
  });

  if (!result.success) {
    res.status(422).json({
      success: false,
      message: "Invalid verification ID",
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });

    return;
  }

  next();
}

function validateVerificationDocumentParams(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
) {
  const result = verificationParamsSchema.safeParse({
    id: req.params.id,
  });

  const documentResult = verificationParamsSchema.safeParse({
    id: req.params.documentId,
  });

  if (!result.success || !documentResult.success) {
    res.status(422).json({
      success: false,
      message: "Invalid verification or document ID",
    });

    return;
  }

  next();
}

router.use(authenticate);

// =====================================================
// USER ROUTES
// =====================================================

// POST /verifications/upload-url
router.post(
  "/upload-url",
  validate(verificationUploadUrlSchema),
  generateUploadUrlController,
);

// POST /verifications
router.post(
  "/",
  validate(createVerificationSchema),
  createVerificationController,
);

// GET /verifications/me
router.get(
  "/me",
  getMyVerificationsController,
);

// GET /verifications/:id/documents/:documentId/url
router.get(
  "/:id/documents/:documentId/url",
  validateVerificationDocumentParams,
  getVerificationDocumentUrlController,
);

// =====================================================
// ADMIN ROUTES
// =====================================================

// GET /verifications/admin
router.get(
  "/admin",
  authorize("ADMIN"),
  validateQuery(verificationQuerySchema),
  getAdminVerificationsController,
);

// PATCH /verifications/:id/approve
router.patch(
  "/:id/approve",
  authorize("ADMIN"),
  validateVerificationId,
  approveVerificationController,
);

// PATCH /verifications/:id/reject
router.patch(
  "/:id/reject",
  authorize("ADMIN"),
  validateVerificationId,
  validate(rejectVerificationSchema),
  rejectVerificationController,
);

// =====================================================
// DETAIL ROUTE
// =====================================================

// GET /verifications/:id
router.get(
  "/:id",
  validateVerificationId,
  getVerificationDetailController,
);

export default router;
