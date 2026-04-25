import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { incidentsTable } from "../../../../lib/db/src/schema/incidents";
import { eq, desc, and, gte, lte, sql, count } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../lib/auth";

const router: IRouter = Router();

const CRIME_TYPES = [
  "theft", "robbery", "assault", "harassment", "vandalism", "burglary",
  "fraud", "cybercrime", "drug_offense", "kidnapping", "extortion", "other",
] as const;
const SEVERITIES = ["low", "medium", "high", "critical"] as const;
const STATUSES = ["reported", "verified", "resolved", "dismissed"] as const;

function serialize(row: typeof incidentsTable.$inferSelect) {
  return {
    id: String(row.id),
    type: row.type,
    description: row.description,
    latitude: row.latitude,
    longitude: row.longitude,
    severity: row.severity,
    status: row.status,
    reported_by: row.reportedBy ? String(row.reportedBy) : undefined,
    verified_by: row.verifiedBy ? String(row.verifiedBy) : undefined,
    created_at: row.createdAt.toISOString(),
  };
}

const listSchema = z.object({
  type: z.enum(CRIME_TYPES).optional(),
  severity: z.enum(SEVERITIES).optional(),
  status: z.enum(STATUSES).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

router.get("/incidents", async (req, res) => {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: "Invalid query" });
  const { type, severity, status, from, to, limit } = parsed.data;

  const conds = [] as ReturnType<typeof eq>[];
  if (type) conds.push(eq(incidentsTable.type, type));
  if (severity) conds.push(eq(incidentsTable.severity, severity));
  if (status) conds.push(eq(incidentsTable.status, status));
  if (from) conds.push(gte(incidentsTable.createdAt, new Date(from)));
  if (to) conds.push(lte(incidentsTable.createdAt, new Date(to)));

  const rows = await db
    .select()
    .from(incidentsTable)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(incidentsTable.createdAt))
    .limit(limit ?? 200);

  res.json(rows.map(serialize));
});

router.get("/incidents/stats", async (_req, res) => {
  const total = await db.select({ c: count() }).from(incidentsTable);
  const byType = await db
    .select({ type: incidentsTable.type, c: count() })
    .from(incidentsTable)
    .groupBy(incidentsTable.type);
  const bySeverity = await db
    .select({ severity: incidentsTable.severity, c: count() })
    .from(incidentsTable)
    .groupBy(incidentsTable.severity);
  const byStatus = await db
    .select({ status: incidentsTable.status, c: count() })
    .from(incidentsTable)
    .groupBy(incidentsTable.status);

  // Last 7 days timeline
  const since = new Date();
  since.setDate(since.getDate() - 6);
  since.setHours(0, 0, 0, 0);
  const timeline = await db
    .select({
      day: sql<string>`to_char(${incidentsTable.createdAt}, 'YYYY-MM-DD')`,
      c: count(),
    })
    .from(incidentsTable)
    .where(gte(incidentsTable.createdAt, since))
    .groupBy(sql`to_char(${incidentsTable.createdAt}, 'YYYY-MM-DD')`);

  res.json({
    total: total[0]?.c ?? 0,
    by_type: byType.map(r => ({ type: r.type, count: Number(r.c) })),
    by_severity: bySeverity.map(r => ({ severity: r.severity, count: Number(r.c) })),
    by_status: byStatus.map(r => ({ status: r.status, count: Number(r.c) })),
    timeline_7d: timeline.map(r => ({ day: r.day, count: Number(r.c) })),
  });
});

const createSchema = z.object({
  type: z.enum(CRIME_TYPES),
  description: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  severity: z.enum(SEVERITIES).optional(),
});

router.post("/incidents", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
  const [row] = await db
    .insert(incidentsTable)
    .values({
      type: parsed.data.type,
      description: parsed.data.description,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      severity: parsed.data.severity ?? "low",
      status: "reported",
      reportedBy: req.user!.id,
    })
    .returning();
  res.status(201).json(serialize(row));
});

export default router;
