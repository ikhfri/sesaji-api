import {
  and,
  count,
  eq,
  gte,
  isNotNull,
  sql,
} from "drizzle-orm";

import { db } from "../../database/index.js";

import {
  foodRequests,
  roles,
  users,
  deliveryTasks,
  foodListings,
  foodCategories,
} from "../../database/schema/index.js";

export async function getCompletedDonationMetrics() {
  const [result] = await db
    .select({
      completedDonations: sql<number>`
        count(*)::int
      `,
      totalPortionsDistributed: sql<number>`
        coalesce(sum(${foodRequests.requestedPortions}), 0)::int
      `,
      averageDistributionTimeMinutes: sql<number>`
        coalesce(
          avg(
            extract(
              epoch from (
                ${foodRequests.completedAt} - ${foodRequests.createdAt}
              )
            ) / 60
          ),
          0
        )::float
      `,
    })
    .from(foodRequests)
.where(
  and(
    eq(foodRequests.status, "COMPLETED"),
    isNotNull(foodRequests.completedAt),
  ),
);
  return {
    completedDonations: Number(result?.completedDonations ?? 0),
    totalPortionsDistributed: Number(
      result?.totalPortionsDistributed ?? 0,
    ),
    averageDistributionTimeMinutes: Number(
      result?.averageDistributionTimeMinutes ?? 0,
    ),
  };
}

export async function getTotalFoodRequests() {
  const [result] = await db
    .select({
      totalRequests: sql<number>`count(*)::int`,
    })
    .from(foodRequests);

  return Number(result?.totalRequests ?? 0);
}

export async function getActiveUserMetrics() {
  const [result] = await db
    .select({
      activeDonors: sql<number>`
        count(*) filter (
          where ${roles.name} in (
            'DONOR_INDIVIDUAL',
            'DONOR_BUSINESS'
          )
        )::int
      `,
      activeReceivers: sql<number>`
        count(*) filter (
          where ${roles.name} = 'RECEIVER'
        )::int
      `,
      activeVolunteers: sql<number>`
        count(*) filter (
          where ${roles.name} = 'VOLUNTEER'
        )::int
      `,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.accountStatus, "ACTIVE"));

  return {
    activeDonors: Number(result?.activeDonors ?? 0),
    activeReceivers: Number(result?.activeReceivers ?? 0),
    activeVolunteers: Number(result?.activeVolunteers ?? 0),
  };
}

const getThirtyDaysAgo = () => {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date;
};

export async function getDonorPersonalImpact(userId: string) {
  const [summary] = await db
    .select({
      completedDonations: count(),
      totalPortions: sql<number>`
        coalesce(sum(${foodRequests.requestedPortions}), 0)::int
      `,
      averageCompletionMinutes: sql<number>`
        coalesce(
          avg(
            extract(
              epoch from (
                ${foodRequests.completedAt} - ${foodRequests.createdAt}
              )
            ) / 60
          ),
          0
        )::float
      `,
    })
    .from(foodRequests)
    .innerJoin(
      foodListings,
      eq(foodRequests.listingId, foodListings.id),
    )
    .where(
  and(
    eq(foodListings.donorId, userId),
    eq(foodRequests.status, "COMPLETED"),
    isNotNull(foodRequests.completedAt),
  ),
);

 const bucket = sql<string>`
  to_char(
    date_trunc(
      'day',
      ${foodRequests.completedAt} AT TIME ZONE 'Asia/Jakarta'
    ),
    'YYYY-MM-DD'
  )
`;

  const trend = await db
    .select({
      date: bucket,
      completedDonations: count(),
      totalPortions: sql<number>`
        coalesce(sum(${foodRequests.requestedPortions}), 0)::int
      `,
    })
    .from(foodRequests)
    .innerJoin(
      foodListings,
      eq(foodRequests.listingId, foodListings.id),
    )
    .where(
  and(
    eq(foodListings.donorId, userId),
    eq(foodRequests.status, "COMPLETED"),
    isNotNull(foodRequests.completedAt),
    gte(foodRequests.completedAt, getThirtyDaysAgo()),
  ),
)
    .groupBy(bucket)
    .orderBy(bucket);

  return {
    summary: {
      completedDonations: Number(summary?.completedDonations ?? 0),
      totalPortions: Number(summary?.totalPortions ?? 0),
      averageCompletionMinutes: Number(
        summary?.averageCompletionMinutes ?? 0,
      ),
    },
    trend,
  };
}


export async function getReceiverPersonalImpact(userId: string) {
  const [summary] = await db
    .select({
      completedDonations: count(),
      totalPortions: sql<number>`
        coalesce(sum(${foodRequests.requestedPortions}), 0)::int
      `,
      averageCompletionMinutes: sql<number>`
        coalesce(
          avg(
            extract(
              epoch from (
                ${foodRequests.completedAt} - ${foodRequests.createdAt}
              )
            ) / 60
          ),
          0
        )::float
      `,
    })
    .from(foodRequests)
    .where(
      and(
        eq(foodRequests.recipientId, userId),
        eq(foodRequests.status, "COMPLETED"),
        isNotNull(foodRequests.completedAt),
      ),
    );

  const bucket = sql<string>`
    to_char(
      date_trunc(
        'day',
        ${foodRequests.completedAt} AT TIME ZONE 'Asia/Jakarta'
      ),
      'YYYY-MM-DD'
    )
  `;

  const trend = await db
    .select({
      date: bucket,
      completedDonations: count(),
      totalPortions: sql<number>`
        coalesce(sum(${foodRequests.requestedPortions}), 0)::int
      `,
    })
    .from(foodRequests)
    .where(
      and(
        eq(foodRequests.recipientId, userId),
        eq(foodRequests.status, "COMPLETED"),
        isNotNull(foodRequests.completedAt),
        gte(foodRequests.completedAt, getThirtyDaysAgo()),
      ),
    )
    .groupBy(bucket)
    .orderBy(bucket);

  return {
    summary: {
      completedDonations: Number(summary?.completedDonations ?? 0),
      totalPortions: Number(summary?.totalPortions ?? 0),
      averageCompletionMinutes: Number(
        summary?.averageCompletionMinutes ?? 0,
      ),
    },
    trend,
  };
}


