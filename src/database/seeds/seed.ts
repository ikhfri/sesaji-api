import { pool } from "../index.js";
import { seedRoles } from "./roles.seed.js";
import { seedFoodCategories } from "./food-categories.seed.js";
import { seedAdmin } from "./admin.seed.js";

async function main(): Promise<void> {
  try {
    console.log("Starting database seeding...");

    await seedRoles();
    await seedFoodCategories();
    await seedAdmin();

    console.log("Database seeding completed successfully.");
  } catch (error) {
    console.error("Database seeding failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();