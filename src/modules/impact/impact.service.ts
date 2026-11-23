
import { AppError } from "../../shared/middleware/error-handler.js";
import {
  getActiveUserMetrics,
  getCompletedDonationMetrics,
  getDonorPersonalImpact,
  getReceiverPersonalImpact,
  getTotalFoodRequests,
  getVolunteerPersonalImpact,
} from "./impact.repository.js";

export async function getAdminImpactDashboard() {
  const [
    donationMetrics,
    totalRequests,
    activeUserMetrics,
  ] = await Promise.all([
    getCompletedDonationMetrics(),
    getTotalFoodRequests(),
    getActiveUserMetrics(),
  ]);

  const fulfillmentRate =
    totalRequests > 0
      ? Number(
          (
            (donationMetrics.completedDonations / totalRequests) *
            100
          ).toFixed(2),
        )
      : 0;

  return {
    summary: {
      totalPortionsDistributed:
        donationMetrics.totalPortionsDistributed,

      completedDonations:
        donationMetrics.completedDonations,

      ...activeUserMetrics,

      totalRequests,
      fulfillmentRate,
      averageDistributionTimeMinutes: Number(
        donationMetrics.averageDistributionTimeMinutes.toFixed(2),
      ),
    },

    generatedAt: new Date().toISOString(),
  };
}

export async function getMyPersonalImpact(
  userId: string,
  role: string,
) {
  switch (role) {
    case "DONOR_INDIVIDUAL":
    case "DONOR_BUSINESS": {
      const impact = await getDonorPersonalImpact(userId);

      return {
        role,
        summary: impact.summary,
        trend: impact.trend,
        trendPeriod: "LAST_30_DAYS",
      };
    }

    case "RECEIVER": {
      const impact = await getReceiverPersonalImpact(userId);

      return {
        role,
        summary: impact.summary,
        trend: impact.trend,
        trendPeriod: "LAST_30_DAYS",
      };
    }

    case "VOLUNTEER": {
      const impact = await getVolunteerPersonalImpact(userId);

      return {
        role,
        summary: impact.summary,
        trend: impact.trend,
        trendPeriod: "LAST_30_DAYS",
      };
    }

    default:
      throw new AppError(
        403,
        "Your role does not have a personal impact dashboard",
      );
  }
}