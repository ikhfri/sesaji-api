export interface DonationHistory {
  requestId: string;
  listingId: string;
  foodName: string;
  categoryName: string | null;

  donorId: string;
  donorName: string;
  donorType: string | null;
  businessName: string | null;

  recipientId: string;
  recipientName: string;
  institutionName: string | null;
  institutionType: string | null;

  requestedPortions: number;
  fulfillmentMethod: string | null;
  requestStatus: string;

  scheduledStartAt: Date | null;
  scheduledEndAt: Date | null;

  deliveryTaskId: string | null;
  volunteerId: string | null;
  volunteerName: string | null;
  deliveryTaskStatus: string | null;

  requestedAt: Date;
  respondedAt: Date | null;
  completedAt: Date | null;
}

export interface DonationHistoryQuery {
  page: number;
  limit: number;
  status?: string;
}

export interface PaginatedDonationHistories {
  items: DonationHistory[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}
