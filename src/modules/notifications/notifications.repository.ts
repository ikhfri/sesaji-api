
import {
  and,
  count,
  desc,
  eq,
  isNull,
} from "drizzle-orm";

import { db } from "../../database/index.js";
import { notifications } from "../../database/schema/index.js";

import type {
  CreateNotificationInput,
  NotificationQuery,
} from "./notifications.types.js";

export async function createNotification(
  input: CreateNotificationInput,
) {
  const [notification] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data,
    })
    .returning();

  return notification;
}

export async function findNotificationsByUser(
  userId: string,
  query: NotificationQuery,
) {
  const conditions = [
    eq(notifications.userId, userId),
  ];

  if (query.unreadOnly) {
    conditions.push(isNull(notifications.readAt));
  }

  const offset = (query.page - 1) * query.limit;

  const [items, [totalResult]] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(query.limit)
      .offset(offset),

    db
      .select({ total: count() })
      .from(notifications)
      .where(and(...conditions)),
  ]);

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: totalResult?.total ?? 0,
      totalPages: Math.ceil(
        (totalResult?.total ?? 0) / query.limit,
      ),
    },
  };
}

export async function countUnreadNotifications(
  userId: string,
) {
  const [result] = await db
    .select({ total: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      ),
    );

  return result?.total ?? 0;
}

export async function markNotificationAsRead(
  userId: string,
  notificationId: string,
) {
  const [notification] = await db
    .update(notifications)
    .set({
      readAt: new Date(),
    })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      ),
    )
    .returning();

  return notification ?? null;
}

export async function markAllNotificationsAsRead(
  userId: string,
) {
  const result = await db
    .update(notifications)
    .set({
      readAt: new Date(),
    })
    .where(
      and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      ),
    )
    .returning({
      id: notifications.id,
    });

  return result.length;
}

export async function deleteNotification(
  userId: string,
  notificationId: string,
) {
  const [deleted] = await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId),
      ),
    )
    .returning({
      id: notifications.id,
    });

  return deleted ?? null;
}
