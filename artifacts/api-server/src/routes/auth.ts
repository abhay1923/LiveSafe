import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { accessRequestsTable } from "../../../../lib/db/src/schema/access_requests";
import { usersTable } from "../../../../lib/db/src/schema/users";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  hashPassword,
  verifyPassword,
  createSession,
  deleteSession,
  requireAuth,
  serializeUser,
  type AuthedRequest,
} from "../lib/auth";

const router: IRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const signupCitizenSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  phone: z.string().optional(),
});

const requestAccessSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  requestedRole: z.enum(["police", "admin"]),
  badgeNumber: z.string().optional(),
  phone: z.string().optional(),
  reason: z.string().optional(),
});

router.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid email or password format" });
  }
  const email = parsed.data.email.trim().toLowerCase();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    // Check if there's a pending access request to give a helpful message
    const [pending] = await db
      .select()
      .from(accessRequestsTable)
      .where(eq(accessRequestsTable.email, email));
    if (pending && pending.status === "pending") {
      return res.status(403).json({
        message: "Your access request is still pending review by the super admin.",
      });
    }
    if (pending && pending.status === "rejected") {
      return res.status(403).json({
        message: `Your access request was rejected.${pending.rejectionReason ? " Reason: " + pending.rejectionReason : ""}`,
      });
    }
    return res.status(401).json({ message: "Invalid email or password" });
  }
  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ message: "Invalid email or password" });
  }
  if (!user.isApproved) {
    return res.status(403).json({ message: "Your account is not approved yet." });
  }
  if (!user.isActive) {
    return res.status(403).json({ message: "Your account is disabled." });
  }
  const token = await createSession(user.id);
  res.json({ user: serializeUser(user), token });
});

router.post("/auth/signup-citizen", async (req, res) => {
  const parsed = signupCitizenSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
  }
  const email = parsed.data.email.trim().toLowerCase();
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    return res.status(409).json({ message: "An account with that email already exists." });
  }
  const passwordHash = await hashPassword(parsed.data.password);
  const [user] = await db
    .insert(usersTable)
    .values({
      email,
      name: parsed.data.name.trim(),
      passwordHash,
      role: "citizen",
      phone: parsed.data.phone,
      isApproved: true,
      isActive: true,
    })
    .returning();
  const token = await createSession(user.id);
  res.status(201).json({ user: serializeUser(user), token });
});

router.post("/auth/request-access", async (req, res) => {
  const parsed = requestAccessSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
  }
  const email = parsed.data.email.trim().toLowerCase();
  const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existingUser) {
    return res.status(409).json({ message: "An account with that email already exists." });
  }
  const [existingRequest] = await db
    .select()
    .from(accessRequestsTable)
    .where(eq(accessRequestsTable.email, email));
  if (existingRequest && existingRequest.status === "pending") {
    return res.status(409).json({ message: "An access request for that email is already pending." });
  }
  const passwordHash = await hashPassword(parsed.data.password);
  if (existingRequest) {
    // Allow re-applying after rejection
    await db
      .update(accessRequestsTable)
      .set({
        name: parsed.data.name.trim(),
        passwordHash,
        requestedRole: parsed.data.requestedRole,
        badgeNumber: parsed.data.badgeNumber,
        phone: parsed.data.phone,
        reason: parsed.data.reason,
        status: "pending",
        reviewedAt: null,
        reviewedBy: null,
        rejectionReason: null,
      })
      .where(eq(accessRequestsTable.id, existingRequest.id));
  } else {
    await db.insert(accessRequestsTable).values({
      email,
      name: parsed.data.name.trim(),
      passwordHash,
      requestedRole: parsed.data.requestedRole,
      badgeNumber: parsed.data.badgeNumber,
      phone: parsed.data.phone,
      reason: parsed.data.reason,
    });
  }
  res.status(201).json({
    message: "Your request has been submitted. The super admin will review it shortly.",
  });
});

router.post("/auth/logout", requireAuth, async (req: AuthedRequest, res) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    await deleteSession(auth.slice(7));
  }
  res.json({ message: "Logged out" });
});

router.get("/auth/me", requireAuth, (req: AuthedRequest, res) => {
  res.json({ user: serializeUser(req.user!) });
});

export default router;
