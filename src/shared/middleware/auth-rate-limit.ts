import rateLimit from "express-rate-limit";

function createAuthLimiter(
  windowMs: number,
  limit: number,
  message: string,
) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      message,
    },
  });
}

export const registerLimiter = createAuthLimiter(
  60 * 60 * 1000,
  5,
  "Too many registration attempts. Try again later.",
);

export const loginLimiter = createAuthLimiter(
  15 * 60 * 1000,
  5,
  "Too many login attempts. Try again in 15 minutes.",
);

export const verificationLimiter = createAuthLimiter(
  15 * 60 * 1000,
  10,
  "Too many verification attempts. Try again later.",
);

export const resendVerificationLimiter = createAuthLimiter(
  60 * 60 * 1000,
  3,
  "Too many verification email requests. Try again in an hour.",
);

export const refreshLimiter = createAuthLimiter(
  60 * 1000,
  30,
  "Too many token refresh requests.",
);
