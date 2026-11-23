
import { Router } from "express";

import { authenticate } from "../../shared/middleware/authenticate.js";
import { validateQuery } from "../../shared/middleware/validate-query.js";

import {
  getNotifications,
  getUnreadNotificationsCount,
  markAsRead,
  markAllAsRead,
  deleteMyNotification,
} from "./notifications.controller.js";

import {
  notificationQuerySchema,
  notificationParamsSchema,
} from "./notifications.validation.js";

const router = Router();

// Validate UUID route parameter.
function validateNotificationId(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
) {
  const result = notificationParamsSchema.safeParse({
    id: req.params.id,
  });

  if (!result.success) {
    res.status(422).json({
      success: false,
      message: "Invalid notification ID",
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });

    return;
  }

  next();
}

// All notification endpoints require authentication.
router.use(authenticate);

// GET /notifications
router.get(
  "/",
  validateQuery(notificationQuerySchema),
  getNotifications,
);

// GET /notifications/unread-count
router.get(
  "/unread-count",
  getUnreadNotificationsCount,
);

// PATCH /notifications/read-all
router.patch(
  "/read-all",
  markAllAsRead,
);

// PATCH /notifications/:id/read
router.patch(
  "/:id/read",
  validateNotificationId,
  markAsRead,
);

// DELETE /notifications/:id
router.delete(
  "/:id",
  validateNotificationId,
  deleteMyNotification,
);

export default router;
