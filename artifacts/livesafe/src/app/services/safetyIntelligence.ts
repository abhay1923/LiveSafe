import type { Hotspot, Incident, RiskClassification, SOSAlert } from '@/types'

export interface SafetyHub {
  id: string
  name: string
  kind: 'police' | 'hospital' | 'transit'
  distanceKm: number
  etaMinutes: number
  note: string
}

export interface RouteOption {
  id: string
  label: string
  profile: 'safest' | 'balanced' | 'fastest'
  distanceKm: number
  etaMinutes: number
  exposureScore: number
  risk: RiskClassification
  summary: string
  checkpoints: string[]
}

export interface RiskOutlookPoint {
  label: string
  hour: number
  score: number
  risk: RiskClassification
  note: string
}

export interface OperationalZone {
  label: string
  priority: number
  risk: RiskClassification
  incidents: number
  activeAlerts: number
  recommendation: string
}

export interface DispatchRecommendation {
  title: string
  detail: string
  severity: 'high' | 'medium' | 'low'
}

export interface IncidentCluster {
  id: string
  label: string
  incidentCount: number
  hotspotPressure: number
  repeatLocationCount: number
  avgSeverityScore: number
}

export interface RepeatLocationInsight {
  label: string
  count: number
  dominantCrime: string
  recommendation: string
}

export interface ResponseSimulation {
  zone: string
  currentResponseMin: number
  projectedResponseMin: number
  improvementPct: number
  unitsMoved: number
  impact: string
}

export interface PatrolAllocation {
  zone: string
  unitsRecommended: number
  urgency: RiskClassification
  reason: string
}

export interface PatrolUnit {
  id: string
  callSign: string
  status: 'available' | 'assigned' | 'en_route' | 'staged'
  zone: string
  etaMinutes: number
  focus: string
}

export interface ExplainabilityPanel {
  confidenceLabel: string
  topDrivers: string[]
  crimeMix: Array<{ label: string; weight: number }>
  trend: string
  guidance: string
}

const EARTH_RADIUS_KM = 6371

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

