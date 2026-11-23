import { AppError } from "../../shared/middleware/error-handler.js";

import {
  upsertDeviceToken,
  findActiveDeviceTokensByUser,
  revokeDeviceToken,
  revokeDeviceTokensByIds,
} from "./device-tokens.repository.js";

import {
  sendPushNotification,
} from "../../integrations/firebase/firebase-messaging.js";

import type {
  RegisterDeviceTokenInput,
  SendUserPushInput,
} from "./device-tokens.types.js";

// =====================================================
// REGISTER DEVICE TOKEN
// =====================================================

export async function registerDevice(
  userId: string,
  input: RegisterDeviceTokenInput,
) {
  try {
    return await upsertDeviceToken({
      userId,
      token: input.token,
      platform: input.platform,
      deviceId: input.deviceId,
    });
  } catch {
    throw new AppError(
      500,
      "Failed to register device token",
    );
  }
}

// =====================================================
// REVOKE DEVICE TOKEN
// =====================================================

export async function unregisterDevice(
  userId: string,
  token: string,
) {
  const result = await revokeDeviceToken(
    userId,
    token,
  );

  if (!result) {
    throw new AppError(
      404,
      "Active device token not found",
    );
  }

  return {
    revoked: true,
  };
}

// =====================================================
// SEND PUSH TO USER
// =====================================================

export async function sendPushToUser(
  input: SendUserPushInput,
) {
  const devices = await findActiveDeviceTokensByUser(
    input.userId,
  );

  if (devices.length === 0) {
    return {
      successCount: 0,
      failureCount: 0,
    };
  }

  const result = await sendPushNotification({
    tokens: devices.map((device) => device.token),
    title: input.title,
    body: input.body,
    data: input.data,
  });

  // Revoke tokens that Firebase reports as invalid.
  if (result.invalidTokens.length > 0) {
    const invalidTokenIds = devices
      .filter((device) =>
        result.invalidTokens.includes(device.token),
      )
      .map((device) => device.id);

    await revokeDeviceTokensByIds(invalidTokenIds);
  }

  return {
    successCount: result.successCount,
    failureCount: result.failureCount,
  };
}
