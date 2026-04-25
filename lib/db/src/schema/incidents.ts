import { pgTable, serial, text, doublePrecision, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";

export const incidentsTable = pgTable("incidents", {
  id: serial("id").primaryKey(),
  type: text("type", {
    enum: [
      "theft",
      "robbery",
      "assault",
      "harassment",
      "vandalism",
      "burglary",
      "fraud",
      "cybercrime",
      "drug_offense",
      "kidnapping",
      "extortion",
      "other",
    ],
  }).notNull(),
  description: text("description").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  severity: text("severity", { enum: ["low", "medium", "high", "critical"] }).notNull().default("low"),
  status: text("status", { enum: ["reported", "verified", "resolved", "dismissed"] }).notNull().default("reported"),
  reportedBy: integer("reported_by").references(() => usersTable.id),
  verifiedBy: integer("verified_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertIncidentSchema = createInsertSchema(incidentsTable).omit({ id: true, createdAt: true });
export type InsertIncident = typeof incidentsTable.$inferInsert;
export type Incident = typeof incidentsTable.$inferSelect;
