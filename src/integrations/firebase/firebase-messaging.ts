import {
  getMessaging,
  type MulticastMessage,
} from "firebase-admin/messaging";

import { getFirebaseApp } from "./firebase-admin.js";

interface SendPushNotificationInput {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

interface SendPushNotificationResult {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
}

const INVALID_TOKEN_ERROR_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

export async function sendPushNotification(
  input: SendPushNotificationInput,
): Promise<SendPushNotificationResult> {
  const uniqueTokens = [...new Set(input.tokens)];

  if (uniqueTokens.length === 0) {
    return {
      successCount: 0,
      failureCount: 0,
      invalidTokens: [],
    };
  }

  const messaging = getMessaging(getFirebaseApp());

  let successCount = 0;
  let failureCount = 0;

  const invalidTokens: string[] = [];

  // FCM multicast supports up to 500 tokens per request.
  for (let index = 0; index < uniqueTokens.length; index += 500) {
    const batch = uniqueTokens.slice(index, index + 500);

    const message: MulticastMessage = {
      tokens: batch,
      notification: {
        title: input.title,
        body: input.body,
      },
      data: input.data ?? {},
      android: {
        priority: "high",
        notification: {
          channelId: "sesaji_notifications",
        },
      },
    };

    const response = await messaging.sendEachForMulticast(
      message,
    );

    successCount += response.successCount;
    failureCount += response.failureCount;

    response.responses.forEach((result, tokenIndex) => {
      if (
        !result.success &&
        INVALID_TOKEN_ERROR_CODES.has(
          result.error?.code ?? "",
        )
      ) {
        const token = batch[tokenIndex];

        if (token) {
          invalidTokens.push(token);
        }
      }
    });
  }

  return {
    successCount,
    failureCount,
    invalidTokens,
  };
}
