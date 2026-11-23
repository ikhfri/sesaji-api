import { AppError } from "../../shared/middleware/error-handler.js";

import {
  createRegion,
  deleteRegion,
  findChildRegions,
  findRegionById,
  findRegionByNameAndParent,
  findRegions,
  getDescendantIds,
  updateRegion,
} from "./regions.repository.js";

import type {
  CreateRegionInput,
  UpdateRegionInput,
} from "./regions.types.js";

export async function createRegionService(
  data: CreateRegionInput,
) {
  // Validate parent region.
  const parentId = data.parentId ?? null;

  if (parentId) {
    const parent = await findRegionById(parentId);

    if (!parent) {
      throw new AppError(404, "Parent region not found");
    }
  }

  // Prevent duplicate region names under the same parent.
  const existingRegion = await findRegionByNameAndParent(
    data.name,
    parentId,
  );

  if (existingRegion) {
    throw new AppError(
      409,
      "A region with this name already exists under the same parent",
    );
  }

  const region = await createRegion(data);

  return region;
}

export async function updateRegionService(
  id: string,
  data: UpdateRegionInput,
) {
  const currentRegion = await findRegionById(id);

  if (!currentRegion) {
    throw new AppError(404, "Region not found");
  }

  const nextName = data.name ?? currentRegion.name;

  const nextParentId =
    data.parentId === undefined
      ? currentRegion.parentId
      : data.parentId;

  // Validate new parent if provided.
  if (nextParentId) {
    const parent = await findRegionById(nextParentId);

    if (!parent) {
      throw new AppError(404, "Parent region not found");
    }

    // Prevent self-parenting and circular hierarchy.
    if (nextParentId === id) {
      throw new AppError(
        400,
        "A region cannot be its own parent",
      );
    }

    const descendantIds = await getDescendantIds(id);

    if (descendantIds.includes(nextParentId)) {
      throw new AppError(
        400,
        "A region cannot be moved under its own descendant",
      );
    }
  }

  // Prevent duplicate names under the same parent.
  const existingRegion = await findRegionByNameAndParent(
    nextName,
    nextParentId,
    id,
  );

  if (existingRegion) {
    throw new AppError(
      409,
      "A region with this name already exists under the same parent",
    );
  }

  const updatedRegion = await updateRegion(id, data);

  if (!updatedRegion) {
    throw new AppError(404, "Region not found");
  }

  return updatedRegion;
}

export async function deleteRegionService(id: string) {
  const currentRegion = await findRegionById(id);

  if (!currentRegion) {
    throw new AppError(404, "Region not found");
  }

  const children = await findChildRegions(id);

  if (children.length > 0) {
    throw new AppError(
      409,
      "Cannot delete a region that still has child regions",
    );
  }

  const deletedRegion = await deleteRegion(id);

  if (!deletedRegion) {
    throw new AppError(404, "Region not found");
  }

  return deletedRegion;
}

export async function getRegionsService(
  parentId?: string | null,
  regionType?: string,
) {
  return findRegions(parentId, regionType);
}

export async function getRegionService(id: string) {
  const region = await findRegionById(id);

  if (!region) {
    throw new AppError(404, "Region not found");
  }

  return region;
}

export async function getChildRegionsService(parentId: string) {
  const parent = await findRegionById(parentId);

  if (!parent) {
    throw new AppError(404, "Parent region not found");
  }

  return findChildRegions(parentId);
}