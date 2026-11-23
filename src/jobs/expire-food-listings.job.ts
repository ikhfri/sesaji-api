
import {
  and,
  eq,
  inArray,
  lte,
} from "drizzle-orm";

import { db } from "../database/index.js";
import {
  foodListings,
  foodRequests,
} from "../database/schema/index.js";
import { createNotificationSafely } from "../modules/notifications/notifications.service.js";

const EXPIRATION_INTERVAL_MS = 60 * 1000;

let interval: NodeJS.Timeout | undefined;
let isRunning = false;

interface ExpiredListing {
  id: string;
  donorId: string;
  name: string;
}

interface ExpiredRequest {
  id: string;
  recipientId: string;
  listingId: string;
}

export async function expireFoodListings() {
  if (isRunning) {
    return {
      expiredListings: 0,
      expiredRequests: 0,
    };
  }

  isRunning = true;

  try {
    const now = new Date();

    // Listing dan request diubah dalam satu transaksi.
    const result = await db.transaction(async (tx) => {
      const expiredListings = await tx
        .update(foodListings)
        .set({
          status: "EXPIRED",
          updatedAt: now,
        })
        .where(
          and(
            inArray(foodListings.status, [
              "ACTIVE",
              "FULLY_RESERVED",
            ]),
            lte(foodListings.pickupDeadline, now),
          ),
        )
        .returning({
          id: foodListings.id,
          donorId: foodListings.donorId,
          name: foodListings.name,
        });

      if (expiredListings.length === 0) {
        return {
          expiredListings: [] as ExpiredListing[],
          expiredRequests: [] as ExpiredRequest[],
        };
      }

      const listingIds = expiredListings.map(
        (listing) => listing.id,
      );

      // Hanya request PENDING yang ikut kedaluwarsa.
      // APPROVED dan IN_PROGRESS tidak disentuh.
      const expiredRequests = await tx
        .update(foodRequests)
        .set({
          status: "EXPIRED",
          updatedAt: now,
        })
        .where(
          and(
            inArray(foodRequests.listingId, listingIds),
            eq(foodRequests.status, "PENDING"),
          ),
        )
        .returning({
          id: foodRequests.id,
          recipientId: foodRequests.recipientId,
          listingId: foodRequests.listingId,
        });

      return {
        expiredListings,
        expiredRequests,
      };
    });

    // Notifikasi dikirim setelah transaksi berhasil.
    const notificationJobs = [
      ...result.expiredListings.map((listing) =>
        createNotificationSafely({
          userId: listing.donorId,
          type: "LISTING_EXPIRED",
          title: "Listing kedaluwarsa",
          body: `Listing "${listing.name}" telah melewati batas waktu pengambilan.`,
          data: {
            listingId: listing.id,
          },
        }),
      ),

      ...result.expiredRequests.map((request) =>
        createNotificationSafely({
          userId: request.recipientId,
          type: "REQUEST_EXPIRED",
          title: "Permintaan kedaluwarsa",
          body: "Permintaan makanan kamu kedaluwarsa karena batas waktu listing telah lewat.",
          data: {
            requestId: request.id,
            listingId: request.listingId,
          },
        }),
      ),
    ];

    await Promise.all(notificationJobs);

    if (result.expiredListings.length > 0) {
      console.log(
        `[Expiration Job] ${result.expiredListings.length} listing(s) expired.`,
      );
    }

    if (result.expiredRequests.length > 0) {
      console.log(
        `[Expiration Job] ${result.expiredRequests.length} pending request(s) expired.`,
      );
    }

    return {
      expiredListings: result.expiredListings.length,
      expiredRequests: result.expiredRequests.length,
    };
  } finally {
    isRunning = false;
  }
}

export function startExpireFoodListingsJob() {
  if (interval) {
    return;
  }

  console.log(
    "[Expiration Job] Scheduler started. Interval: 60 seconds.",
  );

  void expireFoodListings().catch((error: unknown) => {
    console.error(
      "[Expiration Job] Initial execution failed:",
      error,
    );
  });

  interval = setInterval(() => {
    void expireFoodListings().catch((error: unknown) => {
      console.error(
        "[Expiration Job] Execution failed:",
        error,
      );
    });
  }, EXPIRATION_INTERVAL_MS);

  interval.unref();
}

export function stopExpireFoodListingsJob() {
  if (!interval) {
    return;
  }

  clearInterval(interval);
  interval = undefined;

  console.log("[Expiration Job] Scheduler stopped.");
}
