
/**
 * Food Impact Estimation
 *
 * Semua angka merupakan estimasi, bukan hasil penimbangan
 * atau pengukuran emisi aktual.
 *
 * Average meal weight:
 * UNEP Food Waste Index Report 2024, citing WRAP 2020.
 *
 * Avoided emissions:
 * Literature range from environmental food waste prevention studies.
 */

export const FOOD_IMPACT_CONFIG = {
  averagePortionWeightKg: 0.42,

  avoidedEmissionFactor: {
    minKgCo2ePerKgFood: 0.8,
    maxKgCo2ePerKgFood: 4.4,
  },

  trendMonths: 12,

  methodology: {
    portionWeightSource:
      "UNEP Food Waste Index Report 2024 (420g average meal, citing WRAP 2020)",

    emissionFactorSource:
      "Environmental food waste prevention literature review (0.8–4.4 kg CO2e/kg food)",

    disclaimer:
      "Impact values are estimates based on average portion weight and literature emission factors. Actual values vary by food type, composition, and lifecycle assumptions.",
  },
} as const;
