import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "@workspace/db";
import { sessionsTable } from "../../../../lib/db/src/schema/sessions";
import { usersTable } from "../../../../lib/db/src/schema/users";
import { eq, and, gt } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.insert(sessionsTable).values({ token, userId, expiresAt });
  return token;
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
}

export async function getUserFromToken(token: string) {
  const now = new Date();
  const [row] = await db
    .select({ user: usersTable })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(usersTable.id, sessionsTable.userId))
    .where(and(eq(sessionsTable.token, token), gt(sessionsTable.expiresAt, now)));
  return row?.user ?? null;
}

export interface AuthedRequest extends Request {
  user?: typeof usersTable.$inferSelect;
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = auth.slice(7);
  const user = await getUserFromToken(token);
  if (!user) {
    return res.status(401).json({ message: "Invalid or expired session" });
  }
  req.user = user;
  next();
}

export function requireRole(...roles: Array<"citizen" | "police" | "admin" | "super_admin">) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

export function serializeUser(user: typeof usersTable.$inferSelect) {
  return {
    id: String(user.id),
    email: user.email,
    name: user.name,
    role: user.role,
    phone: user.phone ?? undefined,
    badge_number: user.badgeNumber ?? undefined,
    is_active: user.isActive,
    is_approved: user.isApproved,
    created_at: user.createdAt.toISOString(),
  };
}
