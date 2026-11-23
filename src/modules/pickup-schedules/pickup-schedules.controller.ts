
import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { AppError } from "../../shared/middleware/error-handler.js";

import {
  createSchedule,
  getMySchedules,
  getScheduleDetail,
  removeSchedule,
  updateSchedule,
} from "./pickup-schedules.service.js";

import type {
  CreatePickupScheduleBody,
  UpdatePickupScheduleBody,
} from "./pickup-schedules.validation.js";

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

export async function createScheduleController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await createSchedule(
      req.auth!.userId,
      req.auth!.role,
      req.body as CreatePickupScheduleBody,
    );

    res.status(201).json({
      success: true,
      message: "Pickup schedule created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMySchedulesController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await getMySchedules(
      req.auth!.userId,
      req.auth!.role,
    );

    res.status(200).json({
      success: true,
      message: "Pickup schedules retrieved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getScheduleDetailController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = getRouteParam(req.params.id, "id");

    const result = await getScheduleDetail(
      id,
      req.auth!.userId,
      req.auth!.role,
    );

    res.status(200).json({
      success: true,
      message: "Pickup schedule retrieved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateScheduleController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = getRouteParam(req.params.id, "id");

    const result = await updateSchedule(
      id,
      req.auth!.userId,
      req.auth!.role,
      req.body as UpdatePickupScheduleBody,
    );

    res.status(200).json({
      success: true,
      message: "Pickup schedule updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteScheduleController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = getRouteParam(req.params.id, "id");

    const result = await removeSchedule(
      id,
      req.auth!.userId,
      req.auth!.role,
    );

    res.status(200).json({
      success: true,
      message: "Pickup schedule deleted successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
