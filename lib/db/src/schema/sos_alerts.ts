import { pgTable, serial, text, doublePrecision, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

export const sosAlertsTable = pgTable("sos_alerts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  userName: text("user_name"),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  currentLatitude: doublePrecision("current_latitude"),
  currentLongitude: doublePrecision("current_longitude"),
  locationUpdatedAt: timestamp("location_updated_at", { withTimezone: true }),
  trail: jsonb("trail").$type<Array<{ latitude: number; longitude: number; recorded_at: string }>>().notNull().default(sql`'[]'::jsonb`),
  events: jsonb("events").$type<Array<{ id: string; type: string; detail: string; created_at: string }>>().notNull().default(sql`'[]'::jsonb`),
  responderStatus: jsonb("responder_status").$type<Array<{ id: string; label: string; role: "police" | "family" | "volunteer" | "hospital"; status: "queued" | "notified" | "accepted" | "en_route" | "standby"; eta_minutes?: number }>>().notNull().default(sql`'[]'::jsonb`),
  evidenceItems: jsonb("evidence_items").$type<Array<{ id: string; type: "audio" | "video"; label: string; captured_at: string; review_status: "new" | "flagged" | "reviewed" }>>().notNull().default(sql`'[]'::jsonb`),
  status: text("status", { enum: ["active", "acknowledged", "resolved"] }).notNull().default("active"),
  assignedOfficer: text("assigned_officer"),
  responseTimeSeconds: integer("response_time_seconds"),
  whatsappNotificationsSent: integer("whatsapp_notifications_sent").notNull().default(0),
  escalated: boolean("escalated").notNull().default(false),
  safetyMode: text("safety_mode", { enum: ["everyday", "night", "women", "student"] }),
  lastCheckinAt: timestamp("last_checkin_at", { withTimezone: true }),
  notifiedTargets: jsonb("notified_targets").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  evidenceCount: integer("evidence_count").notNull().default(0),
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
export type InsertSosAlert = typeof sosAlertsTable.$inferInsert;
export type SosAlert = typeof sosAlertsTable.$inferSelect;
