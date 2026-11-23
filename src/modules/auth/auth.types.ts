
import type { InferSelectModel } from "drizzle-orm";
import type { users } from "../../database/schema/users.js";
import type { authSessions } from "../../database/schema/auth-sessions.js";

export type User = InferSelectModel<typeof users>;
export type AuthSession = InferSelectModel<typeof authSessions>;

export type RegisterRole =
  | "DONOR_INDIVIDUAL"
  | "DONOR_BUSINESS"
  | "RECEIVER"
  | "VOLUNTEER";

export type RegisterInput = {
  fullName: string;
  email: string;
  phoneNumber?: string;
  passwordHash: string;
  role: RegisterRole;
  profile:
    | {
        type: "DONOR_INDIVIDUAL";
      }
    | {
        type: "DONOR_BUSINESS";
        businessName: string;
        businessType: string;
      }
    | {
        type: "RECEIVER";
        institutionName: string;
        institutionType: string;
        description?: string;
        capacityPortions?: number;
      }
    | {
        type: "VOLUNTEER";
        vehicleType?: string;
      };
};

export type CreateSessionInput = {
  userId: string;
  refreshTokenHash: string;
  userAgent?: string;
  ipAddress?: string;
  expiresAt: Date;
};


declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        role: string;
        sessionId: string;
      };
    }
  }
}
