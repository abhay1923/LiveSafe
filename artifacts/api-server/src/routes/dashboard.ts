import { Router, type IRouter } from "express";
import { db, hotspotsTable, incidentsTable, sosAlertsTable } from "@workspace/db";
import { count, eq, gte, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/dashboard/stats", requireAuth, async (_req, res) => {
  const currentWindowStart = new Date();
  currentWindowStart.setDate(currentWindowStart.getDate() - 30);
  const previousWindowStart = new Date();
  previousWindowStart.setDate(previousWindowStart.getDate() - 60);

  const [hotspotCount, criticalHotspotCount, incidentCount, resolvedIncidentCount, activeSosCount, responseTime, currentIncidents, previousIncidents] =
    await Promise.all([
      db.select({ c: count() }).from(hotspotsTable),
      db.select({ c: count() }).from(hotspotsTable).where(eq(hotspotsTable.riskLevel, "critical")),
      db.select({ c: count() }).from(incidentsTable),
      db.select({ c: count() }).from(incidentsTable).where(eq(incidentsTable.status, "resolved")),
      db.select({ c: count() }).from(sosAlertsTable).where(eq(sosAlertsTable.status, "active")),
      db
        .select({
          seconds: sql<number>`coalesce(avg(${sosAlertsTable.responseTimeSeconds}), 0)`,
        })
        .from(sosAlertsTable)
        .where(eq(sosAlertsTable.status, "resolved")),
      db.select({ c: count() }).from(incidentsTable).where(gte(incidentsTable.createdAt, currentWindowStart)),
      db
        .select({ c: count() })
        .from(incidentsTable)
        .where(sql`${incidentsTable.createdAt} >= ${previousWindowStart} and ${incidentsTable.createdAt} < ${currentWindowStart}`),
    ]);

  const averageResponseSeconds = Number(responseTime[0]?.seconds ?? 0);
  const current = Number(currentIncidents[0]?.c ?? 0);
  const previous = Number(previousIncidents[0]?.c ?? 0);
  const reductionPct = previous > 0
    ? Math.round(((previous - current) / previous) * 1000) / 10
    : 0;

  res.json({
    total_incidents: Number(incidentCount[0]?.c ?? 0),
    resolved_incidents: Number(resolvedIncidentCount[0]?.c ?? 0),
    active_sos_alerts: Number(activeSosCount[0]?.c ?? 0),
    hotspot_count: Number(hotspotCount[0]?.c ?? 0),
    critical_hotspot_count: Number(criticalHotspotCount[0]?.c ?? 0),
    response_time_avg: Math.round((averageResponseSeconds / 60) * 10) / 10,
    crime_reduction_pct: reductionPct,
  });
});

export default router;
