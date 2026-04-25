import { Router, type IRouter, type Response } from "express";
import { db } from "@workspace/db";
import { emergencyContactsTable } from "../../../../lib/db/src/schema/emergency_contacts";
import { sosAlertsTable } from "../../../../lib/db/src/schema/sos_alerts";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireRole, type AuthedRequest } from "../lib/auth";
import { sendWhatsAppMessage } from "../lib/whatsapp";

const router: IRouter = Router();

const trailPointSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  recorded_at: z.string().datetime(),
});

const eventSchema = z.object({
  id: z.string(),
  type: z.string(),
  detail: z.string(),
  created_at: z.string().datetime(),
});

const responderSchema = z.object({
  id: z.string(),
  label: z.string(),
  role: z.enum(["police", "family", "volunteer", "hospital"]),
  status: z.enum(["queued", "notified", "accepted", "en_route", "standby"]),
  eta_minutes: z.number().optional(),
});

const evidenceItemSchema = z.object({
  id: z.string(),
  type: z.enum(["audio", "video"]),
  label: z.string(),
  captured_at: z.string().datetime(),
  review_status: z.enum(["new", "flagged", "reviewed"]),
});

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

const syncSchema = z.object({
  escalated: z.boolean().optional(),
  safety_mode: z.enum(["everyday", "night", "women", "student"]).optional(),
  last_checkin_at: z.string().datetime().optional(),
  notified_targets: z.array(z.string()).optional(),
  evidence_count: z.number().int().min(0).optional(),
  whatsapp_notifications_sent: z.number().int().min(0).optional(),
  responder_status: z.array(responderSchema).optional(),
  evidence_items: z.array(evidenceItemSchema).optional(),
  trail: z.array(trailPointSchema).optional(),
  event: z
    .object({
      type: z.string(),
      detail: z.string(),
    })
    .optional(),
});

const responderUpdateSchema = z.object({
  status: z.enum(["queued", "notified", "accepted", "en_route", "standby"]),
});

