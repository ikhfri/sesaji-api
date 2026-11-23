
import {
  and,
  count,
  desc,
  eq,
} from "drizzle-orm";

import { db } from "../../database/index.js";

import {
  users,
  roles,
  verifications,
  verificationDocuments,
} from "../../database/schema/index.js";

import type {
  CreateVerificationInput,
  VerificationQuery,
} from "./verifications.types.js";

const REQUIRED_ROLES: Record<string, string> = {
  DONOR_BUSINESS: "DONOR_BUSINESS",
  RECEIVER: "RECEIVER",
  VOLUNTEER: "VOLUNTEER",
};

// =====================================================
// CREATE VERIFICATION
// =====================================================

export async function createVerification(
  userId: string,
  input: CreateVerificationInput,
) {
  return db.transaction(async (tx) => {
    // Lock user to prevent concurrent duplicate submissions.
    const [user] = await tx
      .select({
        id: users.id,
        roleName: roles.name,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, userId))
      .for("update")
      .limit(1);

    if (!user) {
      return {
        success: false as const,
        reason: "USER_NOT_FOUND" as const,
      };
    }

    const requiredRole = REQUIRED_ROLES[
      input.verificationType
    ];

    if (user.roleName !== requiredRole) {
      return {
        success: false as const,
        reason: "INVALID_USER_ROLE" as const,
      };
    }

    const [existing] = await tx
      .select({
        id: verifications.id,
        status: verifications.status,
      })
      .from(verifications)
      .where(
        and(
          eq(verifications.userId, userId),
          eq(
            verifications.verificationType,
            input.verificationType,
          ),
        ),
      )
      .orderBy(desc(verifications.submittedAt))
      .limit(1);

    if (
      existing?.status === "PENDING" ||
      existing?.status === "APPROVED"
    ) {
      return {
        success: false as const,
        reason: "VERIFICATION_ALREADY_EXISTS" as const,
      };
    }

    const [verification] = await tx
      .insert(verifications)
      .values({
        userId,
        verificationType: input.verificationType,
        status: "PENDING",
      })
      .returning();

    if (!verification) {
      throw new Error("Failed to create verification");
    }

    await tx
      .insert(verificationDocuments)
      .values(
        input.documents.map((document) => ({
          verificationId: verification.id,
          documentType: document.documentType,
          // Private R2 object key, not a public URL.
          fileUrl: document.objectKey,
          originalFilename: document.originalFilename,
        })),
      );

    return {
      success: true as const,
      verification,
    };
  });
}

// =====================================================
// FIND VERIFICATION BY ID
// =====================================================

export async function findVerificationById(
  verificationId: string,
) {
  const [verification] = await db
    .select({
      id: verifications.id,
      userId: verifications.userId,
      verificationType: verifications.verificationType,
      status: verifications.status,
      submittedAt: verifications.submittedAt,
      reviewedBy: verifications.reviewedBy,
      reviewedAt: verifications.reviewedAt,
      rejectionReason: verifications.rejectionReason,
      createdAt: verifications.createdAt,
    })
    .from(verifications)
    .where(eq(verifications.id, verificationId))
    .limit(1);

  if (!verification) {
    return null;
  }

  const documents = await db
    .select({
      id: verificationDocuments.id,
      documentType: verificationDocuments.documentType,
      objectKey: verificationDocuments.fileUrl,
      originalFilename: verificationDocuments.originalFilename,
      createdAt: verificationDocuments.createdAt,
    })
    .from(verificationDocuments)
    .where(
      eq(
        verificationDocuments.verificationId,
        verificationId,
      ),
    );

  return {
    ...verification,
    documents,
  };
}

// =====================================================
// FIND USER VERIFICATIONS
// =====================================================

export async function findVerificationsByUser(
  userId: string,
) {
  const records = await db
    .select({
      id: verifications.id,
      verificationType: verifications.verificationType,
      status: verifications.status,
      submittedAt: verifications.submittedAt,
      reviewedAt: verifications.reviewedAt,
      rejectionReason: verifications.rejectionReason,
    })
    .from(verifications)
    .where(eq(verifications.userId, userId))
    .orderBy(desc(verifications.submittedAt));

  return records;
}

// =====================================================
// FIND VERIFICATIONS FOR ADMIN
// =====================================================

export async function findVerificationsForAdmin(
  query: VerificationQuery,
) {
  const conditions = [];

  if (query.status) {
    conditions.push(
      eq(verifications.status, query.status),
    );
  }

  if (query.verificationType) {
    conditions.push(
      eq(
        verifications.verificationType,
        query.verificationType,
      ),
    );
  }

  const whereCondition = conditions.length > 0
    ? and(...conditions)
    : undefined;

  const offset = (query.page - 1) * query.limit;

  const [items, [totalResult]] = await Promise.all([
    db
      .select({
        id: verifications.id,
        userId: verifications.userId,
        userName: users.fullName,
        userEmail: users.email,
        verificationType: verifications.verificationType,
        status: verifications.status,
        submittedAt: verifications.submittedAt,
        reviewedAt: verifications.reviewedAt,
        rejectionReason: verifications.rejectionReason,
      })
      .from(verifications)
      .innerJoin(
        users,
        eq(verifications.userId, users.id),
      )
      .where(whereCondition)
      .orderBy(desc(verifications.submittedAt))
      .limit(query.limit)
      .offset(offset),

    db
      .select({
        total: count(),
      })
      .from(verifications)
      .where(whereCondition),
  ]);

  const total = totalResult?.total ?? 0;

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

// =====================================================
// REVIEW VERIFICATION
// =====================================================

export async function reviewVerification(
  verificationId: string,
  adminId: string,
  action: "APPROVE" | "REJECT",
  rejectionReason?: string,
) {
  return db.transaction(async (tx) => {
    const [verification] = await tx
      .select({
        id: verifications.id,
        userId: verifications.userId,
        verificationType: verifications.verificationType,
        status: verifications.status,
      })
      .from(verifications)
      .where(eq(verifications.id, verificationId))
      .for("update")
      .limit(1);

    if (!verification) {
      return {
        success: false as const,
        reason: "VERIFICATION_NOT_FOUND" as const,
      };
    }

    if (verification.status !== "PENDING") {
      return {
        success: false as const,
        reason: "VERIFICATION_ALREADY_REVIEWED" as const,
      };
    }

    const now = new Date();

    const [updated] = await tx
      .update(verifications)
      .set({
        status: action === "APPROVE"
          ? "APPROVED"
          : "REJECTED",
        reviewedBy: adminId,
        reviewedAt: now,
        rejectionReason: action === "REJECT"
          ? rejectionReason ?? null
          : null,
      })
      .where(eq(verifications.id, verificationId))
      .returning();

    if (!updated) {
      throw new Error("Failed to update verification");
    }

    return {
      success: true as const,
      verification: updated,
      userId: verification.userId,
      verificationType: verification.verificationType,
    };
  });
}
