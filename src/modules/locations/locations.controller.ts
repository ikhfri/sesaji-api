import type { Request, Response, NextFunction } from "express";

import {
  addMyLocation,
  getMyLocations,
  removeMyLocation,
  setMyDefaultLocation,
  updateMyLocation,
} from "./locations.service.js";

import type {
  CreateLocationInput,
  UpdateLocationInput,
} from "./locations.types.js";

export async function getLocations(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await getMyLocations(req.auth!.userId);

    res.status(200).json({
      success: true,
      message: "Locations retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
}

function getLocationId(req: Request): string {
  const id = req.params.id;

  if (typeof id !== "string") {
    throw new Error("INVALID_LOCATION_ID");
  }

  return id;
}

export async function createLocation(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await addMyLocation(
      req.auth!.userId,
      req.body as CreateLocationInput,
    );

    res.status(201).json({
      success: true,
      message: "Location created successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateLocation(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await updateMyLocation(
      req.auth!.userId,
      getLocationId(req),
      req.body as UpdateLocationInput,
    );

    res.status(200).json({
      success: true,
      message: "Location updated successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function setDefaultLocation(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
  const data = await setMyDefaultLocation(
  req.auth!.userId,
  getLocationId(req),
);

    res.status(200).json({
      success: true,
      message: "Default location updated successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteLocation(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await removeMyLocation(
  req.auth!.userId,
  getLocationId(req),
);

    res.status(200).json({
      success: true,
      ...data,
    });
  } catch (error) {
    next(error);
  }
}