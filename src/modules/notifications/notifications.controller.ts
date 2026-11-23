
import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { AppError } from "../../shared/middleware/error-handler.js";

import {
  getMyNotifications,
  getUnreadCount,
  readNotification,
  readAllNotifications,
  removeNotification,
} from "./notifications.service.js";

import type {
  NotificationParams,
} from "./notifications.validation.js";

import type {
  NotificationQuery,
} from "./notifications.types.js";

export async function getNotifications(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.auth!.userId;

    const query = res.locals.validatedQuery as NotificationQuery;

    const result = await getMyNotifications(userId, query);

    res.status(200).json({
      success: true,
      message: "Notifications retrieved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getUnreadNotificationsCount(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await getUnreadCount(req.auth!.userId);

    res.status(200).json({
      success: true,
      message: "Unread notification count retrieved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function markAsRead(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const params = req.params as unknown as NotificationParams;

    const result = await readNotification(
      req.auth!.userId,
      params.id,
    );

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function markAllAsRead(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await readAllNotifications(req.auth!.userId);

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteMyNotification(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const params = req.params as unknown as NotificationParams;

    const result = await removeNotification(
      req.auth!.userId,
      params.id,
    );

    res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
