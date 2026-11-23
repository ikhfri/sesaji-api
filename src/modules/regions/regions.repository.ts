import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  ne,
} from "drizzle-orm";

import { db } from "../../database/index.js";
import { regions } from "../../database/schema/regions.js";

import type {
  CreateRegionInput,
  UpdateRegionInput,
} from "./regions.types.js";

export async function findRegions(
  parentId?: string | null,
  regionType?: string,
) {
  const conditions = [];

  if (parentId === null) {
    conditions.push(isNull(regions.parentId));
  } else if (parentId !== undefined) {
    conditions.push(eq(regions.parentId, parentId));
  }

  if (regionType) {
    conditions.push(eq(regions.regionType, regionType));
  }

  return db
    .select()
    .from(regions)
    .where(
      conditions.length > 0
        ? and(...conditions)
        : undefined,
    )
    .orderBy(asc(regions.name));
}

export async function findRegionById(id: string) {
  const [region] = await db
    .select()
    .from(regions)
    .where(eq(regions.id, id))
    .limit(1);

  return region ?? null;
}

export async function findChildRegions(parentId: string) {
  return db
    .select()
    .from(regions)
    .where(eq(regions.parentId, parentId))
    .orderBy(asc(regions.name));
}

export async function findChildrenByParentIds(
  parentIds: string[],
) {
  if (parentIds.length === 0) {
    return [];
  }

  return db
    .select()
    .from(regions)
    .where(inArray(regions.parentId, parentIds));
}

export async function findRegionByNameAndParent(
  name: string,
  parentId: string | null,
  excludeId?: string,
) {
  const conditions = [
    eq(regions.name, name),
    parentId === null
      ? isNull(regions.parentId)
      : eq(regions.parentId, parentId),
  ];

  if (excludeId) {
    conditions.push(ne(regions.id, excludeId));
  }

  const [region] = await db
    .select()
    .from(regions)
    .where(and(...conditions))
    .limit(1);

  return region ?? null;
}

export async function getDescendantIds(id: string) {
  const descendants: string[] = [];
  let frontier = [id];

  while (frontier.length > 0) {
    const children = await findChildrenByParentIds(frontier);

    const childIds = children.map((child) => child.id);

    if (childIds.length === 0) {
      break;
    }

    descendants.push(...childIds);
    frontier = childIds;
  }

  return descendants;
}

export async function createRegion(data: CreateRegionInput) {
  const [region] = await db
    .insert(regions)
    .values({
      name: data.name,
      regionType: data.regionType,
      parentId: data.parentId ?? null,
    })
    .returning();

  return region;
}

export async function updateRegion(
  id: string,
  data: UpdateRegionInput,
) {
  const [region] = await db
    .update(regions)
    .set(data)
    .where(eq(regions.id, id))
    .returning();

  return region ?? null;
}

export async function deleteRegion(id: string) {
  const [region] = await db
    .delete(regions)
    .where(eq(regions.id, id))
    .returning();

  return region ?? null;
}
