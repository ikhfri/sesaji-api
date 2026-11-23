
import { db } from "../index.js";
import { roles } from "../schema/roles.js";
import { USER_ROLES } from "../schema/enums.js";

const roleDescriptions: Record<string, string> = {
  ADMIN: "Administrator yang mengelola seluruh platform SESAJI.",
  DONOR_INDIVIDUAL: "Pengguna individu yang mendonasikan makanan.",
  DONOR_BUSINESS: "Bisnis atau organisasi yang mendonasikan makanan.",
  RECEIVER: "Penerima bantuan makanan.",
  VOLUNTEER: "Relawan yang membantu proses pengantaran donasi.",
};

export async function seedRoles() {
  for (const name of Object.values(USER_ROLES)) {
    await db
      .insert(roles)
      .values({
        name,
        description: roleDescriptions[name],
      })
      .onConflictDoNothing({
        target: roles.name,
      });
  }

  console.log("Roles seeded successfully.");
}
