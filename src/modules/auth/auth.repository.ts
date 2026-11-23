
import {
  and,
  eq,
  gt,
  isNull,
  or
} from "drizzle-orm";

import { db } from "../../database/index.js";

import { users } from "../../database/schema/users.js";
import { roles } from "../../database/schema/roles.js";
import {
  donorProfiles,
  receiverProfiles,
  volunteerProfiles,
} from "../../database/schema/profiles.js";

import { authSessions } from "../../database/schema/auth-sessions.js";
import { emailVerificationTokens } from "../../database/schema/email-verification-tokens.js";

import type {
  RegisterInput,
  CreateSessionInput,
} from "./auth.types.js";

// ==========================================
// USER QUERIES
// ==========================================

export async function findUserByEmail(email: string) {
  const [user] = await db
    .select({
      id: users.id,
      roleId: users.roleId,
      fullName: users.fullName,
      email: users.email,
      phoneNumber: users.phoneNumber,
      passwordHash: users.passwordHash,
      emailVerifiedAt: users.emailVerifiedAt,
      phoneVerifiedAt: users.phoneVerifiedAt,
      accountStatus: users.accountStatus,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      roleName: roles.name,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.email, email))
    .limit(1);

  return user ?? null;
}

export async function findUserById(userId: string) {
  const [user] = await db
    .select({
      id: users.id,
      roleId: users.roleId,
      fullName: users.fullName,
      email: users.email,
      phoneNumber: users.phoneNumber,
      emailVerifiedAt: users.emailVerifiedAt,
      phoneVerifiedAt: users.phoneVerifiedAt,
      accountStatus: users.accountStatus,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      roleName: roles.name,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, userId))
    .limit(1);

  return user ?? null;
}

export async function findRoleByName(roleName: string) {
  const [role] = await db
    .select()
    .from(roles)
    .where(eq(roles.name, roleName))
    .limit(1);

  return role ?? null;
}

// ==========================================
// REGISTRATION
// ==========================================

export async function createUserWithProfile(input: RegisterInput) {
  return db.transaction(async (tx) => {
    const [role] = await tx
      .select()
      .from(roles)
      .where(eq(roles.name, input.role))
      .limit(1);

    if (!role) {
      throw new Error("ROLE_NOT_FOUND");
    }

    const [user] = await tx
      .insert(users)
      .values({
        roleId: role.id,
        fullName: input.fullName,
        email: input.email,
        phoneNumber: input.phoneNumber ?? null,
        passwordHash: input.passwordHash,
        accountStatus: "PENDING",
      })
      .returning();

    if (!user) {
      throw new Error("USER_CREATION_FAILED");
    }

    switch (input.profile.type) {
      case "DONOR_INDIVIDUAL": {
        if (input.role !== "DONOR_INDIVIDUAL") {
          throw new Error("PROFILE_ROLE_MISMATCH");
        }

        await tx.insert(donorProfiles).values({
          userId: user.id,
          donorType: "INDIVIDUAL",
        });

        break;
      }

      case "DONOR_BUSINESS": {
        if (input.role !== "DONOR_BUSINESS") {
          throw new Error("PROFILE_ROLE_MISMATCH");
        }

        await tx.insert(donorProfiles).values({
          userId: user.id,
          donorType: "BUSINESS",
          businessName: input.profile.businessName,
          businessType: input.profile.businessType,
        });

        break;
      }

      case "RECEIVER": {
        if (input.role !== "RECEIVER") {
          throw new Error("PROFILE_ROLE_MISMATCH");
        }

        await tx.insert(receiverProfiles).values({
          userId: user.id,
          institutionName: input.profile.institutionName,
          institutionType: input.profile.institutionType,
          description: input.profile.description ?? null,
          capacityPortions: input.profile.capacityPortions ?? null,
        });

        break;
      }

      case "VOLUNTEER": {
        if (input.role !== "VOLUNTEER") {
          throw new Error("PROFILE_ROLE_MISMATCH");
        }

        await tx.insert(volunteerProfiles).values({
          userId: user.id,
          vehicleType: input.profile.vehicleType ?? null,
        });

        break;
      }
    }

    return user;
  });
}

// ==========================================
// EMAIL VERIFICATION
// ==========================================

export async function createEmailVerificationToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
) {
  const [token] = await db
    .insert(emailVerificationTokens)
    .values({
      userId,
      tokenHash,
      expiresAt,
    })
    .returning();

  return token ?? null;
}

