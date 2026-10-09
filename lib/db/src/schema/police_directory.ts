import { pgTable, serial, text, integer, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";

// Station-level police contacts. Source: official government/police pages, as
// compiled in scripts/data/police-directory (see README there). Coverage is
// partial: a missing station is not proof that it has no phone number.
export const policeStationsTable = pgTable(
  "police_stations",
  {
    id: serial("id").primaryKey(),
    state: text("state").notNull(),
    policeDistrict: text("police_district").notNull(),
    policeStation: text("police_station").notNull(),
    landline: text("landline"),
    mobile: text("mobile"),
    officialEmail: text("official_email"),
    stationAddress: text("station_address"),
    sourceUrl: text("source_url").notNull(),
    verificationDate: text("verification_date").notNull(),
    verificationStatus: text("verification_status").notNull(),
    notes: text("notes"),
  },
  (t) => [
    uniqueIndex("police_stations_state_station_idx").on(t.state, t.policeStation),
    index("police_stations_district_idx").on(t.state, t.policeDistrict),
  ],
);

// Official police portal for each State/UT, and how complete its station list is.
export const policeCoverageTable = pgTable("police_coverage", {
  state: text("state").primaryKey(),
  officialPortal: text("official_portal").notNull(),
  coverageStatus: text("coverage_status").notNull(),
  notes: text("notes"),
  lastChecked: text("last_checked").notNull(),
});

// Record of each call or email made from the dispatch page.
export const sosDispatchesTable = pgTable(
  "sos_dispatches",
  {
    id: serial("id").primaryKey(),
    sosAlertId: integer("sos_alert_id").notNull(),
    stationId: integer("station_id").notNull(),
    channel: text("channel", { enum: ["call", "email"] }).notNull(),
    performedBy: text("performed_by").notNull(),
    performedAt: timestamp("performed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sos_dispatches_alert_idx").on(t.sosAlertId)],
);
