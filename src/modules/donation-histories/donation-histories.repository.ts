import { sql, type SQL } from "drizzle-orm";

import { db } from "../../database/index.js";

import type {
  DonationHistory,
  DonationHistoryQuery,
  PaginatedDonationHistories,
} from "./donation-histories.types.js";

function getAccessCondition(
  userId: string,
  role: string,
): SQL {
  switch (role) {
    case "DONOR_INDIVIDUAL":
    case "DONOR_BUSINESS":
      return sql`donor_id = ${userId}`;

    case "RECEIVER":
      return sql`recipient_id = ${userId}`;

    case "VOLUNTEER":
      return sql`volunteer_id = ${userId}`;

    case "ADMIN":
      return sql`TRUE`;

    default:
      return sql`FALSE`;
  }
}

function mapHistoryRow(row: Record<string, unknown>): DonationHistory {
  return {
    requestId: row.request_id as string,
    listingId: row.listing_id as string,
    foodName: row.food_name as string,
    categoryName: row.category_name as string | null,

    donorId: row.donor_id as string,
    donorName: row.donor_name as string,
    donorType: row.donor_type as string | null,
    businessName: row.business_name as string | null,

    recipientId: row.recipient_id as string,
    recipientName: row.recipient_name as string,
    institutionName: row.institution_name as string | null,
    institutionType: row.institution_type as string | null,

    requestedPortions: Number(row.requested_portions),
    fulfillmentMethod: row.fulfillment_method as string | null,
    requestStatus: row.request_status as string,

    scheduledStartAt: row.scheduled_start_at as Date | null,
    scheduledEndAt: row.scheduled_end_at as Date | null,

    deliveryTaskId: row.delivery_task_id as string | null,
    volunteerId: row.volunteer_id as string | null,
    volunteerName: row.volunteer_name as string | null,
    deliveryTaskStatus: row.delivery_task_status as string | null,

    requestedAt: row.requested_at as Date,
    respondedAt: row.responded_at as Date | null,
    completedAt: row.completed_at as Date | null,
  };
}

export async function findDonationHistoriesByUser(
  userId: string,
  role: string,
  query: DonationHistoryQuery,
): Promise<PaginatedDonationHistories> {
  const accessCondition = getAccessCondition(userId, role);
  const offset = (query.page - 1) * query.limit;

  const statusCondition = query.status
    ? sql`AND request_status = ${query.status}`
    : sql``;

  const result = await db.execute(sql`
    SELECT *
    FROM public.donation_histories
    WHERE ${accessCondition}
    ${statusCondition}
    ORDER BY requested_at DESC, request_id DESC
    LIMIT ${query.limit}
    OFFSET ${offset}
  `);

  const countResult = await db.execute(sql`
    SELECT COUNT(*)::int AS total
    FROM public.donation_histories
    WHERE ${accessCondition}
    ${statusCondition}
  `);

  const items = result.rows.map((row) =>
    mapHistoryRow(row as Record<string, unknown>),
  );

  const totalItems = Number(countResult.rows[0]?.total ?? 0);

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      totalItems,
      totalPages: Math.ceil(totalItems / query.limit),
    },
  };
}

export async function findDonationHistoryById(
  requestId: string,
  userId: string,
  role: string,
): Promise<DonationHistory | null> {
  const accessCondition = getAccessCondition(userId, role);

  const result = await db.execute(sql`
    SELECT *
    FROM public.donation_histories
    WHERE request_id = ${requestId}
      AND ${accessCondition}
    LIMIT 1
  `);

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return mapHistoryRow(row as Record<string, unknown>);
}
