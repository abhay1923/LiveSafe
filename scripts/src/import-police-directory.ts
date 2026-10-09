// Loads the bundled police directory CSVs into police_stations and police_coverage.
// Safe to re-run: rows are upserted on (state, police_station).
//   pnpm --filter @workspace/scripts import-police-directory
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { db, policeStationsTable, policeCoverageTable } from "@workspace/db";

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data/police-directory");

// Minimal RFC 4180 parser: handles quoted fields, embedded commas, CRLF, BOM.
function parseCsv(text: string): Record<string, string>[] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.some((v) => v.trim() !== ""));
  return body.map((r) => Object.fromEntries(header.map((h, idx) => [h.trim(), (r[idx] ?? "").trim()])));
}

const orNull = (v: string | undefined) => (v && v.trim() !== "" ? v.trim() : null);

async function main() {
  const stations = parseCsv(readFileSync(path.join(DIR, "police_station_contacts_partial.csv"), "utf-8"));
  let upserted = 0;
  for (const r of stations) {
    if (!r.state_ut || !r.police_station) continue;
    await db
      .insert(policeStationsTable)
      .values({
        state: r.state_ut,
        policeDistrict: r.police_district,
        policeStation: r.police_station,
        landline: orNull(r.landline),
        mobile: orNull(r.mobile),
        officialEmail: orNull(r.official_email),
        stationAddress: orNull(r.station_address),
        sourceUrl: r.source_url,
        verificationDate: r.verification_date,
        verificationStatus: r.verification_status,
        notes: orNull(r.notes),
      })
      .onConflictDoUpdate({
        target: [policeStationsTable.state, policeStationsTable.policeStation],
        set: {
          policeDistrict: r.police_district,
          landline: orNull(r.landline),
          mobile: orNull(r.mobile),
          officialEmail: orNull(r.official_email),
          stationAddress: orNull(r.station_address),
          sourceUrl: r.source_url,
          verificationDate: r.verification_date,
          verificationStatus: r.verification_status,
          notes: orNull(r.notes),
        },
      });
    upserted++;
  }

  const coverage = parseCsv(readFileSync(path.join(DIR, "state_ut_coverage_tracker.csv"), "utf-8"));
  for (const r of coverage) {
    if (!r.state_ut) continue;
    await db
      .insert(policeCoverageTable)
      .values({
        state: r.state_ut,
        officialPortal: r.official_police_portal,
        coverageStatus: r.coverage_status,
        notes: orNull(r.notes),
        lastChecked: r.last_checked_date,
      })
      .onConflictDoUpdate({
        target: policeCoverageTable.state,
        set: {
          officialPortal: r.official_police_portal,
          coverageStatus: r.coverage_status,
          notes: orNull(r.notes),
          lastChecked: r.last_checked_date,
        },
      });
  }

  console.log(`Imported ${upserted} station records and ${coverage.length} State/UT coverage rows.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
