// Loads the real, NCRB-derived hotspot dataset (produced by
// ml-pipeline/03_export_hotspots.py) into the `hotspots` table.
//
// Usage:
//   pnpm --filter @workspace/scripts seed-hotspots
//
// Requires DATABASE_URL to be set (same as the rest of the app).
// Safe to re-run: upserts on externalId.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { db, hotspotsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.resolve(__dirname, "../../ml-pipeline/hotspots_real.json");

interface RealHotspot {
  id: string;
  district: string;
  state: string;
  lat: number;
  lon: number;
  risk_level: "low" | "medium" | "high" | "critical";
  risk_score: number;
  data_completeness: number;
  total_crimes_reported: number;
  crime_rate_per_lakh: number | null;
  reported_categories: string[];
  primary_warning: string;
  trend: "rising" | "stable" | "falling";
  population_lakh: number | null;
  radius_meters: number;
  data_year: number;
  geo_source: string;
  predicted_next_year_severity: number;
  predicted_next_year_risk_level: string;
}

async function main() {
  const raw = readFileSync(DATA_PATH, "utf-8");
  const records: RealHotspot[] = JSON.parse(raw);
  console.log(`Loaded ${records.length} real NCRB-derived hotspots from ${DATA_PATH}`);

  let inserted = 0;
  for (const r of records) {
    await db
      .insert(hotspotsTable)
      .values({
        externalId: r.id,
        district: r.district,
        state: r.state,
        latitude: r.lat,
        longitude: r.lon,
        riskLevel: r.risk_level,
        riskScore: r.risk_score,
        dataCompleteness: r.data_completeness,
        totalCrimesReported: r.total_crimes_reported,
        crimeRatePerLakh: r.crime_rate_per_lakh,
        reportedCategories: r.reported_categories,
        primaryWarning: r.primary_warning,
        trend: r.trend,
        populationLakh: r.population_lakh,
        radiusMeters: r.radius_meters,
        dataYear: r.data_year,
        geoSource: r.geo_source,
        predictedNextYearSeverity: r.predicted_next_year_severity,
        predictedNextYearRiskLevel: r.predicted_next_year_risk_level,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: hotspotsTable.externalId,
        set: {
          riskLevel: r.risk_level,
          riskScore: r.risk_score,
          dataCompleteness: r.data_completeness,
          totalCrimesReported: r.total_crimes_reported,
          crimeRatePerLakh: r.crime_rate_per_lakh,
          reportedCategories: r.reported_categories,
          primaryWarning: r.primary_warning,
          trend: r.trend,
          predictedNextYearSeverity: r.predicted_next_year_severity,
          predictedNextYearRiskLevel: r.predicted_next_year_risk_level,
          updatedAt: new Date(),
        },
      });
    inserted++;
  }

  console.log(`Upserted ${inserted} hotspot rows into the real "hotspots" table.`);
  await db.execute(sql`select 1`); // keep pool warm until here, then exit
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
