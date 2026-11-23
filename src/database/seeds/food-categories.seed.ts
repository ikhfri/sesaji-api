
import { db } from "../index.js";
import { foodCategories } from "../schema/food-categories.js";

const categories = [
  {
    name: "Makanan Berat",
    slug: "makanan-berat",
    description: "Nasi, lauk-pauk, dan makanan utama.",
  },
  {
    name: "Makanan Ringan",
    slug: "makanan-ringan",
    description: "Snack, camilan, dan makanan ringan.",
  },
  {
    name: "Roti dan Kue",
    slug: "roti-dan-kue",
    description: "Roti, pastry, kue, dan produk bakery.",
  },
  {
    name: "Buah-buahan",
    slug: "buah-buahan",
    description: "Buah segar dan olahan buah.",
  },
  {
    name: "Sayuran",
    slug: "sayuran",
    description: "Sayuran segar dan olahan sayuran.",
  },
  {
    name: "Minuman",
    slug: "minuman",
    description: "Air mineral, jus, susu, dan minuman lainnya.",
  },
  {
    name: "Makanan Kemasan",
    slug: "makanan-kemasan",
    description: "Makanan siap konsumsi dalam kemasan.",
  },
  {
    name: "Bahan Pokok",
    slug: "bahan-pokok",
    description: "Beras, minyak, tepung, dan kebutuhan pangan pokok.",
  },
];

export async function seedFoodCategories() {
  await db
    .insert(foodCategories)
    .values(categories)
    .onConflictDoNothing({
      target: foodCategories.slug,
    });

  console.log("Food categories seeded successfully.");
}
