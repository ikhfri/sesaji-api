
export const NOTIFICATION_TYPES = [
  "NEW_FOOD_REQUEST",
  "REQUEST_APPROVED",
  "REQUEST_REJECTED",
  "REQUEST_EXPIRED",
  "NEW_DELIVERY_TASK",
  "DELIVERY_STATUS_UPDATED",
  "DONATION_COMPLETED",
  "LISTING_EXPIRING",
  "LISTING_EXPIRED",
  "SYSTEM",
  "VERIFICATION_APPROVED",
  "VERIFICATION_REJECTED",
] as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[number];

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface NotificationQuery {
  page: number;
  limit: number;
  unreadOnly?: boolean;
}
