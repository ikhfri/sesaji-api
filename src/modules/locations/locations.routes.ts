import { Router } from "express";

import { authenticate } from "../../shared/middleware/authenticate.js";
import { validate } from "../../shared/middleware/validate.js";

import {
  createLocation,
  deleteLocation,
  getLocations,
  setDefaultLocation,
  updateLocation,
} from "./locations.controller.js";

import {
  createLocationSchema,
  updateLocationSchema,
} from "./locations.validation.js";

const router = Router();

router.use(authenticate);

router.get("/me", getLocations);

router.post(
  "/me",
  validate(createLocationSchema),
  createLocation,
);

router.patch(
  "/me/:id",
  validate(updateLocationSchema),
  updateLocation,
);

router.patch(
  "/me/:id/default",
  setDefaultLocation,
);

router.delete("/me/:id", deleteLocation);

export default router;