
import argon2 from "argon2";
import {
  createHash,
  randomBytes,
} from "node:crypto";
import { SignJWT } from "jose";

import { env } from "../../config/env.js";
import { AppError } from "../../shared/middleware/error-handler.js";
import { sendVerificationEmail } from "../../shared/services/email.service.js";

import {
  findUserByEmail,
  findUserById,
  createUserWithProfile,
  createEmailVerificationToken,
  findValidEmailVerificationToken,
  consumeEmailVerificationToken,
  createSession,
  findSessionByRefreshTokenHash,
  rotateSession,
  revokeSession,
  replaceEmailVerificationToken
} from "./auth.repository.js";

import type {
  RegisterInput,
  RegisterRole,
  CreateSessionInput,
} from "./auth.types.js";



const accessSecret = new TextEncoder().encode(
  env.JWT_ACCESS_SECRET,
);

const EMAIL_VERIFICATION_TTL = 15 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function generateOpaqueToken(): string {
  return randomBytes(32).toString("hex");
}

function parseDuration(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);

  if (!match) {
    throw new Error(`Invalid duration format: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };

  const multiplier = unit ? multipliers[unit] : undefined;

  if (!multiplier || !Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error(`Invalid duration format: ${value}`);
  }

  return amount * multiplier;
}

async function createAccessToken(
  userId: string,
  role: string,
  sessionId: string,
) {
  return new SignJWT({
    role,
    sid: sessionId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_EXPIRES_IN)
    .sign(accessSecret);
}

async function issueSession(
  userId: string,
  role: string,
  metadata: Omit<CreateSessionInput, "userId" | "refreshTokenHash" | "expiresAt">,
) {
  const refreshToken = generateOpaqueToken();
  const refreshTokenHash = hashToken(refreshToken);

  const expiresAt = new Date(
    Date.now() + parseDuration(env.JWT_REFRESH_EXPIRES_IN),
  );

  const session = await createSession({
    userId,
    refreshTokenHash,
    expiresAt,
    ...metadata,
  });

  if (!session) {
    throw new AppError(500, "Failed to create authentication session");
  }

  const accessToken = await createAccessToken(
    userId,
    role,
    session.id,
  );

  return {
    accessToken,
    refreshToken,
    expiresAt,
  };
}

// ==========================================
// REGISTER
// ==========================================

type RegisterPayload = Omit<RegisterInput, "passwordHash"> & {
  password: string;
};

export async function register(input: RegisterPayload) {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();

  const existingUser = await findUserByEmail(email);

  if (existingUser) {
    throw new AppError(409, "Email is already registered");
  }

  const allowedRoles: RegisterRole[] = [
    "DONOR_INDIVIDUAL",
    "DONOR_BUSINESS",
    "RECEIVER",
    "VOLUNTEER",
  ];

  if (!allowedRoles.includes(input.role)) {
    throw new AppError(400, "Invalid registration role");
  }

  if (
    input.role === "DONOR_INDIVIDUAL" &&
    input.profile.type !== "DONOR_INDIVIDUAL"
  ) {
    throw new AppError(400, "Invalid donor profile");
  }

  if (
    input.role === "DONOR_BUSINESS" &&
    input.profile.type !== "DONOR_BUSINESS"
  ) {
    throw new AppError(400, "Invalid business profile");
  }

  if (
    input.role === "RECEIVER" &&
    input.profile.type !== "RECEIVER"
  ) {
    throw new AppError(400, "Invalid receiver profile");
  }

  if (
    input.role === "VOLUNTEER" &&
    input.profile.type !== "VOLUNTEER"
  ) {
    throw new AppError(400, "Invalid volunteer profile");
  }

  const passwordHash = await argon2.hash(input.password, {
    type: argon2.argon2id,
  });

  let user;

  try {
    user = await createUserWithProfile({
      ...input,
      fullName,
      email,
      passwordHash,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new AppError(409, "Email or phone number is already registered");
    }

    if (
      error instanceof Error &&
      error.message === "ROLE_NOT_FOUND"
    ) {
      throw new AppError(500, "Registration role is not configured");
    }

    throw error;
  }

  const verificationToken = generateOpaqueToken();

  await createEmailVerificationToken(
    user.id,
    hashToken(verificationToken),
    new Date(Date.now() + EMAIL_VERIFICATION_TTL),
  );

  try {
    await sendVerificationEmail(
      email,
      fullName,
      verificationToken,
    );
  } catch {
    throw new AppError(
      503,
      "Account created, but verification email could not be sent. Please request a new verification email.",
    );
  }

  return {
    userId: user.id,
    email,
    message: "Registration successful. Please verify your email.",
  };
}

// ==========================================
// VERIFY EMAIL
// ==========================================

export async function verifyEmail(token: string) {
  const tokenHash = hashToken(token);

  const verification = await findValidEmailVerificationToken(
    tokenHash,
  );

  if (!verification) {
    throw new AppError(
      400,
      "Verification token is invalid or expired",
    );
  }

  const consumed = await consumeEmailVerificationToken(
    verification.id,
    verification.userId,
  );

  if (!consumed) {
    throw new AppError(
      400,
      "Verification token is invalid or already used",
    );
  }

  return {
    message: "Email verified successfully",
  };
}

// ==========================================
// LOGIN
// ==========================================

type LoginMetadata = {
  userAgent?: string;
  ipAddress?: string;
};

export async function login(
  emailInput: string,
  password: string,
  metadata: LoginMetadata,
) {
  const email = emailInput.trim().toLowerCase();

  const user = await findUserByEmail(email);

  if (!user) {
    throw new AppError(401, "Invalid email or password");
  }

  const passwordValid = await argon2.verify(
    user.passwordHash,
    password,
  );

  if (!passwordValid) {
    throw new AppError(401, "Invalid email or password");
  }

  if (!user.emailVerifiedAt) {
    throw new AppError(403, "Please verify your email first");
  }

  if (user.accountStatus === "SUSPENDED") {
    throw new AppError(403, "Your account has been suspended");
  }

  const session = await issueSession(
    user.id,
    user.roleName,
    metadata,
  );

  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.roleName,
      accountStatus: user.accountStatus,
      emailVerifiedAt: user.emailVerifiedAt,
    },
    ...session,
  };
}

// ==========================================
// REFRESH TOKEN
// ==========================================

export async function refresh(refreshToken: string) {
  const oldHash = hashToken(refreshToken);

  const session = await findSessionByRefreshTokenHash(oldHash);

  if (!session) {
    throw new AppError(401, "Invalid or expired refresh token");
  }

  // Refresh token sebelumnya dipakai ulang: cabut session.
  if (session.tokenState === "previous") {
    await revokeSession(session.id, session.userId);

    throw new AppError(
      401,
      "Refresh token reuse detected. Please login again.",
    );
  }

  const user = await findUserById(session.userId);

  if (!user || user.accountStatus === "SUSPENDED" || !user.emailVerifiedAt) {
    await revokeSession(session.id, session.userId);
    throw new AppError(401, "Session is no longer valid");
  }

  const newRefreshToken = generateOpaqueToken();
  const newRefreshTokenHash = hashToken(newRefreshToken);

  const refreshExpiresAt = new Date(
    Date.now() + parseDuration(env.JWT_REFRESH_EXPIRES_IN),
  );

  const rotationResult = await rotateSession(
    session.id,
    oldHash,
    newRefreshTokenHash,
    refreshExpiresAt,
  );

  if (rotationResult === "reused") {
    throw new AppError(
      401,
      "Refresh token reuse detected. Please login again.",
    );
  }

  if (rotationResult !== "rotated") {
    throw new AppError(401, "Refresh token is invalid or expired");
  }

  const accessToken = await createAccessToken(
    user.id,
    user.roleName,
    session.id,
  );

  return {
    accessToken,
    refreshToken: newRefreshToken,
    expiresAt: refreshExpiresAt,
  };
}

// ==========================================
// LOGOUT
// ==========================================

export async function logout(
  sessionId: string,
  userId: string,
) {
  const session = await revokeSession(sessionId, userId);

  if (!session) {
    throw new AppError(404, "Session not found");
  }

  return {
    message: "Logged out successfully",
  };
}

// ==========================================
// CURRENT USER
// ==========================================

export async function getCurrentUser(userId: string) {
  const user = await findUserById(userId);

  if (!user) {
    throw new AppError(404, "User not found");
  }

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    role: user.roleName,
    accountStatus: user.accountStatus,
    emailVerifiedAt: user.emailVerifiedAt,
    phoneVerifiedAt: user.phoneVerifiedAt,
    createdAt: user.createdAt,
  };
}


export async function resendVerification(emailInput: string) {
  const email = emailInput.trim().toLowerCase();

  // Respons dibuat generik agar tidak membocorkan
  // apakah suatu email terdaftar di SESAJI.
  const response = {
    message:
      "If the account requires verification, a verification email will be sent.",
  };

  const user = await findUserByEmail(email);

  if (
    !user ||
    user.emailVerifiedAt ||
    user.accountStatus === "SUSPENDED"
  ) {
    return response;
  }

  const verificationToken = generateOpaqueToken();
  const tokenHash = hashToken(verificationToken);

  const token = await replaceEmailVerificationToken(
    user.id,
    tokenHash,
    new Date(Date.now() + EMAIL_VERIFICATION_TTL),
  );

  if (!token) {
    throw new AppError(500, "Could not create verification token");
  }

  try {
    await sendVerificationEmail(
      user.email,
      user.fullName,
      verificationToken,
    );
  } catch {
    throw new AppError(
      503,
      "Unable to send verification email. Please try again later.",
    );
  }

  return response;
}
