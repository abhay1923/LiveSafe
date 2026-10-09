import { pgTable, serial, text, timestamp, integer, index, uniqueIndex } from "drizzle-orm/pg-core";

// Public web signals (police advisories, verified news) found for a district
// by the TinyFish Search API. A signal is stored as "pending" and is only
// treated as verified after a police or admin reviewer confirms it.
export const liveSignalsTable = pgTable(
  "live_signals",
  {
    id: serial("id").primaryKey(),
    externalKey: text("external_key").notNull(),
    district: text("district").notNull(),
    state: text("state").notNull(),
    title: text("title").notNull(),
    snippet: text("snippet"),
    sourceUrl: text("source_url").notNull(),
    sourceDomain: text("source_domain").notNull(),
    provider: text("provider").notNull().default("tinyfish-search"),
    verificationStatus: text("verification_status", { enum: ["pending", "verified", "rejected"] })
      .notNull()
      .default("pending"),
    verifiedBy: text("verified_by"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    rankPosition: integer("rank_position"),
  },
  (t) => [
    uniqueIndex("live_signals_external_key_idx").on(t.externalKey),
    index("live_signals_district_idx").on(t.district, t.state),
    index("live_signals_status_idx").on(t.verificationStatus),
  ],
);
