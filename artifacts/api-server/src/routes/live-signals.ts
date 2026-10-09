import { Router, type IRouter, type Response } from "express";
import crypto from "node:crypto";
import { db, hotspotsTable, liveSignalsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireAuth, requireRole, type AuthedRequest } from "../lib/auth";

const router: IRouter = Router();

const TINYFISH_SEARCH_URL = "https://api.search.tinyfish.ai/";
const DISTRICTS_PER_REFRESH = 10;
const REQUEST_TIMEOUT_MS = 15000;

interface SearchResultItem {
  title?: string;
  url?: string;
  link?: string;
  snippet?: string;
  description?: string;
  content?: string;
}

// Accepts the common result-array shapes. The exact TinyFish Search response
// schema must be confirmed on the first live run; any item without an
// http(s) URL is ignored, so unexpected fields cannot write bad rows.
function extractResults(body: unknown): SearchResultItem[] {
  if (Array.isArray(body)) return body as SearchResultItem[];
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    for (const key of ["results", "data", "items"]) {
      if (Array.isArray(b[key])) return b[key] as SearchResultItem[];
    }
  }
  return [];
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function searchDistrict(apiKey: string, query: string): Promise<SearchResultItem[]> {
  const url = `${TINYFISH_SEARCH_URL}?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { "X-API-Key": apiKey },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`TinyFish Search responded ${res.status}`);
  return extractResults(await res.json());
}

function requireReviewer() {
  return requireRole("police", "admin", "super_admin");
}

// Read: police, admins and super admins see signals and their review state.
router.get("/live-signals", requireAuth, requireReviewer(), async (req: AuthedRequest, res: Response) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const allowed = ["pending", "verified", "rejected"];
  const where = status && allowed.includes(status)
    ? eq(liveSignalsTable.verificationStatus, status as "pending" | "verified" | "rejected")
    : undefined;

  const rows = await db
    .select()
    .from(liveSignalsTable)
    .where(where)
    .orderBy(desc(liveSignalsTable.retrievedAt))
    .limit(200);

  res.json(rows.map((r) => ({
    id: String(r.id),
    district: r.district,
    state: r.state,
    title: r.title,
    snippet: r.snippet,
    source_url: r.sourceUrl,
    source_domain: r.sourceDomain,
    provider: r.provider,
    verification_status: r.verificationStatus,
    verified_by: r.verifiedBy,
    verified_at: r.verifiedAt?.toISOString() ?? null,
    retrieved_at: r.retrievedAt.toISOString(),
  })));
});

// Discover: admin-only. Queries TinyFish for the highest-risk mapped districts.
// Refuses to run without TINYFISH_API_KEY, so nothing is ever invented.
router.post("/live-signals/refresh", requireAuth, requireRole("admin", "super_admin"), async (_req: AuthedRequest, res: Response) => {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      message: "TinyFish is not configured. Set TINYFISH_API_KEY on the API server to enable live signals.",
    });
  }

  const targets = await db
    .select({ district: hotspotsTable.district, state: hotspotsTable.state })
    .from(hotspotsTable)
    .orderBy(desc(hotspotsTable.riskScore))
    .limit(DISTRICTS_PER_REFRESH);

  let added = 0;
  const errors: Array<{ district: string; error: string }> = [];

  for (const target of targets) {
    const district = target.district;
    const state = target.state.split(",").pop()?.trim() ?? target.state;
    try {
      const results = await searchDistrict(apiKey, `${district} ${state} police advisory crime`);
      let rank = 0;
      for (const item of results) {
        const sourceUrl = item.url ?? item.link ?? "";
        if (!/^https?:\/\//i.test(sourceUrl)) continue;
        const title = (item.title ?? "").trim();
        if (!title) continue;
        rank += 1;
        const externalKey = crypto.createHash("sha256").update(`${district}|${sourceUrl}`).digest("hex");
        const inserted = await db
          .insert(liveSignalsTable)
          .values({
            externalKey,
            district,
            state,
            title: title.slice(0, 500),
            snippet: (item.snippet ?? item.description ?? item.content ?? "").slice(0, 1000) || null,
            sourceUrl,
            sourceDomain: domainOf(sourceUrl),
            rankPosition: rank,
          })
          .onConflictDoNothing({ target: liveSignalsTable.externalKey })
          .returning({ id: liveSignalsTable.id });
        if (inserted.length > 0) added += 1;
      }
    } catch (err) {
      errors.push({ district, error: err instanceof Error ? err.message : "unknown error" });
    }
  }

  res.json({
    districts_queried: targets.length,
    signals_added: added,
    errors,
  });
});

// Review: police, admins and super admins confirm or reject a signal. Only
// verified signals are presented as verified; pending signals are never
// used to change a risk score.
router.patch("/live-signals/:id/review", requireAuth, requireReviewer(), async (req: AuthedRequest, res: Response) => {
  const id = Number(req.params.id);
  const decision = req.body?.decision;
  if (!Number.isInteger(id) || (decision !== "verified" && decision !== "rejected")) {
    return res.status(400).json({ message: "Provide a numeric id and decision of 'verified' or 'rejected'." });
  }
  const [updated] = await db
    .update(liveSignalsTable)
    .set({
      verificationStatus: decision,
      verifiedBy: req.user!.name,
      verifiedAt: new Date(),
    })
    .where(eq(liveSignalsTable.id, id))
    .returning({ id: liveSignalsTable.id });
  if (!updated) return res.status(404).json({ message: "Signal not found" });
  res.json({ id: String(updated.id), verification_status: decision });
});

export default router;
