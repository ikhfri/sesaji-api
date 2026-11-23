
import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { AppError } from "../../shared/middleware/error-handler.js";

import {
  submitVerification,
  getMyVerifications,
  getVerificationDetail,
  getAdminVerifications,
  reviewUserVerification,
  generateVerificationUploadUrl,
  generateVerificationDocumentUrl,
} from "./verifications.service.js";

import type {
  CreateVerificationBody,
  RejectVerificationBody,
  VerificationUploadUrlBody,
} from "./verifications.validation.js";

import type {
  VerificationQuery,
} from "./verifications.types.js";

// =====================================================
// ROUTE PARAM HELPER
// =====================================================

function getRouteParam(
  value: string | string[] | undefined,
  name: string,
): string {
  const param = Array.isArray(value)
    ? value[0]
    : value;

  if (!param) {
    throw new AppError(
      400,
      `Missing route parameter: ${name}`,
    );
  }

  return param;
}

// =====================================================
// CREATE VERIFICATION
// =====================================================

export async function createVerificationController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await submitVerification(
      req.auth!.userId,
      req.auth!.role,
      req.body as CreateVerificationBody,
    );

    res.status(201).json({
      success: true,
      message: "Verification submitted successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// =====================================================
// GENERATE DOCUMENT UPLOAD URL
// =====================================================

export async function generateUploadUrlController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await generateVerificationUploadUrl(
      req.auth!.userId,
      req.auth!.role,
      req.body as VerificationUploadUrlBody,
    );

    res.status(200).json({
      success: true,
      message: "Verification upload URL generated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// =====================================================
// GET MY VERIFICATIONS
// =====================================================

export async function getMyVerificationsController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await getMyVerifications(
      req.auth!.userId,
    );

    res.status(200).json({
      success: true,
      message: "Verifications retrieved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// =====================================================
// GET VERIFICATION DETAIL
// =====================================================

export async function getVerificationDetailController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = getRouteParam(
      req.params.id,
      "id",
    );

    const result = await getVerificationDetail(
      id,
      req.auth!.userId,
      req.auth!.role,
    );

    res.status(200).json({
      success: true,
      message: "Verification retrieved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// =====================================================
// GET ADMIN VERIFICATIONS
// =====================================================

export async function getAdminVerificationsController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = res.locals.validatedQuery as VerificationQuery;

    const result = await getAdminVerifications(
      req.auth!.role,
      query,
    );

    res.status(200).json({
      success: true,
      message: "Verification list retrieved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// =====================================================
// APPROVE VERIFICATION
// =====================================================

export async function approveVerificationController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = getRouteParam(
      req.params.id,
      "id",
    );

    const result = await reviewUserVerification(
      req.auth!.userId,
      req.auth!.role,
      id,
      "APPROVE",
    );

    res.status(200).json({
      success: true,
      message: "Verification approved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// =====================================================
// REJECT VERIFICATION
// =====================================================

export async function rejectVerificationController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = getRouteParam(
      req.params.id,
      "id",
    );

    const body = req.body as RejectVerificationBody;

    const result = await reviewUserVerification(
      req.auth!.userId,
      req.auth!.role,
      id,
      "REJECT",
      body.rejectionReason,
    );

    res.status(200).json({
      success: true,
      message: "Verification rejected successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// =====================================================
// GET PRIVATE DOCUMENT URL
// =====================================================

export async function getVerificationDocumentUrlController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const verificationId = getRouteParam(
      req.params.id,
      "id",
    );

    const documentId = getRouteParam(
      req.params.documentId,
      "documentId",
    );

    const result = await generateVerificationDocumentUrl(
      verificationId,
      documentId,
      req.auth!.userId,
      req.auth!.role,
    );

    res.status(200).json({
      success: true,
      message: "Document access URL generated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
