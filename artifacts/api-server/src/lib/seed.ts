import crypto from "node:crypto";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "./auth";
import { logger } from "./logger";

interface SeedUser {
  email: string;
  name: string;
  password: string;
  role: "citizen" | "police" | "admin" | "super_admin";
}

const DEFAULT_SUPER_ADMIN_EMAIL = "superadmin@livesafe.local";

async function ensureUser(seed: SeedUser) {
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, seed.email));
  if (existing) return;
  const passwordHash = await hashPassword(seed.password);
  await db.insert(usersTable).values({
    email: seed.email,
    name: seed.name,
    passwordHash,
    role: seed.role,
    isApproved: true,
    isActive: true,
  });
  logger.info({ email: seed.email, role: seed.role }, "Seeded user");
}

export async function seedDefaults() {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL ?? DEFAULT_SUPER_ADMIN_EMAIL;
  // Never fall back to a published password. If SUPER_ADMIN_PASSWORD is not
  // set, a random one is generated and logged once on first boot.
  let superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
  if (!superAdminPassword) {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, superAdminEmail));
    if (!existing) {
      superAdminPassword = crypto.randomBytes(18).toString("base64url");
      logger.warn(
        { email: superAdminEmail, generatedPassword: superAdminPassword },
        "SUPER_ADMIN_PASSWORD not set: generated a one-time password. Store it now and set SUPER_ADMIN_PASSWORD.",
      );
    } else {
      superAdminPassword = crypto.randomBytes(18).toString("base64url"); // unused: account exists
    }
  }

  await ensureUser({
    email: superAdminEmail,
    name: "Super Admin",
    password: superAdminPassword,
    role: "super_admin",
  });
}
