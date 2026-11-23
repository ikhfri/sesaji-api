import {
  and,
  eq,
  inArray,
  isNull,
} from "drizzle-orm";

import { db } from "../../database/index.js";
import { deviceTokens } from "../../database/schema/index.js";

export interface RegisterDeviceTokenInput {
  userId: string;
  token: string;
  platform: "ANDROID" | "WEB";
  deviceId?: string | null;
}

export async function upsertDeviceToken(
  input: RegisterDeviceTokenInput,
) {
  const now = new Date();

  const [deviceToken] = await db
    .insert(deviceTokens)
    .values({
      userId: input.userId,
      token: input.token,
      platform: input.platform,
      deviceId: input.deviceId ?? null,
      lastUsedAt: now,
      revokedAt: null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: deviceTokens.token,
      set: {
        userId: input.userId,
        platform: input.platform,
        deviceId: input.deviceId ?? null,
        lastUsedAt: now,
        revokedAt: null,
        updatedAt: now,
      },
    })
    .returning();

  return deviceToken;
}

export async function findActiveDeviceTokensByUser(
  userId: string,
) {
  return db
    .select({
      id: deviceTokens.id,
      token: deviceTokens.token,
      platform: deviceTokens.platform,
    })
    .from(deviceTokens)
    .where(
      and(
        eq(deviceTokens.userId, userId),
        isNull(deviceTokens.revokedAt),
      ),
    );
}

export async function revokeDeviceToken(
  userId: string,
  token: string,
) {
  const [deviceToken] = await db
    .update(deviceTokens)
    .set({
      revokedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(deviceTokens.userId, userId),
        eq(deviceTokens.token, token),
        isNull(deviceTokens.revokedAt),
      ),
    )
    .returning({
      id: deviceTokens.id,
    });

  return deviceToken ?? null;
}

export async function revokeDeviceTokensByIds(
  tokenIds: string[],
) {
  if (tokenIds.length === 0) {
    return 0;
  }

  const result = await db
    .update(deviceTokens)
    .set({
      revokedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        inArray(deviceTokens.id, tokenIds),
        isNull(deviceTokens.revokedAt),
      ),
    )
    .returning({
      id: deviceTokens.id,
    });

  return result.length;
}

export async function updateDeviceTokenLastUsed(
  tokenId: string,
) {
  await db
    .update(deviceTokens)
    .set({
      lastUsedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(deviceTokens.id, tokenId));
}
