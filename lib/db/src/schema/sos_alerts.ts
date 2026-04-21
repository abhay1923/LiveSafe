import { pgTable, serial, text, doublePrecision, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const sosAlertsTable = pgTable("sos_alerts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  userName: text("user_name"),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  currentLatitude: doublePrecision("current_latitude"),
  currentLongitude: doublePrecision("current_longitude"),
  locationUpdatedAt: timestamp("location_updated_at", { withTimezone: true }),
  status: text("status", { enum: ["active", "acknowledged", "resolved"] }).notNull().default("active"),
  assignedOfficer: text("assigned_officer"),
  responseTimeSeconds: integer("response_time_seconds"),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSosAlertSchema = createInsertSchema(sosAlertsTable).omit({
  id: true,
  createdAt: true,
  acknowledgedAt: true,
  resolvedAt: true,
  locationUpdatedAt: true,
  currentLatitude: true,
  currentLongitude: true,
  status: true,
  assignedOfficer: true,
  responseTimeSeconds: true,
});
export type InsertSosAlert = z.infer<typeof insertSosAlertSchema>;
export type SosAlert = typeof sosAlertsTable.$inferSelect;
