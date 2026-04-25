import { db } from "@workspace/db";
import { usersTable } from "../../../../lib/db/src/schema/users";
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
const DEFAULT_SUPER_ADMIN_PASSWORD = "superadmin123";

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
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD ?? DEFAULT_SUPER_ADMIN_PASSWORD;

  await ensureUser({
    email: superAdminEmail,
    name: "Super Admin",
    password: superAdminPassword,
    role: "super_admin",
  });

  // Demo accounts (still work as in the original UI)
  await ensureUser({
    email: "citizen@example.com",
    name: "Priya Sharma",
    password: "citizen123",
    role: "citizen",
  });
  await ensureUser({
    email: "police@example.com",
    name: "Officer Rajesh Kumar",
    password: "police123",
    role: "police",
  });
  await ensureUser({
    email: "admin@example.com",
    name: "Admin Vikram Singh",
    password: "admin123",
    role: "admin",
  });
}