export function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
) {
  const dLat = toRadians(b.lat - a.lat)
  const dLon = toRadians(b.lon - a.lon)
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

export function classifyRisk(score: number): RiskClassification {
  if (score >= 78) return 'critical'
  if (score >= 60) return 'high'
  if (score >= 38) return 'medium'
  return 'low'
}

function zoneLabel(hotspot?: Hotspot | null) {
  if (!hotspot?.state) return 'Current area'
  return hotspot.state
}

export function findNearestHotspot(
  hotspots: Hotspot[],
  location: { lat: number; lon: number }
) {
  let nearest: Hotspot | null = null
  let distanceKm = Number.POSITIVE_INFINITY

  for (const hotspot of hotspots) {
    const current = haversineKm(location, {
      lat: hotspot.latitude,
      lon: hotspot.longitude,
    })
    if (current < distanceKm) {
      nearest = hotspot
      distanceKm = current
    }
  }

  return { hotspot: nearest, distanceKm }
}

export function buildNearbySafetyHubs(
  hotspots: Hotspot[],
  location: { lat: number; lon: number }
): SafetyHub[] {
  const { hotspot, distanceKm } = findNearestHotspot(hotspots, location)
  const label = zoneLabel(hotspot)
  const baseDistance = Math.max(0.8, Math.min(distanceKm + 0.7, 6.4))

  return [
    {
      id: 'police',
      name: `Nearest police control room - ${label.split(',')[0]}`,
      kind: 'police',
      distanceKm: round(baseDistance),
      etaMinutes: Math.max(4, Math.round(baseDistance * 5)),
      note: 'Best option for official response and escort support.',
    },
    {
      id: 'hospital',
      name: `Emergency care hub - ${label.split(',')[0]}`,
      kind: 'hospital',
      distanceKm: round(baseDistance + 0.6),
      etaMinutes: Math.max(6, Math.round((baseDistance + 0.6) * 5)),
      note: 'Fastest medical fallback if injury or panic symptoms escalate.',
    },
    {
      id: 'transit',
      name: `Crowded transit point - ${label.split(',')[0]}`,
      kind: 'transit',
      distanceKm: round(Math.max(0.5, baseDistance - 0.2)),
      etaMinutes: Math.max(3, Math.round(Math.max(0.5, baseDistance - 0.2) * 4)),
      note: 'Useful if you need a bright, populated location quickly.',
    },
  ]
}

export function buildRouteOptions(
  hotspots: Hotspot[],
  location: { lat: number; lon: number }
): RouteOption[] {
  const { hotspot, distanceKm } = findNearestHotspot(hotspots, location)
  const label = zoneLabel(hotspot)
  const baseRisk = hotspot?.risk_score ?? 48
  const travelBase = Math.max(1.2, Math.min(distanceKm + 1.4, 8.5))

  return [
    {
      id: 'safest',
      label: 'Safest corridor',
      profile: 'safest',
      distanceKm: round(travelBase + 0.9),
      etaMinutes: Math.round((travelBase + 0.9) * 5.2),
      exposureScore: clampScore(baseRisk - 16),
      risk: classifyRisk(baseRisk - 16),
      summary: `Avoids the core ${label} risk cluster and favors busier roads with surveillance.`,
      checkpoints: [
        'Move toward a lit main road',
        'Pass through an active commercial stretch',
        'Finish at a police or medical hub',
      ],
    },
    {
      id: 'balanced',
      label: 'Balanced route',
      profile: 'balanced',
      distanceKm: round(travelBase + 0.3),
      etaMinutes: Math.round((travelBase + 0.3) * 4.8),
      exposureScore: clampScore(baseRisk - 7),
      risk: classifyRisk(baseRisk - 7),
      summary: `Keeps travel time practical while reducing exposure around ${label.split(',')[0]}.`,
      checkpoints: [
        'Use higher-footfall lanes',
        'Avoid isolated shortcuts',
        'Keep live location sharing active',
      ],
    },
    {
      id: 'fastest',
      label: 'Fastest exit',
      profile: 'fastest',
      distanceKm: round(travelBase),
      etaMinutes: Math.round(travelBase * 4.2),
      exposureScore: clampScore(baseRisk + 3),
      risk: classifyRisk(baseRisk + 3),
      summary: 'Shortest movement out of the current area when every minute matters.',
      checkpoints: [
        'Take the nearest direct road',
        'Call a trusted contact while moving',
        'Reach the first safe hub and stop there',
      ],
    },
  ]
}

export function buildRiskOutlook(
  baseScore: number,
  startingHour: number
): RiskOutlookPoint[] {
  const offsets = [0, 2, 4, 6]

  return offsets.map((offset) => {
    const hour = (startingHour + offset) % 24
    const nightBoost = hour >= 22 || hour < 4 ? 12 : hour >= 18 ? 7 : hour >= 6 && hour < 10 ? -4 : 0
    const score = clampScore(baseScore + nightBoost - offset)
    const risk = classifyRisk(score)

    return {
      label: offset === 0 ? 'Now' : `+${offset}h`,
      hour,
      score,
      risk,
      note:
        nightBoost >= 10
          ? 'Late-night exposure window'
          : nightBoost >= 5
            ? 'Evening movement risk'
            : nightBoost <= -3
              ? 'Lower daytime pressure'
              : 'Stable operating window',
    }
  })
}

export function buildTimeForecasts(baseScore: number, startingHour: number) {
  const tonightHour = startingHour >= 18 ? startingHour : 21
  const nextTwoHourScore = clampScore(baseScore + (startingHour >= 20 || startingHour < 4 ? 8 : 3))
  const tonightScore = clampScore(baseScore + (tonightHour >= 21 || tonightHour < 4 ? 11 : 6))
  const festivalBoost = [10, 11, 12].includes(new Date().getMonth() + 1) ? 14 : 9
  const festivalScore = clampScore(baseScore + festivalBoost)

  return [
    {
      label: 'Next 2 hours',
      hour: (startingHour + 2) % 24,
      score: nextTwoHourScore,
      risk: classifyRisk(nextTwoHourScore),
      note: 'Short-window mobility forecast',
    },
    {
      label: 'Tonight',
      hour: tonightHour % 24,
      score: tonightScore,
      risk: classifyRisk(tonightScore),
      note: 'Higher crowd churn and reduced guardianship',
    },
    {
      label: 'Festival day',
      hour: 20,
      score: festivalScore,
      risk: classifyRisk(festivalScore),
      note: 'Stress test for event-night pressure',
    },
  ]
}

export function buildExplainabilityPanel(
  riskScore: number,
  crimes: string[],
  confidence: number,
  nearestArea?: string
): ExplainabilityPanel {
  const crimeMix = crimes.slice(0, 4).map((crime, index) => ({
    label: crime.replace(/_/g, ' '),
    weight: Math.max(18, 42 - index * 8),
  }))
  const confidenceLabel =
    confidence >= 0.85 ? 'High confidence' : confidence >= 0.7 ? 'Good confidence' : 'Exploratory confidence'

  return {
    confidenceLabel,
    topDrivers: [
      nearestArea ? `Historical pattern near ${nearestArea}` : 'Historical area pattern',
      riskScore >= 70 ? 'Elevated severity pressure in comparable zones' : 'Moderate historical incident intensity',
      crimes.length > 0 ? `${crimes[0].replace(/_/g, ' ')} is the dominant projected crime type` : 'General mixed-crime profile',
    ],
    crimeMix,
    trend:
      riskScore >= 75
        ? 'Risk is above the city baseline and likely to intensify after dark.'
        : riskScore >= 50
          ? 'Risk is above average but manageable with safer routing and timing.'
          : 'Risk is relatively contained compared with other monitored corridors.',
    guidance:
      riskScore >= 75
        ? 'Prefer the safest corridor and keep live sharing on until you reach a populated safe hub.'
        : 'Use the balanced route and avoid isolated shortcuts during transition hours.',
  }
}

function incidentZoneLabel(incident: Incident) {
  if (incident.latitude >= 28.65) return 'North corridor'
  if (incident.latitude <= 28.55) return 'South corridor'
  if (incident.longitude >= 77.3) return 'East corridor'
  if (incident.longitude <= 77.12) return 'West corridor'
  return 'Central corridor'
}

function severityWeight(severity: Incident['severity']) {
  switch (severity) {
    case 'critical':
      return 5
    case 'high':
      return 3
    case 'medium':
      return 2
    default:
      return 1
  }
}

export function buildOperationalZones(
  incidents: Incident[],
  hotspots: Hotspot[],
  alerts: SOSAlert[]
): OperationalZone[] {
  const zoneMap = new Map<string, { incidents: number; weighted: number; activeAlerts: number }>()

  for (const incident of incidents) {
    const label = incidentZoneLabel(incident)
    const entry = zoneMap.get(label) ?? { incidents: 0, weighted: 0, activeAlerts: 0 }
    entry.incidents += 1
    entry.weighted += severityWeight(incident.severity)
    zoneMap.set(label, entry)
  }

  for (const alert of alerts) {
    const label = incidentZoneLabel({
      latitude: alert.current_latitude ?? alert.latitude,
      longitude: alert.current_longitude ?? alert.longitude,
    } as Incident)
    const entry = zoneMap.get(label) ?? { incidents: 0, weighted: 0, activeAlerts: 0 }
    entry.activeAlerts += alert.status === 'active' ? 1 : 0
    entry.weighted += alert.status === 'active' ? 4 : 1
    zoneMap.set(label, entry)
  }

  if (zoneMap.size === 0 && hotspots.length) {
    const sample = hotspots.slice(0, 3)
    return sample.map((hotspot, index) => ({
      label: hotspot.state,
      priority: clampScore(hotspot.risk_score - index * 4),
      risk: hotspot.classification,
      incidents: Math.max(1, Math.round(hotspot.crime_count / 1000)),
      activeAlerts: index === 0 ? 1 : 0,
      recommendation: hotspot.classification === 'critical'
        ? 'Stage one patrol unit and keep camera coverage active.'
        : 'Keep a visible patrol loop through the next high-footfall window.',
    }))
  }

  return Array.from(zoneMap.entries())
    .map(([label, value]) => {
      const priority = clampScore(value.weighted * 8 + value.activeAlerts * 12)
      const risk = classifyRisk(priority)
      return {
        label,
        priority,
        risk,
        incidents: value.incidents,
        activeAlerts: value.activeAlerts,
        recommendation:
          value.activeAlerts > 0
            ? 'Dispatch nearest unit now and keep one reserve team on standby.'
            : value.weighted >= 10
              ? 'Increase patrol visibility and audit CCTV coverage in this corridor.'
              : 'Monitor with a lighter patrol loop and community outreach checks.',
      }
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 4)
}

export function buildDispatchRecommendations(
  alerts: SOSAlert[],
  incidents: Incident[],
  hotspots: Hotspot[]
): DispatchRecommendation[] {
  const activeAlerts = alerts.filter((alert) => alert.status === 'active')
  const highSeverity = incidents.filter(
    (incident) => incident.severity === 'high' || incident.severity === 'critical'
  ).length
  const criticalHotspots = hotspots.filter((hotspot) => hotspot.classification === 'critical').length

  const recommendations: DispatchRecommendation[] = []

  if (activeAlerts.length > 0) {
    recommendations.push({
      title: 'Immediate dispatch',
      detail: `${activeAlerts.length} SOS alert(s) are still active. Route the nearest unit first and keep live location monitoring open.`,
      severity: 'high',
    })
  }

  if (highSeverity >= 2) {
    recommendations.push({
      title: 'Reinforce violent-crime coverage',
      detail: `${highSeverity} serious incidents are in the current working set. Add one high-visibility patrol to the most stressed corridor.`,
      severity: 'medium',
    })
  }

  recommendations.push({
    title: 'Protect hotspot exits',
    detail: `${criticalHotspots || 1} critical hotspot zone(s) need safer outbound corridors, especially after dusk.`,
    severity: criticalHotspots > 2 ? 'high' : 'low',
  })

  return recommendations.slice(0, 3)
}

export function buildIncidentClusters(
  incidents: Incident[],
  hotspots: Hotspot[]
): IncidentCluster[] {
  const buckets = new Map<string, { count: number; severity: number; repeat: number; hotspotPressure: number }>()
  const seenLocation = new Map<string, number>()

  for (const incident of incidents) {
    const zone = incidentZoneLabel(incident)
    const key = `${zone}:${incident.type}`
    seenLocation.set(key, (seenLocation.get(key) ?? 0) + 1)
    const entry = buckets.get(zone) ?? { count: 0, severity: 0, repeat: 0, hotspotPressure: 0 }
    entry.count += 1
    entry.severity += severityWeight(incident.severity)
    buckets.set(zone, entry)
  }

  for (const [key, count] of seenLocation.entries()) {
    if (count > 1) {
      const zone = key.split(':')[0]
      const entry = buckets.get(zone)
      if (entry) entry.repeat += count
    }
  }

  for (const hotspot of hotspots.slice(0, 12)) {
    const zone = incidentZoneLabel({ latitude: hotspot.latitude, longitude: hotspot.longitude } as Incident)
    const entry = buckets.get(zone) ?? { count: 0, severity: 0, repeat: 0, hotspotPressure: 0 }
    entry.hotspotPressure += Math.round(hotspot.risk_score / 15)
    buckets.set(zone, entry)
  }

  return Array.from(buckets.entries())
    .map(([label, value], index) => ({
      id: `cluster-${index + 1}`,
      label,
      incidentCount: value.count,
      hotspotPressure: value.hotspotPressure,
      repeatLocationCount: value.repeat,
      avgSeverityScore: value.count ? round(value.severity / value.count) : 0,
    }))
    .sort((a, b) => (b.incidentCount + b.hotspotPressure) - (a.incidentCount + a.hotspotPressure))
    .slice(0, 4)
}

export function buildRepeatLocationInsights(incidents: Incident[]): RepeatLocationInsight[] {
  const map = new Map<string, { count: number; crimes: Map<string, number> }>()

  for (const incident of incidents) {
    const label = `${incidentZoneLabel(incident)} / ${incident.type.replace(/_/g, ' ')}`
    const entry = map.get(label) ?? { count: 0, crimes: new Map<string, number>() }
    entry.count += 1
    entry.crimes.set(incident.type, (entry.crimes.get(incident.type) ?? 0) + 1)
    map.set(label, entry)
  }

  return Array.from(map.entries())
    .filter(([, entry]) => entry.count >= 1)
    .map(([label, entry]) => {
      const dominantCrime =
        Array.from(entry.crimes.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'other'
      return {
        label,
        count: entry.count,
        dominantCrime: dominantCrime.replace(/_/g, ' '),
        recommendation:
          entry.count >= 2
            ? 'Treat as a repeat location and increase visible patrol plus camera review.'
            : 'Monitor as an emerging repeat-risk pocket.',
      }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
}

export function buildPatrolAllocations(
  zones: OperationalZone[],
  availableUnits: number
): PatrolAllocation[] {
  const totalPriority = zones.reduce((sum, zone) => sum + zone.priority, 0) || 1

  return zones.map((zone, index) => {
    const proportional = Math.max(1, Math.round((zone.priority / totalPriority) * availableUnits))
    const unitsRecommended = Math.min(availableUnits, proportional + (index === 0 && availableUnits >= 2 ? 1 : 0))
    return {
      zone: zone.label,
      unitsRecommended,
      urgency: zone.risk,
      reason:
        zone.activeAlerts > 0
          ? 'Active SOS load plus incident pressure'
          : zone.priority >= 70
            ? 'High recurring pressure and hotspot concentration'
            : 'Support coverage for spillover prevention',
    }
  })
}

export function buildResponseSimulation(
  zone: OperationalZone | undefined,
  unitsMoved: number
): ResponseSimulation | null {
  if (!zone) return null
  const currentResponseMin = round(Math.max(6.5, 14 - zone.priority / 12 + zone.activeAlerts * 1.4))
  const projectedResponseMin = round(
    Math.max(3.8, currentResponseMin - unitsMoved * 1.35 - zone.activeAlerts * 0.2)
  )
  const improvementPct = Math.max(
    4,
    Math.round(((currentResponseMin - projectedResponseMin) / currentResponseMin) * 100)
  )

  return {
    zone: zone.label,
    currentResponseMin,
    projectedResponseMin,
    improvementPct,
    unitsMoved,
    impact:
      unitsMoved >= 2
        ? `If ${unitsMoved} patrol units shift here, first-response time improves by about ${improvementPct}%.`
        : `One extra unit trims first-response time by about ${improvementPct}%.`,
  }
}

export function buildPatrolUnits(
  zones: OperationalZone[],
  availableUnits: number
): PatrolUnit[] {
  const statusCycle: PatrolUnit['status'][] = ['available', 'staged', 'en_route', 'assigned']
  return Array.from({ length: availableUnits }, (_, index) => {
    const zone = zones[index % Math.max(zones.length, 1)]
    const status = statusCycle[index % statusCycle.length]
    const etaMinutes =
      status === 'available'
        ? 0
        : Math.max(3, Math.round(11 - (zone?.priority ?? 40) / 15 + (index % 3)))
    return {
      id: `unit-${index + 1}`,
      callSign: `LS-${String(index + 1).padStart(2, '0')}`,
      status,
      zone: zone?.label ?? 'City reserve',
      etaMinutes,
      focus:
        status === 'available'
          ? 'Standby for redeployment'
          : zone?.activeAlerts
            ? 'Supporting live SOS response'
            : 'Visible patrol and corridor hardening',
    }
  })
}

export function buildCoverageHeatmap(zones: OperationalZone[]) {
  return zones.map((zone, index) => ({
    id: `${zone.label}-${index}`,
    label: zone.label,
    pressure: clampScore(zone.priority + zone.activeAlerts * 6),
    coverage: Math.max(24, Math.min(92, 88 - zone.priority + index * 4)),
    recommendation:
      zone.activeAlerts > 0
        ? 'Move the nearest mobile unit and keep a reserve behind it.'
        : zone.priority >= 70
          ? 'Stage a visible patrol pair before the next peak window.'
          : 'Maintain lighter patrol loops and camera watch.',
  }))
}

function clampScore(score: number) {
  return Math.max(5, Math.min(98, Math.round(score)))
}

function round(value: number) {
  return Math.round(value * 10) / 10
}
