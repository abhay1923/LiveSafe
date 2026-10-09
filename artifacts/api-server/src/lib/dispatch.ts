import { db, hotspotsTable, policeStationsTable, policeCoverageTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// Beyond this distance from the nearest geocoded district, the SOS is treated
// as outside the area the directory can route for, and no station is suggested.
export const MAX_ROUTING_DISTANCE_KM = 50;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

// Compare names loosely: "Faridabad", "faridabad " and "Faridabad District" match.
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(district|city|rural|urban|commissionerate|commissionarate)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type RoutingStatus =
  | "routed"
  | "outside_coverage"
  | "district_not_in_directory"
  | "state_not_compiled";

export interface RoutingResult {
  status: RoutingStatus;
  nearest_district: { district: string; state: string; distance_km: number } | null;
  coverage: { state: string; official_portal: string; coverage_status: string; notes: string | null } | null;
  stations: Array<{
    id: number;
    state: string;
    police_district: string;
    police_station: string;
    landline: string | null;
    mobile: string | null;
    official_email: string | null;
    station_address: string | null;
    source_url: string;
    verification_status: string;
    notes: string | null;
  }>;
  message: string;
}

export async function routeSos(lat: number, lon: number): Promise<RoutingResult> {
  const districts = await db
    .select({ district: hotspotsTable.district, state: hotspotsTable.state, latitude: hotspotsTable.latitude, longitude: hotspotsTable.longitude })
    .from(hotspotsTable);

  if (districts.length === 0) {
    return {
      status: "outside_coverage",
      nearest_district: null,
      coverage: null,
      stations: [],
      message: "No mapped districts are loaded, so the SOS cannot be routed. Load the NCRB hotspots first.",
    };
  }

  let best = districts[0];
  let bestDistance = haversineKm(lat, lon, best.latitude, best.longitude);
  for (const d of districts.slice(1)) {
    const km = haversineKm(lat, lon, d.latitude, d.longitude);
    if (km < bestDistance) { best = d; bestDistance = km; }
  }
  const nearest = {
    district: best.district,
    state: best.state,
    distance_km: Math.round(bestDistance * 10) / 10,
  };

  if (bestDistance > MAX_ROUTING_DISTANCE_KM) {
    return {
      status: "outside_coverage",
      nearest_district: nearest,
      coverage: null,
      stations: [],
      message: `The SOS is ${nearest.distance_km} km from the nearest mapped district (${nearest.district}, ${nearest.state}). That is beyond the ${MAX_ROUTING_DISTANCE_KM} km routing limit, so no station is suggested. Use 112 and the state portal.`,
    };
  }

  // Stations for the matched State/UT. The directory is partial, so a State
  // with no station rows is reported as not compiled, not as "no police".
  const stateKey = normalizeName(best.state);
  const allInState = (await db.select().from(policeStationsTable)).filter(
    (s) => normalizeName(s.state) === stateKey,
  );
  const coverageRows = await db.select().from(policeCoverageTable);
  const coverageRow = coverageRows.find((c) => normalizeName(c.state) === stateKey) ?? null;
  const coverage = coverageRow
    ? {
        state: coverageRow.state,
        official_portal: coverageRow.officialPortal,
        coverage_status: coverageRow.coverageStatus,
        notes: coverageRow.notes,
      }
    : null;

  if (allInState.length === 0) {
    return {
      status: "state_not_compiled",
      nearest_district: nearest,
      coverage,
      stations: [],
      message: `Station contacts for ${best.state} have not been compiled yet. Use the official state police portal${coverage ? ` (${coverage.official_portal})` : ""} and 112.`,
    };
  }

  const districtKey = normalizeName(best.district);
  const stations = allInState.filter((s) => normalizeName(s.policeDistrict) === districtKey);
  const shaped = stations.map((s) => ({
    id: s.id,
    state: s.state,
    police_district: s.policeDistrict,
    police_station: s.policeStation,
    landline: s.landline,
    mobile: s.mobile,
    official_email: s.officialEmail,
    station_address: s.stationAddress,
    source_url: s.sourceUrl,
    verification_status: s.verificationStatus,
    notes: s.notes,
  }));

  if (shaped.length === 0) {
    return {
      status: "district_not_in_directory",
      nearest_district: nearest,
      coverage,
      stations: [],
      message: `${best.district} district is not in the compiled directory for ${best.state}. Use the official state police portal${coverage ? ` (${coverage.official_portal})` : ""} and 112.`,
    };
  }

  return {
    status: "routed",
    nearest_district: nearest,
    coverage,
    stations: shaped,
    message: `Nearest mapped district is ${nearest.district}, ${nearest.state}, ${nearest.distance_km} km away. Stations below are the compiled contacts for that police district. Station coordinates are not in the directory, so they are not ranked by distance. Confirm the closest station on the map before calling.`,
  };
}

export async function getStation(id: number) {
  const [row] = await db.select().from(policeStationsTable).where(eq(policeStationsTable.id, id));
  return row ?? null;
}