export async function findValidEmailVerificationToken(
  tokenHash: string,
) {
  const [token] = await db
    .select()
    .from(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.tokenHash, tokenHash),
        isNull(emailVerificationTokens.usedAt),
        gt(emailVerificationTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return token ?? null;
}


export async function consumeEmailVerificationToken(
  tokenId: string,
  userId: string,
) {
  return db.transaction(async (tx) => {
    const [token] = await tx
      .update(emailVerificationTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(emailVerificationTokens.id, tokenId),
          eq(emailVerificationTokens.userId, userId),
          isNull(emailVerificationTokens.usedAt),
          gt(emailVerificationTokens.expiresAt, new Date()),
        ),
      )
      .returning();

    if (!token) return false;

    const [user] = await tx
      .select({
        id: users.id,
        roleName: roles.name,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return false;

    const canActivate =
      user.roleName === "DONOR_INDIVIDUAL" ||
      user.roleName === "VOLUNTEER";

    await tx
      .update(users)
      .set({
        emailVerifiedAt: new Date(),
        ...(canActivate ? { accountStatus: "ACTIVE" } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return true;
  });
}


// ==========================================
// AUTH SESSIONS
// ==========================================

export async function createSession(input: CreateSessionInput) {
  const [session] = await db
    .insert(authSessions)
    .values({
      userId: input.userId,
      refreshTokenHash: input.refreshTokenHash,
      userAgent: input.userAgent ?? null,
      ipAddress: input.ipAddress ?? null,
      expiresAt: input.expiresAt,
      lastUsedAt: new Date(),
    })
    .returning();

  return session ?? null;
}

export async function findSessionByRefreshTokenHash(hash: string) {
  const [session] = await db
    .select()
    .from(authSessions)
    .where(
      and(
        or(
          eq(authSessions.refreshTokenHash, hash),
          eq(authSessions.previousRefreshTokenHash, hash),
        ),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!session) return null;

  return {
    ...session,
    tokenState:
      session.refreshTokenHash === hash
        ? ("current" as const)
        : ("previous" as const),
  };
}

export async function rotateSession(
  sessionId: string,
  oldHash: string,
  newHash: string,
  expiresAt: Date,
): Promise<"rotated" | "reused" | "invalid"> {
  return db.transaction(async (tx) => {
    const now = new Date();

    const [rotated] = await tx
      .update(authSessions)
      .set({
        previousRefreshTokenHash: oldHash,
        refreshTokenHash: newHash,
        expiresAt,
        lastUsedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(authSessions.id, sessionId),
          eq(authSessions.refreshTokenHash, oldHash),
          isNull(authSessions.revokedAt),
          gt(authSessions.expiresAt, now),
        ),
      )
      .returning({ id: authSessions.id });

    if (rotated) return "rotated";

    // Token lama digunakan kembali setelah berhasil dirotasi.
    const [reusedSession] = await tx
      .select({ id: authSessions.id })
      .from(authSessions)
      .where(
        and(
          eq(authSessions.id, sessionId),
          eq(authSessions.previousRefreshTokenHash, oldHash),
          isNull(authSessions.revokedAt),
          gt(authSessions.expiresAt, now),
        ),
      )
      .limit(1);

    if (reusedSession) {
      await tx
        .update(authSessions)
        .set({
          revokedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(authSessions.id, sessionId),
            isNull(authSessions.revokedAt),
          ),
        );

      return "reused";
    }

    return "invalid";
  });
}

export async function revokeSession(
  sessionId: string,
  userId: string,
) {
  const [session] = await db
    .update(authSessions)
    .set({
      revokedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(authSessions.id, sessionId),
        eq(authSessions.userId, userId),
        isNull(authSessions.revokedAt),
      ),
    )
    .returning();

  return session ?? null;
}

export async function revokeAllUserSessions(userId: string) {
  return db
    .update(authSessions)
    .set({
      revokedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(authSessions.userId, userId),
        isNull(authSessions.revokedAt),
      ),
    );
}


export async function findActiveSessionById(sessionId: string) {
  const [session] = await db
    .select()
    .from(authSessions)
    .where(
      and(
        eq(authSessions.id, sessionId),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return session ?? null;
}


export async function replaceEmailVerificationToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
) {
  return db.transaction(async (tx) => {
    const now = new Date();

    // Invalidasi semua token lama yang belum digunakan.
    await tx
      .update(emailVerificationTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(emailVerificationTokens.userId, userId),
          isNull(emailVerificationTokens.usedAt),
        ),
      );

    // Buat token baru dalam transaksi yang sama.
    const [token] = await tx
      .insert(emailVerificationTokens)
      .values({
        userId,
        tokenHash,
        expiresAt,
      })
      .returning();

    return token ?? null;
  });
}
