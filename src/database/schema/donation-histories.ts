import { alias, pgView } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";

import { foodRequests } from "./food-requests.js";
import { foodListings } from "./food-listings.js";
import { foodCategories } from "./food-categories.js";
import { users } from "./users.js";
import { donorProfiles, receiverProfiles } from "./profiles.js";
import { pickupSchedules } from "./pickup-schedules.js";
import { deliveryTasks } from "./delivery-tasks.js";

const donor = alias(users, "donor");
const recipient = alias(users, "recipient");
const volunteer = alias(users, "volunteer");

export const donationHistories = pgView("donation_histories").as((qb) =>
  qb
    .select({
      requestId: foodRequests.id,
      listingId: foodListings.id,
      foodName: foodListings.name,
      categoryName: foodCategories.name,

      donorId: donor.id,
      donorName: donor.fullName,
      donorType: donorProfiles.donorType,
      businessName: donorProfiles.businessName,

      recipientId: recipient.id,
      recipientName: recipient.fullName,
      institutionName: receiverProfiles.institutionName,
      institutionType: receiverProfiles.institutionType,

      requestedPortions: foodRequests.requestedPortions,
      fulfillmentMethod: foodRequests.fulfillmentMethod,
      requestStatus: foodRequests.status,

      scheduledStartAt: pickupSchedules.scheduledStartAt,
      scheduledEndAt: pickupSchedules.scheduledEndAt,

      deliveryTaskId: deliveryTasks.id,
      volunteerId: volunteer.id,
      volunteerName: volunteer.fullName,
      deliveryTaskStatus: deliveryTasks.status,

      requestedAt: foodRequests.createdAt,
      respondedAt: foodRequests.respondedAt,
      completedAt: foodRequests.completedAt,
    })
    .from(foodRequests)
    .innerJoin(
      foodListings,
      eq(foodRequests.listingId, foodListings.id),
    )
    .innerJoin(
      donor,
      eq(foodListings.donorId, donor.id),
    )
    .innerJoin(
      recipient,
      eq(foodRequests.recipientId, recipient.id),
    )
    .leftJoin(
      donorProfiles,
      eq(donorProfiles.userId, donor.id),
    )
    .leftJoin(
      receiverProfiles,
      eq(receiverProfiles.userId, recipient.id),
    )
    .leftJoin(
      foodCategories,
      eq(foodCategories.id, foodListings.categoryId),
    )
    .leftJoin(
      pickupSchedules,
      eq(pickupSchedules.requestId, foodRequests.id),
    )
    .leftJoin(
      deliveryTasks,
      eq(deliveryTasks.requestId, foodRequests.id),
    )
    .leftJoin(
      volunteer,
      eq(deliveryTasks.volunteerId, volunteer.id),
    ),
);
