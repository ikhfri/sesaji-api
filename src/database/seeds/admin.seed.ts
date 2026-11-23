
import argon2 from "argon2";
import { eq } from "drizzle-orm";

import { db } from "../index.js";
import { env } from "../../config/env.js";
import { roles } from "../schema/roles.js";
import { users } from "../schema/users.js";
import { USER_ROLES } from "../schema/enums.js";

export async function seedAdmin(): Promise<void> {
  const email = env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = env.ADMIN_BOOTSTRAP_PASSWORD;

  if (!email && !password) {
    console.log("Admin bootstrap skipped: credentials not configured.");
    return;
  }

  if (!email || !password) {
    throw new Error(
      "ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD must both be configured.",
    );
  }

  const [adminRole] = await db
    .select()
    .from(roles)
    .where(eq(roles.name, USER_ROLES.ADMIN))
    .limit(1);

  if (!adminRole) {
    throw new Error("ADMIN role not found. Run seedRoles() first.");
  }

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser) {
    console.log("Admin bootstrap skipped: email already exists.");
    return;
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
  });

  await db.insert(users).values({
    roleId: adminRole.id,
    fullName: env.ADMIN_BOOTSTRAP_NAME,
    email,
    passwordHash,
    emailVerifiedAt: new Date(),
    accountStatus: "ACTIVE",
  });

  console.log("Initial admin account created successfully.");
}