const evidenceReviewSchema = z.object({
  review_status: z.enum(["new", "flagged", "reviewed"]),
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

function withEvent(
  row: typeof sosAlertsTable.$inferSelect,
  type: string,
  detail: string,
) {
  return [
    ...(row.events ?? []),
    {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      detail,
      created_at: new Date().toISOString(),
    },
  ].slice(-24);
}

function buildDefaultResponderStatus(hasFamilyContacts: boolean) {
  const base: NonNullable<typeof sosAlertsTable.$inferSelect["responderStatus"]> = [
    { id: "rsp-police", label: "Police dispatch", role: "police" as const, status: "notified" as const, eta_minutes: 6 },
    { id: "rsp-volunteer", label: "Verified volunteers", role: "volunteer" as const, status: "queued" as const, eta_minutes: 8 },
    { id: "rsp-hospital", label: "Hospital standby", role: "hospital" as const, status: "standby" as const, eta_minutes: 10 },
  ];
  if (hasFamilyContacts) {
    base.splice(1, 0, {
      id: "rsp-family",
      label: "Family contacts",
      role: "family" as const,
      status: "notified" as const,
    });
  }
  return base;
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
    trail: row.trail ?? [],
    events: row.events ?? [],
    responder_status: row.responderStatus ?? [],
    evidence_items: row.evidenceItems ?? [],
    status: row.status,
    assigned_officer: row.assignedOfficer ?? undefined,
    response_time: row.responseTimeSeconds ?? undefined,
    whatsapp_notifications_sent: row.whatsappNotificationsSent ?? 0,
    escalated: row.escalated,
    safety_mode: row.safetyMode ?? undefined,
    last_checkin_at: row.lastCheckinAt?.toISOString(),
    notified_targets: row.notifiedTargets ?? [],
    evidence_count: row.evidenceCount ?? 0,
    acknowledged_at: row.acknowledgedAt?.toISOString(),
    resolved_at: row.resolvedAt?.toISOString(),
    created_at: row.createdAt.toISOString(),
  };
}

async function getAlertOr404(id: number, res: Response) {
  const [row] = await db.select().from(sosAlertsTable).where(eq(sosAlertsTable.id, id));
  if (!row) {
    res.status(404).json({ message: "SOS alert not found" });
    return null;
  }
  return row;
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
  const numericUserId = Number(user_id);
  const hasNumericUserId = !Number.isNaN(numericUserId);
  const contacts = hasNumericUserId
    ? await db
        .select()
        .from(emergencyContactsTable)
        .where(eq(emergencyContactsTable.userId, numericUserId))
    : [];

  let whatsappNotificationsSent = 0;
  if (contacts.length > 0) {
    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    const message = [
      "LIVE SAFE SOS ALERT",
      `${user_name ?? "A citizen"} triggered an emergency SOS.`,
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
          // Keep SOS creation resilient even if outbound messaging has a transient failure.
        }
      }),
    );
  }

  const createdAt = new Date();
  const createdIso = createdAt.toISOString();
  const responderStatus = buildDefaultResponderStatus(contacts.length > 0);
  const notifiedTargets = responderStatus.map((item: NonNullable<typeof sosAlertsTable.$inferSelect["responderStatus"]>[number]) => item.label);

  const [row] = await db
    .insert(sosAlertsTable)
    .values({
      userId: user_id,
      userName: user_name,
      latitude,
      longitude,
      currentLatitude: latitude,
      currentLongitude: longitude,
      locationUpdatedAt: createdAt,
      trail: [{ latitude, longitude, recorded_at: createdIso }],
      events: [
        {
          id: `evt-${Date.now()}-created`,
          type: "created",
          detail: "Citizen activated SOS and shared live location.",
          created_at: createdIso,
        },
        {
          id: `evt-${Date.now()}-dispatch`,
          type: "network_dispatch",
          detail: `SOS routed to ${notifiedTargets.join(", ")}.`,
          created_at: createdIso,
        },
      ],
      responderStatus,
      whatsappNotificationsSent,
      notifiedTargets,
      evidenceCount: 0,
      escalated: false,
    })
    .returning();

  res.status(201).json(serialize(row));
});

router.post("/sos/:id/location", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  const parsed = locationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", errors: parsed.error.issues });
  }

  const existing = await getAlertOr404(id, res);
  if (!existing) return;

  const now = new Date();
  const updatedTrail = [
    ...(existing.trail ?? []),
    {
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      recorded_at: now.toISOString(),
    },
  ].slice(-20);

  const [row] = await db
    .update(sosAlertsTable)
    .set({
      currentLatitude: parsed.data.latitude,
      currentLongitude: parsed.data.longitude,
      locationUpdatedAt: now,
      trail: updatedTrail,
    })
    .where(eq(sosAlertsTable.id, id))
    .returning();

  res.json(serialize(row));
});

router.patch("/sos/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  const parsed = syncSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", errors: parsed.error.issues });
  }

  const existing = await getAlertOr404(id, res);
  if (!existing) return;

  const patch = parsed.data;
  const [row] = await db
    .update(sosAlertsTable)
    .set({
      escalated: patch.escalated ?? existing.escalated,
      safetyMode: patch.safety_mode ?? existing.safetyMode,
      lastCheckinAt: patch.last_checkin_at ? new Date(patch.last_checkin_at) : existing.lastCheckinAt,
      notifiedTargets: patch.notified_targets ?? existing.notifiedTargets,
      evidenceCount: patch.evidence_count ?? existing.evidenceCount,
      whatsappNotificationsSent:
        patch.whatsapp_notifications_sent ?? existing.whatsappNotificationsSent,
      responderStatus: patch.responder_status ?? existing.responderStatus,
      evidenceItems: patch.evidence_items ?? existing.evidenceItems,
      trail: patch.trail ?? existing.trail,
      events: patch.event
        ? withEvent(existing, patch.event.type, patch.event.detail)
        : existing.events,
    })
    .where(eq(sosAlertsTable.id, id))
    .returning();

  res.json(serialize(row));
});

