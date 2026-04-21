import { Router, type IRouter } from "express";
import { db, sosAlertsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const createSchema = z.object({
  user_id: z.string().min(1),
  user_name: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
});

const locationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

const ackSchema = z.object({
  officer: z.string().optional(),
});

function serialize(row: typeof sosAlertsTable.$inferSelect) {
  return {
    id: String(row.id),
    user_id: row.userId,
    user_name: row.userName ?? undefined,
    latitude: row.latitude,
    longitude: row.longitude,
    current_latitude: row.currentLatitude ?? undefined,
    current_longitude: row.currentLongitude ?? undefined,
    location_updated_at: row.locationUpdatedAt?.toISOString(),
    status: row.status,
    assigned_officer: row.assignedOfficer ?? undefined,
    response_time: row.responseTimeSeconds ?? undefined,
    acknowledged_at: row.acknowledgedAt?.toISOString(),
    resolved_at: row.resolvedAt?.toISOString(),
    created_at: row.createdAt.toISOString(),
  };
}

router.get("/sos", async (_req, res) => {
  const rows = await db.select().from(sosAlertsTable).orderBy(desc(sosAlertsTable.createdAt));
  res.json(rows.map(serialize));
});

router.post("/sos", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", errors: parsed.error.issues });
  }
  const { user_id, user_name, latitude, longitude } = parsed.data;
  const [row] = await db
    .insert(sosAlertsTable)
    .values({
      userId: user_id,
      userName: user_name,
      latitude,
      longitude,
      currentLatitude: latitude,
      currentLongitude: longitude,
      locationUpdatedAt: new Date(),
    })
    .returning();
  res.status(201).json(serialize(row));
});

router.post("/sos/:id/location", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  const parsed = locationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload" });
  }
  const [row] = await db
    .update(sosAlertsTable)
    .set({
      currentLatitude: parsed.data.latitude,
      currentLongitude: parsed.data.longitude,
      locationUpdatedAt: new Date(),
    })
    .where(eq(sosAlertsTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ message: "Not found" });
  res.json(serialize(row));
});

router.patch("/sos/:id/acknowledge", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  const parsed = ackSchema.safeParse(req.body ?? {});
  const officer = parsed.success ? parsed.data.officer : undefined;
  const [row] = await db
    .update(sosAlertsTable)
    .set({
      status: "acknowledged",
      assignedOfficer: officer ?? "Officer on duty",
      acknowledgedAt: new Date(),
    })
    .where(eq(sosAlertsTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ message: "Not found" });
  res.json(serialize(row));
});

router.patch("/sos/:id/resolve", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  const [existing] = await db.select().from(sosAlertsTable).where(eq(sosAlertsTable.id, id));
  if (!existing) return res.status(404).json({ message: "Not found" });
  const responseTimeSeconds = Math.round((Date.now() - existing.createdAt.getTime()) / 1000);
  const [row] = await db
    .update(sosAlertsTable)
    .set({
      status: "resolved",
      resolvedAt: new Date(),
      responseTimeSeconds,
    })
    .where(eq(sosAlertsTable.id, id))
    .returning();
  res.json(serialize(row));
});

export default router;
