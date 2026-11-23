
import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { jwtVerify } from "jose";
import { env } from "../../config/env.js";
import { AppError } from "./error-handler.js";
import { findActiveSessionById } from "../../modules/auth/auth.repository.js";
import { findUserById } from "../../modules/auth/auth.repository.js";

const accessSecret = new TextEncoder().encode(
  env.JWT_ACCESS_SECRET,
);

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      throw new AppError(401, "Authentication required");
    }

    const token = authorization.slice(7);

    const { payload } = await jwtVerify(
      token,
      accessSecret,
      { algorithms: ["HS256"] },
    );

    const userId = payload.sub;
    const sessionId = payload.sid;
    const role = payload.role;

    if (
      typeof userId !== "string" ||
      typeof sessionId !== "string" ||
      typeof role !== "string"
    ) {
      throw new AppError(401, "Invalid access token");
    }

    const session = await findActiveSessionById(sessionId);

    if (!session || session.userId !== userId) {
      throw new AppError(401, "Session expired or revoked");
    }

    const user = await findUserById(userId);

    if (
      !user ||
      user.accountStatus === "SUSPENDED" ||
      !user.emailVerifiedAt
    ) {
      throw new AppError(401, "Account is not available");
    }

    // Gunakan role terkini dari database, bukan role lama di JWT.
    req.auth = {
      userId: user.id,
      role: user.roleName,
      sessionId: session.id,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    next(new AppError(401, "Invalid or expired access token"));
  }
}
