
export interface ReceiverMatchingContext {
  userId: string;
  profileId: string;
  latitude: number;
  longitude: number;
  needs: ReceiverNeedInput[];
}

export interface ReceiverNeedInput {
  categoryId: string | null;
  requiredPortions: number;
  specialTags: string[];
}

export interface FoodMatchingCandidate {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  categoryName: string;
  availablePortions: number;
  isHalal: boolean;
  isVegetarian: boolean;
  allergens: string[];
  pickupDeadline: Date;
  latitude: number;
  longitude: number;
  locationLabel: string | null;
}

export interface MatchingOptions {
  maxRadiusKm: number;
  estimatedTravelMinutesPerKm: number;
  bufferMinutes: number;
}

export interface FoodMatchingResult {
  listingId: string;
  name: string;
  description: string | null;
  category: string;
  availablePortions: number;
  pickupDeadline: Date;
  locationLabel: string | null;
  distanceKm: number;
  estimatedTravelMinutes: number;
  score: number;
  matchLabel: "SANGAT_COCOK" | "COCOK" | "CUKUP_COCOK";
  reasons: string[];
}