export async function getVolunteerPersonalImpact(userId: string) {
  const [summary] = await db
    .select({
      completedDeliveries: count(),
      totalPortions: sql<number>`
        coalesce(sum(${foodRequests.requestedPortions}), 0)::int
      `,
      averageDeliveryMinutes: sql<number>`
        coalesce(
          avg(
            extract(
              epoch from (
                ${deliveryTasks.completedAt} - ${deliveryTasks.assignedAt}
              )
            ) / 60
          ),
          0
        )::float
      `,
    })
    .from(deliveryTasks)
    .innerJoin(
      foodRequests,
      eq(deliveryTasks.requestId, foodRequests.id),
    )
   .where(
  and(
    eq(deliveryTasks.volunteerId, userId),
    eq(deliveryTasks.status, "COMPLETED"),
    eq(foodRequests.status, "COMPLETED"),
    isNotNull(deliveryTasks.completedAt),
    isNotNull(deliveryTasks.assignedAt),
    isNotNull(foodRequests.completedAt),
  ),
);

const bucket = sql<string>`
  to_char(
    date_trunc(
      'day',
      ${deliveryTasks.completedAt} AT TIME ZONE 'Asia/Jakarta'
    ),
    'YYYY-MM-DD'
  )
`;

  const trend = await db
    .select({
      date: bucket,
      completedDeliveries: count(),
      totalPortions: sql<number>`
        coalesce(sum(${foodRequests.requestedPortions}), 0)::int
      `,
    })
    .from(deliveryTasks)
    .innerJoin(
      foodRequests,
      eq(deliveryTasks.requestId, foodRequests.id),
    )
  .where(
  and(
    eq(deliveryTasks.volunteerId, userId),
    eq(deliveryTasks.status, "COMPLETED"),
    eq(foodRequests.status, "COMPLETED"),
    isNotNull(deliveryTasks.completedAt),
    isNotNull(deliveryTasks.assignedAt),
    isNotNull(foodRequests.completedAt),
  ),
)
    .groupBy(bucket)
    .orderBy(bucket);

  return {
    summary: {
      completedDeliveries: Number(
        summary?.completedDeliveries ?? 0,
      ),
      totalPortions: Number(summary?.totalPortions ?? 0),
      averageDeliveryMinutes: Number(
        summary?.averageDeliveryMinutes ?? 0,
      ),
    },
    trend,
  };
}

export async function getFoodImpactMetrics() {
  const [summary] = await db
    .select({
      completedDonations: count(),
      totalPortions: sql<number>`
        coalesce(sum(${foodRequests.requestedPortions}), 0)::int
      `,
    })
    .from(foodRequests)
    .where(
      and(
        eq(foodRequests.status, "COMPLETED"),
        isNotNull(foodRequests.completedAt),
      ),
    );

  const byCategory = await db
    .select({
      categoryName: foodCategories.name,
      completedDonations: count(),
      totalPortions: sql<number>`
        coalesce(sum(${foodRequests.requestedPortions}), 0)::int
      `,
    })
    .from(foodRequests)
    .innerJoin(
      foodListings,
      eq(foodRequests.listingId, foodListings.id),
    )
    .innerJoin(
      foodCategories,
      eq(foodListings.categoryId, foodCategories.id),
    )
    .where(
      and(
        eq(foodRequests.status, "COMPLETED"),
        isNotNull(foodRequests.completedAt),
      ),
    )
    .groupBy(foodCategories.id, foodCategories.name)
    .orderBy(foodCategories.name);

const now = new Date();

const monthsAgo = new Date(
  Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() - 11,
    1,
  ),
);

  const monthBucket = sql<string>`
    to_char(
      date_trunc(
        'month',
        ${foodRequests.completedAt} AT TIME ZONE 'Asia/Jakarta'
      ),
      'YYYY-MM'
    )
  `;

  const trend = await db
    .select({
      month: monthBucket,
      completedDonations: count(),
      totalPortions: sql<number>`
        coalesce(sum(${foodRequests.requestedPortions}), 0)::int
      `,
    })
    .from(foodRequests)
    .where(
      and(
        eq(foodRequests.status, "COMPLETED"),
        isNotNull(foodRequests.completedAt),
        gte(foodRequests.completedAt, monthsAgo),
      ),
    )
    .groupBy(monthBucket)
    .orderBy(monthBucket);

  return {
    summary: {
      completedDonations: Number(
        summary?.completedDonations ?? 0,
      ),
      totalPortions: Number(summary?.totalPortions ?? 0),
    },

    byCategory: byCategory.map((item) => ({
      categoryName: item.categoryName,
      completedDonations: Number(item.completedDonations),
      totalPortions: Number(item.totalPortions),
    })),

    trend: trend.map((item) => ({
      month: item.month,
      completedDonations: Number(item.completedDonations),
      totalPortions: Number(item.totalPortions),
    })),
  };
}