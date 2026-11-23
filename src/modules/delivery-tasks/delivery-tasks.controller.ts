
import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { AppError } from "../../shared/middleware/error-handler.js";

import {
  claimTask,
  confirmHandover,
  getAvailableTasks,
  getDeliveryTaskDetail,
  getMyDeliveryTasks,
  updateTaskStatus,
} from "./delivery-tasks.service.js";

import type {
  AvailableTasksQuery,
  UpdateDeliveryTaskStatusBody,
  ConfirmDeliveryHandoverBody,
} from "./delivery-tasks.validation.js";

// =====================================================
// HELPERS
// =====================================================

function getRouteParam(
  value: string | string[] | undefined,
  name: string,
): string {
  const param = Array.isArray(value)
    ? value[0]
    : value;

  if (!param) {
    throw new AppError(
      400,
      `Missing route parameter: ${name}`,
    );
  }

  return param;
}

// =====================================================
// GET AVAILABLE TASKS
// =====================================================

export async function getAvailableTasksController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = res.locals.validatedQuery as AvailableTasksQuery;

    const result = await getAvailableTasks(
      req.auth!.userId,
      req.auth!.role,
      query,
    );

    res.status(200).json({
      success: true,
      message: "Available delivery tasks retrieved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// =====================================================
// GET MY DELIVERY TASKS
// =====================================================

export async function getMyDeliveryTasksController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await getMyDeliveryTasks(
      req.auth!.userId,
      req.auth!.role,
    );

    res.status(200).json({
      success: true,
      message: "Your delivery tasks retrieved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// =====================================================
// GET DELIVERY TASK DETAIL
// =====================================================

export async function getDeliveryTaskDetailController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = getRouteParam(req.params.id, "id");

    const result = await getDeliveryTaskDetail(
      id,
      req.auth!.userId,
      req.auth!.role,
    );

    res.status(200).json({
      success: true,
      message: "Delivery task retrieved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// =====================================================
// CLAIM DELIVERY TASK
// =====================================================

export async function claimTaskController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = getRouteParam(req.params.id, "id");

    const result = await claimTask(
      id,
      req.auth!.userId,
      req.auth!.role,
    );

    res.status(200).json({
      success: true,
      message: "Delivery task claimed successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// =====================================================
// UPDATE DELIVERY TASK STATUS
// =====================================================

export async function updateTaskStatusController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = getRouteParam(req.params.id, "id");

    const result = await updateTaskStatus(
      id,
      req.auth!.userId,
      req.auth!.role,
      req.body as UpdateDeliveryTaskStatusBody,
    );

    res.status(200).json({
      success: true,
      message: "Delivery task status updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// =====================================================
// CONFIRM DELIVERY HANDOVER
// =====================================================

export async function confirmHandoverController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = getRouteParam(req.params.id, "id");

    const result = await confirmHandover(
      id,
      req.auth!.userId,
      req.auth!.role,
      req.body as ConfirmDeliveryHandoverBody,
    );

    res.status(200).json({
      success: true,
      message: "Food handover confirmed successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
