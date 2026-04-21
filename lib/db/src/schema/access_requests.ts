import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

export const accessRequestsTable = pgTable("access_requests", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  requestedRole: text("requested_role", { enum: ["police", "admin"] }).notNull(),
  badgeNumber: text("badge_number"),
  phone: text("phone"),
  reason: text("reason"),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AccessRequest = typeof accessRequestsTable.$inferSelect;
