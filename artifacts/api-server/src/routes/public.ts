import { Router, type IRouter } from "express";
import { db, hotspotsTable } from "@workspace/db";
import { count, countDistinct, max } from "drizzle-orm";

const router: IRouter = Router();

// Public, unauthenticated summary used by the landing page. Every number is
// computed from the database, so the landing page never shows hand-typed figures.
router.get("/public/stats", async (_req, res) => {
  const [districts, states, latestYear] = await Promise.all([
    db.select({ c: count() }).from(hotspotsTable),
    db.select({ c: countDistinct(hotspotsTable.state) }).from(hotspotsTable),
    db.select({ y: max(hotspotsTable.dataYear) }).from(hotspotsTable),
  ]);
  res.json({
    mapped_districts: Number(districts[0]?.c ?? 0),
    states_covered: Number(states[0]?.c ?? 0),
    latest_data_year: latestYear[0]?.y ?? null,
  });
});

export default router;
