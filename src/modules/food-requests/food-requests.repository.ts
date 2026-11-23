
import {
  and,
  count,
  desc,
  eq,
  inArray,
} from "drizzle-orm";

import { db } from "../../database/index.js";

import {
  users,
  verifications,
  foodListings,
  foodRequests,
  foodCategories,
  locations,
} from "../../database/schema/index.js";

import type {
  CreateFoodRequestInput,
  FoodRequestQuery,
} from "./food-requests.types.js";

const RECEIVER_VERIFICATION_TYPE = "RECEIVER";

const ACTIVE_REQUEST_STATUSES = [
  "PENDING",
  "APPROVED",
  "IN_PROGRESS",
] as const;

export type CreateRequestResult =
  | {
      success: true;
      request: typeof foodRequests.$inferSelect;
    }
  | {
      success: false;
      reason:
        | "RECEIVER_NOT_FOUND"
        | "RECEIVER_NOT_VERIFIED"
        | "LISTING_NOT_FOUND"
        | "LISTING_NOT_AVAILABLE"
        | "CANNOT_REQUEST_OWN_LISTING"
        | "INVALID_PORTIONS";
    };


export async function createFoodRequest(
  recipientId: string,
  input: CreateFoodRequestInput,
): Promise<CreateRequestResult> {
  return db.transaction(async (tx) => {
    const [receiver] = await tx
      .select({
        id: users.id,
      })
      .from(users)
      .where(eq(users.id, recipientId))
      .limit(1);

    if (!receiver) {
      return {
        success: false,
        reason: "RECEIVER_NOT_FOUND",
      };
    }

    const [verification] = await tx
      .select({
        id: verifications.id,
      })
      .from(verifications)
      .where(
        and(
          eq(verifications.userId, recipientId),
          eq(
            verifications.verificationType,
            RECEIVER_VERIFICATION_TYPE,
          ),
          eq(verifications.status, "APPROVED"),
        ),
      )
      .limit(1);

    if (!verification) {
      return {
        success: false,
        reason: "RECEIVER_NOT_VERIFIED",
      };
    }

    // Lock listing so creation and approval serialize on the same row.
    const [listing] = await tx
      .select({
        id: foodListings.id,
        donorId: foodListings.donorId,
        status: foodListings.status,
        availablePortions: foodListings.availablePortions,
        pickupDeadline: foodListings.pickupDeadline,
      })
      .from(foodListings)
      .where(eq(foodListings.id, input.listingId))
      .for("update")
      .limit(1);

    if (!listing) {
      return {
        success: false,
        reason: "LISTING_NOT_FOUND",
      };
    }

    if (listing.donorId === recipientId) {
      return {
        success: false,
        reason: "CANNOT_REQUEST_OWN_LISTING",
      };
    }

    if (
      listing.status !== "ACTIVE" ||
      listing.availablePortions < 1 ||
      listing.pickupDeadline <= new Date()
    ) {
      return {
        success: false,
        reason: "LISTING_NOT_AVAILABLE",
      };
    }

    if (input.requestedPortions > listing.availablePortions) {
      return {
        success: false,
        reason: "INVALID_PORTIONS",
      };
    }

    const [request] = await tx
      .insert(foodRequests)
      .values({
        recipientId,
        listingId: input.listingId,
        requestedPortions: input.requestedPortions,
        fulfillmentMethod: input.fulfillmentMethod ?? null,
        recipientNotes: input.recipientNotes ?? null,
        status: "PENDING",
      })
      .returning();

    if (!request) {
      throw new Error("FOOD_REQUEST_CREATION_FAILED");
    }

    return {
      success: true,
      request,
    };
  });
}


