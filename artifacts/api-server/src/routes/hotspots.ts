import { Router, type IRouter } from "express";
import { db, hotspotsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

function serialize(row: typeof hotspotsTable.$inferSelect) {
  return {
    id: row.externalId,
    city: row.district,
    latitude: row.latitude,
    longitude: row.longitude,
    risk_score: row.riskScore,
    classification: row.riskLevel,
    radius: row.radiusMeters,
    crime_count: row.totalCrimesReported,
    state: `${row.district}, ${row.state}`,
    predicted_crimes: row.reportedCategories,
    primary_warning: row.primaryWarning,
    trend: row.trend,
    model_confidence: row.dataCompleteness / 100,
    created_at: row.createdAt.toISOString(),
  };
}

router.get("/hotspots", requireAuth, async (_req, res) => {
  const rows = await db
    .select()
    .from(hotspotsTable)
    .orderBy(desc(hotspotsTable.riskScore), hotspotsTable.state, hotspotsTable.district);

  res.json(rows.map(serialize));
});

export default router;
