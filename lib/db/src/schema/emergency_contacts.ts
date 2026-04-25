import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";

export const emergencyContactsTable = pgTable("emergency_contacts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEmergencyContactSchema = createInsertSchema(emergencyContactsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertEmergencyContact = typeof emergencyContactsTable.$inferInsert;
export type EmergencyContact = typeof emergencyContactsTable.$inferSelect;