export async function findFoodRequestById(id: string) {
  const [request] = await db
    .select({
      id: foodRequests.id,
      recipientId: foodRequests.recipientId,
      listingId: foodRequests.listingId,
      requestedPortions: foodRequests.requestedPortions,
      fulfillmentMethod: foodRequests.fulfillmentMethod,
      recipientNotes: foodRequests.recipientNotes,
      status: foodRequests.status,
      rejectionReason: foodRequests.rejectionReason,
      respondedAt: foodRequests.respondedAt,
      cancelledAt: foodRequests.cancelledAt,
      completedAt: foodRequests.completedAt,
      createdAt: foodRequests.createdAt,
      updatedAt: foodRequests.updatedAt,
      listingName: foodListings.name,
      donorId: foodListings.donorId,
      donorName: users.fullName,
      categoryName: foodCategories.name,
    })
    .from(foodRequests)
    .innerJoin(
      foodListings,
      eq(foodRequests.listingId, foodListings.id),
    )
    .innerJoin(
      users,
      eq(foodListings.donorId, users.id),
    )
    .innerJoin(
      foodCategories,
      eq(foodListings.categoryId, foodCategories.id),
    )
    .where(eq(foodRequests.id, id))
    .limit(1);

  return request ?? null;
}

export async function findRequestsByRecipient(
  recipientId: string,
  query: FoodRequestQuery,
) {
  const conditions = [
    eq(foodRequests.recipientId, recipientId),
  ];

  if (query.status) {
    conditions.push(eq(foodRequests.status, query.status));
  }

  const offset = (query.page - 1) * query.limit;

  const [items, totalResult] = await Promise.all([
    db
      .select({
        id: foodRequests.id,
        listingId: foodRequests.listingId,
        listingName: foodListings.name,
        requestedPortions: foodRequests.requestedPortions,
        fulfillmentMethod: foodRequests.fulfillmentMethod,
        status: foodRequests.status,
        createdAt: foodRequests.createdAt,
        pickupDeadline: foodListings.pickupDeadline,
      })
      .from(foodRequests)
      .innerJoin(
        foodListings,
        eq(foodRequests.listingId, foodListings.id),
      )
      .where(and(...conditions))
      .orderBy(desc(foodRequests.createdAt))
      .limit(query.limit)
      .offset(offset),

    db
      .select({ total: count() })
      .from(foodRequests)
      .where(and(...conditions)),
  ]);

  const total = totalResult[0]?.total ?? 0;

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function findIncomingRequests(
  donorId: string,
  query: FoodRequestQuery,
) {
  const conditions = [
    eq(foodListings.donorId, donorId),
  ];

  if (query.status) {
    conditions.push(eq(foodRequests.status, query.status));
  }

  const offset = (query.page - 1) * query.limit;

  const [items, totalResult] = await Promise.all([
    db
      .select({
        id: foodRequests.id,
        recipientId: foodRequests.recipientId,
        recipientName: users.fullName,
        listingId: foodRequests.listingId,
        listingName: foodListings.name,
        requestedPortions: foodRequests.requestedPortions,
        fulfillmentMethod: foodRequests.fulfillmentMethod,
        recipientNotes: foodRequests.recipientNotes,
        status: foodRequests.status,
        createdAt: foodRequests.createdAt,
      })
      .from(foodRequests)
      .innerJoin(
        foodListings,
        eq(foodRequests.listingId, foodListings.id),
      )
      .innerJoin(
        users,
        eq(foodRequests.recipientId, users.id),
      )
      .where(and(...conditions))
      .orderBy(desc(foodRequests.createdAt))
      .limit(query.limit)
      .offset(offset),

    db
      .select({ total: count() })
      .from(foodRequests)
      .innerJoin(
        foodListings,
        eq(foodRequests.listingId, foodListings.id),
      )
      .where(and(...conditions)),
  ]);

  const total = totalResult[0]?.total ?? 0;

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}


type RespondRequestResult =
  | {
      success: true;
      request: typeof foodRequests.$inferSelect;
    }
  | {
      success: false;
      reason:
        | "REQUEST_NOT_FOUND"
        | "NOT_AUTHORIZED"
        | "REQUEST_ALREADY_PROCESSED"
        | "LISTING_NOT_FOUND"
        | "INSUFFICIENT_STOCK";
    };

type CancelRequestResult =
  | {
      success: true;
      request: typeof foodRequests.$inferSelect;
    }
  | {
      success: false;
      reason:
        | "REQUEST_NOT_FOUND"
        | "NOT_AUTHORIZED"
        | "REQUEST_ALREADY_PROCESSED";
    };

export async function respondToFoodRequest(
  donorId: string,
  requestId: string,
  action: "APPROVE" | "REJECT",
  rejectionReason?: string,
): Promise<RespondRequestResult> {
  return db.transaction(async (tx) => {
    // Read the listing ID first to establish a consistent lock order.
    const [initialRequest] = await tx
      .select({
        listingId: foodRequests.listingId,
      })
      .from(foodRequests)
      .where(eq(foodRequests.id, requestId))
      .limit(1);

    if (!initialRequest) {
      return {
        success: false,
        reason: "REQUEST_NOT_FOUND",
      };
    }

    // Lock listing first. All stock-changing operations must use this lock.
    const [listing] = await tx
      .select()
      .from(foodListings)
      .where(eq(foodListings.id, initialRequest.listingId))
      .for("update")
      .limit(1);

    if (!listing) {
      return {
        success: false,
        reason: "LISTING_NOT_FOUND",
      };
    }

    if (listing.donorId !== donorId) {
      return {
        success: false,
        reason: "NOT_AUTHORIZED",
      };
    }

    // Re-read and lock the request after acquiring the listing lock.
    const [request] = await tx
      .select()
      .from(foodRequests)
      .where(
        and(
          eq(foodRequests.id, requestId),
          eq(foodRequests.listingId, listing.id),
        ),
      )
      .for("update")
      .limit(1);

    if (!request) {
      return {
        success: false,
        reason: "REQUEST_NOT_FOUND",
      };
    }

    if (request.status !== "PENDING") {
      return {
        success: false,
        reason: "REQUEST_ALREADY_PROCESSED",
      };
    }

    if (action === "APPROVE") {
      if (
        listing.status !== "ACTIVE" ||
        listing.pickupDeadline <= new Date() ||
        listing.availablePortions < request.requestedPortions
      ) {
        return {
          success: false,
          reason: "INSUFFICIENT_STOCK",
        };
      }

      const remainingPortions =
        listing.availablePortions - request.requestedPortions;

      await tx
        .update(foodListings)
        .set({
          availablePortions: remainingPortions,
          status:
            remainingPortions === 0
              ? "FULLY_RESERVED"
              : "ACTIVE",
          updatedAt: new Date(),
        })
        .where(eq(foodListings.id, listing.id));

      const [updatedRequest] = await tx
        .update(foodRequests)
        .set({
          status: "APPROVED",
          respondedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(foodRequests.id, requestId))
        .returning();

      if (!updatedRequest) {
        throw new Error("FOOD_REQUEST_APPROVAL_FAILED");
      }

      return {
        success: true,
        request: updatedRequest,
      };
    }

    const [updatedRequest] = await tx
      .update(foodRequests)
      .set({
        status: "REJECTED",
        rejectionReason: rejectionReason ?? null,
        respondedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(foodRequests.id, requestId))
      .returning();

    if (!updatedRequest) {
      throw new Error("FOOD_REQUEST_REJECTION_FAILED");
    }

    return {
      success: true,
      request: updatedRequest,
    };
  });
}

export async function cancelFoodRequest(
  recipientId: string,
  requestId: string,
): Promise<CancelRequestResult> {
  return db.transaction(async (tx) => {
    const [request] = await tx
      .select()
      .from(foodRequests)
      .where(eq(foodRequests.id, requestId))
      .for("update")
      .limit(1);

    if (!request) {
      return {
        success: false,
        reason: "REQUEST_NOT_FOUND",
      };
    }

    if (request.recipientId !== recipientId) {
      return {
        success: false,
        reason: "NOT_AUTHORIZED",
      };
    }

    if (request.status !== "PENDING") {
      return {
        success: false,
        reason: "REQUEST_ALREADY_PROCESSED",
      };
    }

    const [cancelledRequest] = await tx
      .update(foodRequests)
      .set({
        status: "CANCELLED",
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(foodRequests.id, requestId))
      .returning();

    if (!cancelledRequest) {
      throw new Error("FOOD_REQUEST_CANCELLATION_FAILED");
    }

    return {
      success: true,
      request: cancelledRequest,
    };
  });
}