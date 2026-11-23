
import { AppError } from "../../shared/middleware/error-handler.js";

import {
  createVerification,
  findVerificationById,
  findVerificationsByUser,
  findVerificationsForAdmin,
  reviewVerification,
} from "./verifications.repository.js";

import {
  getObjectMetadata,
    createUploadUrl,
  createDownloadUrl,
} from "../../integrations/storage/r2.client.js";


import {
  createNotificationSafely,
} from "../notifications/notifications.service.js";

import type {
  CreateVerificationInput,
  VerificationQuery,
} from "./verifications.types.js";
import { randomUUID } from "node:crypto";

const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;

const ALLOWED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_DOCUMENTS = 5;

// =====================================================
// VALIDATE DOCUMENTS IN PRIVATE R2
// =====================================================

async function validateVerificationDocuments(
  userId: string,
  input: CreateVerificationInput,
) {
  if (
    input.documents.length === 0 ||
    input.documents.length > MAX_DOCUMENTS
  ) {
    throw new AppError(
      422,
      `Verification requires 1-${MAX_DOCUMENTS} documents`,
    );
  }

  const prefix = `verification-documents/${userId}/`;

  for (const document of input.documents) {
    const objectKey = document.objectKey;

    // Ensure the object belongs to the authenticated user.
    if (
      !objectKey.startsWith(prefix) ||
      objectKey.includes("..") ||
      objectKey.startsWith("/") ||
      objectKey.includes("\\")
    ) {
      throw new AppError(
        403,
        "Invalid verification document ownership",
      );
    }

    let metadata;

    try {
      metadata = await getObjectMetadata(objectKey);
    } catch {
      throw new AppError(
        422,
        `Verification document not found: ${document.originalFilename}`,
      );
    }

    const contentType = metadata.ContentType?.toLowerCase();
    const contentLength = metadata.ContentLength;

    if (
      !contentType ||
      !ALLOWED_DOCUMENT_TYPES.has(contentType)
    ) {
      throw new AppError(
        422,
        "Unsupported verification document format",
      );
    }

    if (
      typeof contentLength !== "number" ||
      contentLength <= 0 ||
      contentLength > MAX_DOCUMENT_SIZE
    ) {
      throw new AppError(
        422,
        "Verification document must not exceed 10 MB",
      );
    }
  }
}

// =====================================================
// CREATE VERIFICATION
// =====================================================

export async function submitVerification(
  userId: string,
  role: string,
  input: CreateVerificationInput,
) {
  const expectedRole: Record<string, string> = {
    DONOR_BUSINESS: "DONOR_BUSINESS",
    RECEIVER: "RECEIVER",
    VOLUNTEER: "VOLUNTEER",
  };

  if (expectedRole[input.verificationType] !== role) {
    throw new AppError(
      403,
      "Your role cannot submit this verification",
    );
  }

  await validateVerificationDocuments(userId, input);

  const result = await createVerification(userId, input);

  if (!result.success) {
    switch (result.reason) {
      case "USER_NOT_FOUND":
        throw new AppError(404, "User not found");

      case "INVALID_USER_ROLE":
        throw new AppError(
          403,
          "Invalid verification type for this account",
        );

      case "VERIFICATION_ALREADY_EXISTS":
        throw new AppError(
          409,
          "An active or approved verification already exists",
        );

      default:
        throw new AppError(
          500,
          "Failed to submit verification",
        );
    }
  }

  return result.verification;
}

// =====================================================
// GET MY VERIFICATIONS
// =====================================================

export async function getMyVerifications(
  userId: string,
) {
  return findVerificationsByUser(userId);
}

// =====================================================
// GET VERIFICATION DETAIL
// =====================================================

export async function getVerificationDetail(
  verificationId: string,
  userId: string,
  role: string,
) {
  const verification = await findVerificationById(
    verificationId,
  );

  if (!verification) {
    throw new AppError(
      404,
      "Verification not found",
    );
  }

  if (
    verification.userId !== userId &&
    role !== "ADMIN"
  ) {
    throw new AppError(
      403,
      "You are not authorized to view this verification",
    );
  }

  // Do not expose private R2 object keys as public URLs.
  return verification;
}

// =====================================================
// GET VERIFICATIONS FOR ADMIN
// =====================================================