router.patch("/sos/:id/responders/:responderId", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  const parsed = responderUpdateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", errors: parsed.error.issues });
  }

  const existing = await getAlertOr404(id, res);
  if (!existing) return;

  const responder = (existing.responderStatus ?? []).find(
    (item: NonNullable<typeof sosAlertsTable.$inferSelect["responderStatus"]>[number]) => item.id === req.params.responderId,
  );
  if (!responder) {
    return res.status(404).json({ message: "Responder not found" });
  }

  const [row] = await db
    .update(sosAlertsTable)
    .set({
      responderStatus: (existing.responderStatus ?? []).map((item: NonNullable<typeof sosAlertsTable.$inferSelect["responderStatus"]>[number]) =>
        item.id === responder.id ? { ...item, status: parsed.data.status } : item,
      ),
      events: withEvent(
        existing,
        "responder_update",
        `${responder.label} marked as ${parsed.data.status.replace("_", " ")}.`,
      ),
    })
    .where(eq(sosAlertsTable.id, id))
    .returning();

  res.json(serialize(row));
});

router.patch("/sos/:id/evidence/:evidenceId", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  const parsed = evidenceReviewSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", errors: parsed.error.issues });
  }

  const existing = await getAlertOr404(id, res);
  if (!existing) return;

  const evidence = (existing.evidenceItems ?? []).find(
    (item: NonNullable<typeof sosAlertsTable.$inferSelect["evidenceItems"]>[number]) => item.id === req.params.evidenceId,
  );
  if (!evidence) {
    return res.status(404).json({ message: "Evidence item not found" });
  }

  const [row] = await db
    .update(sosAlertsTable)
    .set({
      evidenceItems: (existing.evidenceItems ?? []).map((item: NonNullable<typeof sosAlertsTable.$inferSelect["evidenceItems"]>[number]) =>
        item.id === evidence.id
          ? { ...item, review_status: parsed.data.review_status }
          : item,
      ),
      events: withEvent(
        existing,
        "evidence_review",
        `${evidence.label} marked as ${parsed.data.review_status}.`,
      ),
    })
    .where(eq(sosAlertsTable.id, id))
    .returning();

  res.json(serialize(row));
});

router.patch("/sos/:id/acknowledge", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  const parsed = ackSchema.safeParse(req.body ?? {});
  const officer = parsed.success ? parsed.data.officer : undefined;
  const existing = await getAlertOr404(id, res);
  if (!existing) return;

  const now = new Date();
  const [row] = await db
    .update(sosAlertsTable)
    .set({
      status: "acknowledged",
      assignedOfficer: officer ?? "Officer on duty",
      acknowledgedAt: now,
      responderStatus: (existing.responderStatus ?? []).map((item: NonNullable<typeof sosAlertsTable.$inferSelect["responderStatus"]>[number]) =>
        item.role === "police"
          ? { ...item, status: "en_route", eta_minutes: Math.max(3, item.eta_minutes ?? 6) }
          : item,
      ),
      events: withEvent(
        existing,
        "acknowledged",
        `${officer ?? "Duty officer"} acknowledged the alert and is attending.`,
      ),
    })
    .where(eq(sosAlertsTable.id, id))
    .returning();

  res.json(serialize(row));
});

router.patch("/sos/:id/resolve", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  const existing = await getAlertOr404(id, res);
  if (!existing) return;

  const responseTimeSeconds = Math.round((Date.now() - existing.createdAt.getTime()) / 1000);
  const [row] = await db
    .update(sosAlertsTable)
    .set({
      status: "resolved",
      resolvedAt: new Date(),
      responseTimeSeconds,
      events: withEvent(
        existing,
        "resolved",
        "Alert closed after field response and citizen safety confirmation.",
      ),
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
