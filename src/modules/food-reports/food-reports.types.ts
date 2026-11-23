
export type FoodReportType =
  | "UNSAFE_FOOD"
  | "FOOD_QUALITY"
  | "DELIVERY_ISSUE"
  | "MISCONDUCT"
  | "OTHER";

export type FoodReportStatus =
  | "PENDING"
  | "REVIEWING"
  | "RESOLVED"
  | "REJECTED";

export interface CreateFoodReportInput {
  listingId: string;
  requestId?: string;
  deliveryTaskId?: string;
  type: FoodReportType;
  description: string;
  evidenceImageUrls: string[];
}

export interface FoodReportsFilter {
  page: number;
  limit: number;
  status?: FoodReportStatus;
  type?: FoodReportType;
}

export interface ReviewFoodReportInput {
  notes?: string;
}

export interface ResolveFoodReportInput {
  resolutionNotes: string;
}

export interface RejectFoodReportInput {
  resolutionNotes: string;
}