export async function getAdminVerifications(
  role: string,
  query: VerificationQuery,
) {
  if (role !== "ADMIN") {
    throw new AppError(
      403,
      "Only administrators can access verification management",
    );
  }

  return findVerificationsForAdmin(query);
}

// =====================================================
// REVIEW VERIFICATION
// =====================================================

export async function reviewUserVerification(
  adminId: string,
  role: string,
  verificationId: string,
  action: "APPROVE" | "REJECT",
  rejectionReason?: string,
) {
  if (role !== "ADMIN") {
    throw new AppError(
      403,
      "Only administrators can review verifications",
    );
  }

  if (
    action === "REJECT" &&
    (!rejectionReason || rejectionReason.trim().length < 10)
  ) {
    throw new AppError(
      422,
      "Rejection reason must contain at least 10 characters",
    );
  }

  const result = await reviewVerification(
    verificationId,
    adminId,
    action,
    rejectionReason?.trim(),
  );

  if (!result.success) {
    switch (result.reason) {
      case "VERIFICATION_NOT_FOUND":
        throw new AppError(
          404,
          "Verification not found",
        );

      case "VERIFICATION_ALREADY_REVIEWED":
        throw new AppError(
          409,
          "This verification has already been reviewed",
        );

      default:
        throw new AppError(
          500,
          "Failed to review verification",
        );
    }
  }

  const approved = action === "APPROVE";

  await createNotificationSafely({
    userId: result.userId,
    type: approved
      ? "VERIFICATION_APPROVED"
      : "VERIFICATION_REJECTED",
    title: approved
      ? "Verifikasi disetujui"
      : "Verifikasi ditolak",
    body: approved
      ? "Pengajuan verifikasi akun SESAJI kamu telah disetujui."
      : `Pengajuan verifikasi akun SESAJI kamu ditolak. Alasan: ${rejectionReason}`,
    data: {
      verificationId,
      verificationType: result.verificationType,
      status: approved ? "APPROVED" : "REJECTED",
    },
  });

  return result.verification;
}


const DOCUMENT_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function generateVerificationUploadUrl(
  userId: string,
  role: string,
  input: {
    originalFilename: string;
    contentType: string;
    sizeBytes: number;
  },
) {
  const allowedRoles = [
    "DONOR_BUSINESS",
    "RECEIVER",
    "VOLUNTEER",
  ];

  if (!allowedRoles.includes(role)) {
    throw new AppError(
      403,
      "Your role cannot submit verification documents",
    );
  }

  if (
    input.sizeBytes <= 0 ||
    input.sizeBytes > MAX_DOCUMENT_SIZE
  ) {
    throw new AppError(
      422,
      "Document size must not exceed 10 MB",
    );
  }

  const extension = DOCUMENT_EXTENSIONS[input.contentType];

  if (!extension) {
    throw new AppError(
      422,
      "Unsupported document format",
    );
  }

  const objectKey =
    `verification-documents/${userId}/${randomUUID()}.${extension}`;

  try {
    const upload = await createUploadUrl(
      objectKey,
      input.contentType,
    );

    return {
      uploadUrl: upload.uploadUrl,
      objectKey,
      method: "PUT",
      headers: {
        "Content-Type": input.contentType,
      },
      expiresIn: upload.expiresIn,
    };
  } catch {
    throw new AppError(
      502,
      "Failed to generate document upload URL",
    );
  }
}

export async function generateVerificationDocumentUrl(
  verificationId: string,
  documentId: string,
  userId: string,
  role: string,
) {
  const verification = await findVerificationById(
    verificationId,
  );

  if (!verification) {
    throw new AppError(404, "Verification not found");
  }

  if (
    verification.userId !== userId &&
    role !== "ADMIN"
  ) {
    throw new AppError(
      403,
      "You are not authorized to access these documents",
    );
  }

  const document = verification.documents.find(
    (item) => item.id === documentId,
  );

  if (!document) {
    throw new AppError(
      404,
      "Verification document not found",
    );
  }

  try {
    const downloadUrl = await createDownloadUrl(
      document.objectKey,
    );

    return {
      downloadUrl,
      expiresIn: 300,
    };
  } catch {
    throw new AppError(
      502,
      "Failed to generate document access URL",
    );
  }
}
