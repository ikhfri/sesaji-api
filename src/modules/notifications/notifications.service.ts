
import { AppError } from "../../shared/middleware/error-handler.js";

import {
  createNotification as createNotificationRepository,
  findNotificationsByUser,
  countUnreadNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "./notifications.repository.js";

import type {
  CreateNotificationInput,
  NotificationQuery,
} from "./notifications.types.js";
import {
  sendPushToUser,
} from "../device-tokens/device-tokens.service.js";
/**
 * Create notification for a user.
 * Used internally by other modules.
 */
export async function createNotification(
  input: CreateNotificationInput,
) {
  return createNotificationRepository(input);
}

/**
 * Get authenticated user's notifications.
 */
export async function getMyNotifications(
  userId: string,
  query: NotificationQuery,
) {
  return findNotificationsByUser(userId, query);
}

/**
 * Get unread notification count.
 */
export async function getUnreadCount(userId: string) {
  const total = await countUnreadNotifications(userId);

  return { total };
}

/**
 * Mark one notification as read.
 */
export async function readNotification(
  userId: string,
  notificationId: string,
) {
  const notification = await markNotificationAsRead(
    userId,
    notificationId,
  );

  if (!notification) {
    throw new AppError(
      404,
      "Notification not found or already read",
    );
  }

  return notification;
}

/**
 * Mark all notifications as read.
 */
export async function readAllNotifications(userId: string) {
  const total = await markAllNotificationsAsRead(userId);

  return { updated: total };
}

/**
 * Delete one notification.
 */
export async function removeNotification(
  userId: string,
  notificationId: string,
) {
  const deleted = await deleteNotification(
    userId,
    notificationId,
  );

  if (!deleted) {
    throw new AppError(404, "Notification not found");
  }

  return deleted;
}
export async function createNotificationSafely(
  input: CreateNotificationInput,
) {
  try {
    const notification = await createNotificationRepository(input);

    if (!notification) {
      console.error(
        "[Notifications] Notification was not inserted",
      );

      return null;
    }

    try {
      await sendPushToUser({
        userId: input.userId,
        title: input.title,
        body: input.body,
        data: {
          notificationId: notification.id,
          type: input.type,
          ...(input.data
            ? Object.fromEntries(
                Object.entries(input.data).map(
                  ([key, value]) => [key, String(value)],
                ),
              )
            : {}),
        },
      });
    } catch (error) {
      console.error(
        "[Notifications] Push notification failed:",
        error,
      );
    }

    return notification;
  } catch (error) {
    console.error(
      "[Notifications] Failed to create notification:",
      error,
    );

    return null;
  }
}