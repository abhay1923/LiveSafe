import { Router, type IRouter, type Response } from "express";
import { db, sosAlertsTable, sosDispatchesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireRole, type AuthedRequest } from "../lib/auth";
import { routeSos, getStation } from "../lib/dispatch";

const router: IRouter = Router();

// Super admin only: routing an SOS to regional stations and logging contact.
router.get("/dispatch/sos/:id", requireAuth, requireRole("super_admin"), async (req: AuthedRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid SOS id" });

  const [alert] = await db.select().from(sosAlertsTable).where(eq(sosAlertsTable.id, id));
  if (!alert) return res.status(404).json({ message: "SOS alert not found" });

  const routing = await routeSos(alert.latitude, alert.longitude);
  const history = await db
    .select()
    .from(sosDispatchesTable)
    .where(eq(sosDispatchesTable.sosAlertId, id))
    .orderBy(desc(sosDispatchesTable.performedAt));

  res.json({
    alert: {
      id: String(alert.id),
      user_name: alert.userName ?? null,
      latitude: alert.latitude,
      longitude: alert.longitude,
      status: alert.status,
      created_at: alert.createdAt.toISOString(),
    },
    routing,
    dispatches: history.map((d) => ({
      id: String(d.id),
      station_id: String(d.stationId),
      channel: d.channel,
      performed_by: d.performedBy,
      performed_at: d.performedAt.toISOString(),
    })),
  });
});

router.post("/dispatch/sos/:id/log", requireAuth, requireRole("super_admin"), async (req: AuthedRequest, res: Response) => {
  const id = Number(req.params.id);
  const stationId = Number(req.body?.station_id);
  const channel = req.body?.channel;
  if (!Number.isInteger(id) || !Number.isInteger(stationId) || (channel !== "call" && channel !== "email")) {
    return res.status(400).json({ message: "Provide station_id and channel ('call' or 'email')." });
  }

  const [alert] = await db.select({ id: sosAlertsTable.id }).from(sosAlertsTable).where(eq(sosAlertsTable.id, id));
  if (!alert) return res.status(404).json({ message: "SOS alert not found" });
  const station = await getStation(stationId);
  if (!station) return res.status(404).json({ message: "Station not found" });

  const [created] = await db
    .insert(sosDispatchesTable)
    .values({ sosAlertId: id, stationId, channel, performedBy: req.user!.name })
    .returning();
  res.status(201).json({
    id: String(created.id),
    station_id: String(created.stationId),
    channel: created.channel,
    performed_by: created.performedBy,
    performed_at: created.performedAt.toISOString(),
  });
});

export default router;
