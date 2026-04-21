import { pgTable, serial, text, doublePrecision, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";

export const sosAlertsTable = pgTable("sos_alerts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  status: text("status", { enum: ["active", "acknowledged", "resolved"] }).notNull().default("active"),
  assignedOfficer: integer("assigned_officer").references(() => usersTable.id),
  responseTimeSeconds: integer("response_time_seconds"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSosAlertSchema = createInsertSchema(sosAlertsTable).omit({ id: true, createdAt: true });
export type InsertSosAlert = z.infer<typeof insertSosAlertSchema>;
export type SosAlert = typeof sosAlertsTable.$inferSelect;
