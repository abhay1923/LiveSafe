import { Router, type IRouter } from "express";
import { db, sosAlertsTable, emergencyContactsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireRole, type AuthedRequest } from "../lib/auth";
import { sendWhatsAppMessage } from "../lib/whatsapp";

const router: IRouter = Router();

const createSchema = z.object({
  user_id: z.string().min(1).optional(),
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

const contactSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z
    .string()
    .trim()
    .min(8)
    .max(20)
    .regex(/^\+?[0-9()\-\s]+$/, "Invalid phone number"),
});

function serializeContact(row: typeof emergencyContactsTable.$inferSelect) {
  return {
    id: String(row.id),
    user_id: String(row.userId),
    name: row.name,
    phone: row.phone,
    created_at: row.createdAt.toISOString(),
  };
}

function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  }
  return `+${trimmed.replace(/\D/g, "")}`;
}

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

router.get("/sos", requireAuth, requireRole("police", "admin", "super_admin"), async (_req, res) => {
  const rows = await db.select().from(sosAlertsTable).orderBy(desc(sosAlertsTable.createdAt));
  res.json(rows.map(serialize));
});

router.post("/sos", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", errors: parsed.error.issues });
  }
  const { latitude, longitude } = parsed.data;
  const user = req.user!;
  const userId = String(user.id);
  const userName = parsed.data.user_name ?? user.name;
  const [row] = await db
    .insert(sosAlertsTable)
    .values({
      userId,
      userName,
      latitude,
      longitude,
      currentLatitude: latitude,
      currentLongitude: longitude,
      locationUpdatedAt: new Date(),
    })
    .returning();

  // Notify citizen emergency contacts on WhatsApp (best-effort, non-blocking for SOS creation)
  let whatsappNotificationsSent = 0;
  const contacts = await db
    .select()
    .from(emergencyContactsTable)
    .where(eq(emergencyContactsTable.userId, user.id));

  if (contacts.length > 0) {
    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    const message = [
      "LIVE SAFE SOS ALERT",
      `${userName} triggered an emergency SOS.`,
      `Live location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
      `Map: ${mapsLink}`,
      "Please contact them immediately.",
    ].join("\n");

    await Promise.all(
      contacts.map(async (contact) => {
        try {
          await sendWhatsAppMessage(contact.phone, message);
          whatsappNotificationsSent += 1;
        } catch {
          // Keep SOS flow resilient even if WhatsApp provider has transient issues.
        }
      }),
    );
  }

  res.status(201).json({
    ...serialize(row),
    whatsapp_notifications_sent: whatsappNotificationsSent,
  });
});

router.post("/sos/:id/location", requireAuth, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  const parsed = locationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload" });
  }
  const [existing] = await db.select().from(sosAlertsTable).where(eq(sosAlertsTable.id, id));
  if (!existing) return res.status(404).json({ message: "Not found" });
  const user = req.user!;
  const canUpdate =
    existing.userId === String(user.id) ||
    user.role === "police" ||
    user.role === "admin";
  if (!canUpdate) return res.status(403).json({ message: "Forbidden" });
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

router.patch("/sos/:id/acknowledge", requireAuth, requireRole("police", "admin"), async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  const parsed = ackSchema.safeParse(req.body ?? {});
  const officer = parsed.success ? parsed.data.officer : undefined;
  const [row] = await db
    .update(sosAlertsTable)
    .set({
      status: "acknowledged",
      assignedOfficer: officer ?? req.user!.name,
      acknowledgedAt: new Date(),
    })
    .where(eq(sosAlertsTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ message: "Not found" });
  res.json(serialize(row));
});

router.patch("/sos/:id/resolve", requireAuth, requireRole("police", "admin"), async (req, res) => {
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

router.get("/sos/contacts", requireAuth, requireRole("citizen"), async (req: AuthedRequest, res) => {
  const user = req.user!;
  const rows = await db
    .select()
    .from(emergencyContactsTable)
    .where(eq(emergencyContactsTable.userId, user.id))
    .orderBy(desc(emergencyContactsTable.createdAt));
  res.json(rows.map(serializeContact));
});

router.post("/sos/contacts", requireAuth, requireRole("citizen"), async (req: AuthedRequest, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", errors: parsed.error.issues });
  }
  const user = req.user!;
  const normalizedPhone = normalizePhone(parsed.data.phone);

  const [existing] = await db
    .select()
    .from(emergencyContactsTable)
    .where(
      and(
        eq(emergencyContactsTable.userId, user.id),
        eq(emergencyContactsTable.phone, normalizedPhone),
      ),
    );
  if (existing) {
    return res.status(409).json({ message: "This contact number is already added." });
  }

  const [row] = await db
    .insert(emergencyContactsTable)
    .values({
      userId: user.id,
      name: parsed.data.name,
      phone: normalizedPhone,
    })
    .returning();
  res.status(201).json(serializeContact(row));
});

router.delete(
  "/sos/contacts/:id",
  requireAuth,
  requireRole("citizen"),
  async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const user = req.user!;
    const [row] = await db
      .delete(emergencyContactsTable)
      .where(and(eq(emergencyContactsTable.id, id), eq(emergencyContactsTable.userId, user.id)))
      .returning();
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted" });
  },
);

export default router;
