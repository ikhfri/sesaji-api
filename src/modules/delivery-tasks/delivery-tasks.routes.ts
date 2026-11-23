
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";

import { authenticate } from "../../shared/middleware/authenticate.js";
import { authorize } from "../../shared/middleware/authorize.js";
import { validateQuery } from "../../shared/middleware/validate-query.js";
import { validate } from "../../shared/middleware/validate.js";

import {
  availableTasksQuerySchema,
  deliveryTaskParamsSchema,
  updateDeliveryTaskStatusSchema,
  confirmDeliveryHandoverSchema,
} from "./delivery-tasks.validation.js";

import {
  claimTaskController,
  confirmHandoverController,
  getAvailableTasksController,
  getDeliveryTaskDetailController,
  getMyDeliveryTasksController,
  updateTaskStatusController,
} from "./delivery-tasks.controller.js";

const router = Router();


function validateTaskId(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const result = deliveryTaskParamsSchema.safeParse({
    id: req.params.id,
  });

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Invalid delivery task ID",
      errors: result.error.issues,
    });
    return;
  }

  next();
}


router.use(authenticate);



router.get(
  "/available",
  authorize("VOLUNTEER"),
  validateQuery(availableTasksQuerySchema),
  getAvailableTasksController,
);

router.get(
  "/me",
  authorize("VOLUNTEER"),
  getMyDeliveryTasksController,
);

router.post(
  "/:id/claim",
  authorize("VOLUNTEER"),
  validateTaskId,
  claimTaskController,
);

router.patch(
  "/:id/status",
  authorize("VOLUNTEER"),
  validateTaskId,
  validate(updateDeliveryTaskStatusSchema),
  updateTaskStatusController,
);

router.post(
  "/:id/confirm-handover",
  authorize("RECEIVER"),
  validateTaskId,
  validate(confirmDeliveryHandoverSchema),
  confirmHandoverController,
);


router.get(
  "/:id",
  validateTaskId,
  getDeliveryTaskDetailController,
);

export default router;
