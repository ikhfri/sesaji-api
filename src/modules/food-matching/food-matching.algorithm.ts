
import type {
  FoodMatchingCandidate,
  FoodMatchingResult,
  MatchingOptions,
  ReceiverNeedInput,
} from "./food-matching.types.js";

const EARTH_RADIUS_KM = 6371;

const DEFAULT_OPTIONS: MatchingOptions = {
  maxRadiusKm: 10,
  estimatedTravelMinutesPerKm: 3,
  bufferMinutes: 30,
};

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function calculateDistanceKm(
  originLatitude: number,
  originLongitude: number,
  destinationLatitude: number,
  destinationLongitude: number,
): number {
  const latitudeDifference = toRadians(
    destinationLatitude - originLatitude,
  );

  const longitudeDifference = toRadians(
    destinationLongitude - originLongitude,
  );

  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(toRadians(originLatitude)) *
      Math.cos(toRadians(destinationLatitude)) *
      Math.sin(longitudeDifference / 2) ** 2;

  const centralAngle =
    2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * centralAngle;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeTag(tag: string): string {
  return tag.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function normalizeAllergen(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function isTagSatisfied(
  tag: string,
  candidate: FoodMatchingCandidate,
): boolean {
  const normalizedTag = normalizeTag(tag);

  const allergens = candidate.allergens.map(normalizeAllergen);

  switch (normalizedTag) {
    case "HALAL":
      return candidate.isHalal;

    case "VEGETARIAN":
      return candidate.isVegetarian;

    case "NO_PEANUT":
      return !allergens.some((allergen) =>
        ["peanut", "peanuts", "kacang_tanah"].includes(allergen),
      );

    case "NO_DAIRY":
      return !allergens.some((allergen) =>
        ["milk", "dairy", "susu"].includes(allergen),
      );

    case "NO_EGG":
      return !allergens.some((allergen) =>
        ["egg", "eggs", "telur"].includes(allergen),
      );

    case "NO_SEAFOOD":
      return !allergens.some((allergen) =>
        [
          "seafood",
          "fish",
          "shellfish",
          "ikan",
          "udang",
          "kerang",
        ].includes(allergen),
      );

    default:
      // Jangan menganggap kebutuhan yang tidak didukung
      // oleh atribut listing sebagai kebutuhan yang terpenuhi.
      return false;
  }
}

function calculateNeedScore(
  candidate: FoodMatchingCandidate,
  need: ReceiverNeedInput,
  distanceKm: number,
  estimatedTravelMinutes: number,
  remainingMinutes: number,
  options: MatchingOptions,
): {
  score: number;
  reasons: string[];
} {
  const distanceScore = clamp(
    1 - distanceKm / options.maxRadiusKm,
  );

  const quantityScore = clamp(
    Math.min(
      candidate.availablePortions,
      need.requiredPortions,
    ) / need.requiredPortions,
  );

  const availableTimeAfterTravel =
    remainingMinutes -
    estimatedTravelMinutes -
    options.bufferMinutes;

  const timeScore = clamp(
    1 - availableTimeAfterTravel / 240,
  );

  const categoryScore =
    need.categoryId === null ||
    need.categoryId === candidate.categoryId
      ? 1
      : 0;

  const matchedTags = need.specialTags.filter((tag) =>
    isTagSatisfied(tag, candidate),
  );

  const specialNeedsScore =
    need.specialTags.length === 0
      ? 1
      : matchedTags.length / need.specialTags.length;

  const score = Math.round(
    100 *
      (
        0.35 * distanceScore +
        0.25 * quantityScore +
        0.2 * timeScore +
        0.1 * categoryScore +
        0.1 * specialNeedsScore
      ),
  );

  const reasons: string[] = [
    `Jarak ${distanceKm.toFixed(1)} km`,
    `${candidate.availablePortions} porsi tersedia`,
  ];

  if (categoryScore === 1) {
    reasons.push("Kategori sesuai kebutuhan");
  }

  if (need.categoryId === null) {
    reasons.push("Tidak ada batasan kategori");
  }

  if (need.specialTags.length > 0) {
    if (matchedTags.length > 0) {
      reasons.push(
        `${matchedTags.length}/${need.specialTags.length} kebutuhan khusus terpenuhi`,
      );
    } else {
      reasons.push("Kebutuhan khusus belum terpenuhi");
    }
  }

  reasons.push(
    `Estimasi perjalanan ${estimatedTravelMinutes} menit`,
  );

  return {
    score,
    reasons,
  };
}

export function matchFoodListings(
  candidates: FoodMatchingCandidate[],
  receiver: {
    latitude: number;
    longitude: number;
    needs: ReceiverNeedInput[];
  },
  options: MatchingOptions = DEFAULT_OPTIONS,
): FoodMatchingResult[] {
  const now = Date.now();

  const needs: ReceiverNeedInput[] =
    receiver.needs.length > 0
      ? receiver.needs
      : [
          {
            categoryId: null,
            requiredPortions: 1,
            specialTags: [],
          },
        ];

  const results: FoodMatchingResult[] = [];

  for (const candidate of candidates) {
    const distanceKm = calculateDistanceKm(
      receiver.latitude,
      receiver.longitude,
      candidate.latitude,
      candidate.longitude,
    );

    if (distanceKm > options.maxRadiusKm) {
      continue;
    }

    const estimatedTravelMinutes = Math.ceil(
      distanceKm * options.estimatedTravelMinutesPerKm,
    );

    const remainingMinutes = Math.floor(
      (candidate.pickupDeadline.getTime() - now) / 60000,
    );

    // Hard filter: waktu tempuh + buffer harus tersedia.
    if (
      remainingMinutes <=
      estimatedTravelMinutes + options.bufferMinutes
    ) {
      continue;
    }

    const scoredNeeds = needs.map((need) =>
      calculateNeedScore(
        candidate,
        need,
        distanceKm,
        estimatedTravelMinutes,
        remainingMinutes,
        options,
      ),
    );

    scoredNeeds.sort((a, b) => b.score - a.score);

    const bestMatch = scoredNeeds[0];

    if (!bestMatch) {
      continue;
    }

    const matchLabel =
      bestMatch.score >= 80
        ? "SANGAT_COCOK"
        : bestMatch.score >= 60
          ? "COCOK"
          : "CUKUP_COCOK";

    results.push({
      listingId: candidate.id,
      name: candidate.name,
      description: candidate.description,
      category: candidate.categoryName,
      availablePortions: candidate.availablePortions,
      pickupDeadline: candidate.pickupDeadline,
      locationLabel: candidate.locationLabel,
      distanceKm: Number(distanceKm.toFixed(2)),
      estimatedTravelMinutes,
      score: bestMatch.score,
      matchLabel,
      reasons: bestMatch.reasons,
    });
  }

  return results.sort((a, b) => b.score - a.score);
}
