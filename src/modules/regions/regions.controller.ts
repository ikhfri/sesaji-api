import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { AppError } from "../../shared/middleware/error-handler.js";

import {
  createRegionService,
  deleteRegionService,
  getChildRegionsService,
  getRegionService,
  getRegionsService,
  updateRegionService,
} from "./regions.service.js";

import { regionQuerySchema } from "./regions.validation.js";

import type {
  CreateRegionInput,
  UpdateRegionInput,
} from "./regions.types.js";

export async function getRegions(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = regionQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      throw new AppError(400, "Invalid region query parameters");
    }

    const parentId =
      parsed.data.parentId === "null"
        ? null
        : parsed.data.parentId;

    const result = await getRegionsService(
      parentId,
      parsed.data.regionType,
    );

    res.status(200).json({
      success: true,
      message: "Regions retrieved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getRegion(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await getRegionService(req.params.id);

    res.status(200).json({
      success: true,
      message: "Region retrieved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getRegionChildren(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await getChildRegionsService(req.params.id);

    res.status(200).json({
      success: true,
      message: "Child regions retrieved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function createRegion(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await createRegionService(
      req.body as CreateRegionInput,
    );

    res.status(201).json({
      success: true,
      message: "Region created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateRegion(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await updateRegionService(
      req.params.id,
      req.body as UpdateRegionInput,
    );

    res.status(200).json({
      success: true,
      message: "Region updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteRegion(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await deleteRegionService(req.params.id);

    res.status(200).json({
      success: true,
      message: "Region deleted successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}