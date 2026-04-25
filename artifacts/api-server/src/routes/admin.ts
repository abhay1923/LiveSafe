import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { accessRequestsTable } from "../../../../lib/db/src/schema/access_requests";
import { usersTable } from "../../../../lib/db/src/schema/users";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireRole, type AuthedRequest } from "../lib/auth";

const router: IRouter = Router();

router.use("/admin", requireAuth, requireRole("super_admin"));

function serializeRequest(row: typeof accessRequestsTable.$inferSelect) {
  return {
    id: String(row.id),
    email: row.email,
    name: row.name,
    requested_role: row.requestedRole,
    badge_number: row.badgeNumber ?? undefined,
    phone: row.phone ?? undefined,
    reason: row.reason ?? undefined,
    status: row.status,
    reviewed_by: row.reviewedBy ?? undefined,
    reviewed_at: row.reviewedAt?.toISOString(),
    rejection_reason: row.rejectionReason ?? undefined,
    created_at: row.createdAt.toISOString(),
  };
}

router.get("/admin/access-requests", async (_req, res) => {
  const rows = await db
    .select()
    .from(accessRequestsTable)
    .orderBy(desc(accessRequestsTable.createdAt));
  res.json(rows.map(serializeRequest));
});

router.post("/admin/access-requests/:id/approve", async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  const [request] = await db.select().from(accessRequestsTable).where(eq(accessRequestsTable.id, id));
  if (!request) return res.status(404).json({ message: "Not found" });
  if (request.status !== "pending") {
    return res.status(400).json({ message: `Request is already ${request.status}` });
  }
  const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.email, request.email));
  if (existingUser) {
    return res.status(409).json({ message: "A user with that email already exists." });
  }
  await db.insert(usersTable).values({
    email: request.email,
    name: request.name,
    passwordHash: request.passwordHash,
    role: request.requestedRole,
    badgeNumber: request.badgeNumber,
    phone: request.phone,
    isApproved: true,
    isActive: true,
  });
  await db
    .update(accessRequestsTable)
    .set({
      status: "approved",
      reviewedBy: req.user!.id,
      reviewedAt: new Date(),
    })
    .where(eq(accessRequestsTable.id, id));
  res.json({ message: "Request approved and user account created." });
});

const rejectSchema = z.object({ reason: z.string().optional() });

router.post("/admin/access-requests/:id/reject", async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  const parsed = rejectSchema.safeParse(req.body ?? {});
  const reason = parsed.success ? parsed.data.reason : undefined;
  const [request] = await db.select().from(accessRequestsTable).where(eq(accessRequestsTable.id, id));
  if (!request) return res.status(404).json({ message: "Not found" });
  if (request.status !== "pending") {
    return res.status(400).json({ message: `Request is already ${request.status}` });
  }
  await db
    .update(accessRequestsTable)
    .set({
      status: "rejected",
      reviewedBy: req.user!.id,
      reviewedAt: new Date(),
      rejectionReason: reason,
    })
    .where(eq(accessRequestsTable.id, id));
  res.json({ message: "Request rejected." });
});

export default router;
