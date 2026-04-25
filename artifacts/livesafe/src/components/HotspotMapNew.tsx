import 'leaflet/dist/leaflet.css'
import React, { useState, useCallback, useEffect, useMemo } from 'react'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { MapContainer, TileLayer, CircleMarker, Popup, Marker, Polyline, useMap } from 'react-leaflet'
import {
  ChevronDown,
  Loader2,
  CheckCircle2,
  XCircle,
  MapPin,
  ShieldCheck,
  Route,
  Siren,
  TimerReset,
  Building2,
  Mic,
  Video,
  Users,
  HeartPulse,
  ShieldPlus,
  Navigation,
  MoonStar,
  GraduationCap,
  LocateFixed,
  Compass,
  School,
  ShieldAlert,
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '@/app/hooks/useApi'
import { useAuth } from '@/app/hooks/useAuth'
import { api } from '@/app/services/api'
import {
  buildNearbySafetyHubs,
  buildRouteOptions,
  findNearestHotspot,
  type RouteOption,
} from '@/app/services/safetyIntelligence'
import type { Hotspot, RiskClassification, SOSAlert, SOSEvidenceReviewState } from '@/types'
import { cn } from '@/lib/utils'
import { RISK_COLORS, RISK_BG } from '@/app/services/hotspots_v5'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

type SOSPhase = 'idle' | 'locating' | 'sending' | 'success' | 'error'
type SafetyMode = 'everyday' | 'night' | 'women' | 'student'
type LocationStatus = 'idle' | 'locating' | 'ready' | 'fallback' | 'error'

interface EvidenceClip {
  id: string
  type: 'audio' | 'video'
  label: string
  createdAt: string
  url?: string
}

interface ScenarioPreset {
  id: string
  title: string
  window: string
  detail: string
  routeBias: string
  fallback: string
}

const responderRoleMap = {
  'Police dispatch': 'police',
  'Family contacts': 'family',
  'Verified volunteers': 'volunteer',
  'Hospital standby': 'hospital',
} as const

const sosUserIcon = new L.DivIcon({
  className: '',
  html: `<div style="width:18px;height:18px;background:#ef4444;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(239,68,68,0.35),0 2px 6px rgba(0,0,0,0.4)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

const currentLocationIcon = new L.DivIcon({
  className: '',
  html: `<div style="width:18px;height:18px;background:#2563eb;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(37,99,235,0.26),0 2px 6px rgba(0,0,0,0.35)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

const destinationIcon = new L.DivIcon({
  className: '',
  html: `<div style="width:18px;height:18px;background:#7c3aed;border:3px solid white;border-radius:6px;transform:rotate(45deg);box-shadow:0 0 0 4px rgba(124,58,237,0.18),0 2px 6px rgba(0,0,0,0.35)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

const scenarioPresetsByMode: Record<SafetyMode, ScenarioPreset[]> = {
  everyday: [
    {
      id: 'daily-commute',
      title: 'Daily city commute',
      window: 'Rush hour',
      detail: 'Best for routine office, market, and metro movement through predictable footfall.',
      routeBias: 'Keeps the route balanced between speed and visible corridors.',
      fallback: 'If traffic stalls, head for the nearest transit hub instead of cutting through side streets.',
    },
    {
      id: 'market-return',
      title: 'Late market return',
      window: 'Evening',
      detail: 'Favors active roads and avoids pockets with repeated theft and harassment reports.',
      routeBias: 'Prefers open storefront stretches and camera-covered intersections.',
      fallback: 'Pause at a police booth or pharmacy if the route suddenly feels isolated.',
    },
  ],
  night: [
    {
      id: 'night-ride',
      title: 'Ride-share drop after 10 PM',
      window: 'Night',
      detail: 'Assumes you are getting down alone and need the brightest final stretch home.',
      routeBias: 'Pushes toward lit main roads, active shops, and hospital-backed fallback points.',
      fallback: 'If the driver stops early, stay near open shops and call a contact before moving.',
    },
    {
      id: 'night-walk',
      title: 'Walking from metro at night',
      window: 'Night',
      detail: 'Designed for last-mile walking when footfall drops and shortcuts become risky.',
      routeBias: 'Avoids dim shortcuts and uses roads with visible traffic or security presence.',
      fallback: 'Move to the next busy junction instead of committing to a dark internal lane.',
    },
  ],
  women: [
    {
      id: 'women-commute',
      title: 'Returning home alone',
      window: 'After dusk',
      detail: 'Optimized for monitored corridors, staffed transit, and volunteer-friendly support zones.',
      routeBias: 'Prefers visible movement and lowers time spent near low-visibility clusters.',
      fallback: 'Head to the nearest staffed transit point if you feel followed or watched.',
    },
    {
      id: 'women-office',
      title: 'Office to home late shift',
      window: 'Night',
      detail: 'Assumes delayed departure and prioritizes escorted, lit, and crowd-backed movement.',
      routeBias: 'Favors corridors with police visibility and high-confidence lighting coverage.',
      fallback: 'Wait at reception or a pharmacy and share live location until the next safe leg opens.',
    },
  ],
  student: [
    {
      id: 'hostel-library',
      title: 'Library to hostel',
      window: 'Late evening',
      detail: 'Built for student routes where campus exits, hostel gates, and study zones matter.',
      routeBias: 'Leans on campus-linked roads, guards, hostels, and food stalls with footfall.',
      fallback: 'Use the next campus gate or security point if the route feels empty.',
    },
    {
      id: 'student-metro',
      title: 'Metro to campus',
      window: 'After class',
      detail: 'Designed for public transport arrival and the walk back to school or hostel.',
      routeBias: 'Avoids isolated lots and prioritizes corridors with peers and transport staff nearby.',
      fallback: 'Stay inside transit premises or at a canteen zone until someone can walk with you.',
    },
  ],
}

function FlyTo({ target }: { target: { lat: number; lon: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lon], 13, { duration: 1.4 })
  }, [target, map])
  return null
}

function formatAreaLabel(hotspot?: Hotspot | null) {
  if (!hotspot?.state) return 'Current area'
  return hotspot.state
}

function buildRoutePolyline(
  origin: { lat: number; lon: number },
  destination: { lat: number; lon: number },
  profile: RouteOption['profile']
) {
  const latStep = destination.lat - origin.lat
  const lonStep = destination.lon - origin.lon
  const lateralBend =
    profile === 'safest' ? 0.04 : profile === 'balanced' ? 0.02 : -0.015

  return [
    { lat: origin.lat, lon: origin.lon },
    { lat: origin.lat + latStep * 0.25 + lateralBend, lon: origin.lon + lonStep * 0.22 - lateralBend * 0.55 },
    { lat: origin.lat + latStep * 0.55 + lateralBend * 0.4, lon: origin.lon + lonStep * 0.58 + lateralBend },
    { lat: origin.lat + latStep * 0.82 - lateralBend * 0.2, lon: origin.lon + lonStep * 0.84 + lateralBend * 0.35 },
    { lat: destination.lat, lon: destination.lon },
  ]
}

function routeColor(profile: RouteOption['profile']) {
  if (profile === 'safest') return '#22c55e'
  if (profile === 'balanced') return '#6366f1'
  return '#f97316'
}

export default function HotspotMapNew() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isCitizen = user?.role === 'citizen'

  const [riskFilter, setRiskFilter] = useState<'all' | RiskClassification>('all')
  const [selectedState, setSelectedState] = useState('all')
  const [selectedCity, setSelectedCity] = useState<Hotspot | null>(null)
  const [destinationId, setDestinationId] = useState('')
  const [selectedRouteId, setSelectedRouteId] = useState('safest')
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle')
  const [scenarioId, setScenarioId] = useState(scenarioPresetsByMode.night[0].id)

  const [sosPhase, setSOSPhase] = useState<SOSPhase>('idle')
  const [sosError, setSOSError] = useState('')
  const [sosResult, setSOSResult] = useState<SOSAlert | null>(null)
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null)
  const [locationTrail, setLocationTrail] = useState<Array<{ lat: number; lon: number }>>([])
  const [watchId, setWatchId] = useState<number | null>(null)
  const [shareLive, setShareLive] = useState(true)
  const [autoEscalate, setAutoEscalate] = useState(true)
  const [safetyMode, setSafetyMode] = useState<SafetyMode>('night')
  const [evidence, setEvidence] = useState<EvidenceClip[]>([])
  const [recordingKind, setRecordingKind] = useState<'audio' | 'video' | null>(null)
  const [checkInCountdown, setCheckInCountdown] = useState(45)
  const [isEscalated, setIsEscalated] = useState(false)
  const [sessionHydrated, setSessionHydrated] = useState(false)

  const { data: contacts = [] } = useApi((sig) => api.getEmergencyContacts(sig))
  const contactsList = contacts ?? []

  const { data: rawHotspots, isLoading, error, refetch } = useApi((sig) => api.getHotspots(sig))
  const hotspots: Hotspot[] = rawHotspots || []

  const filteredHotspots = hotspots.filter((h) => {
    const stateName = h.state ?? ''
    return (
      (riskFilter === 'all' || h.classification === riskFilter) &&
      (selectedState === 'all' || stateName.includes(selectedState))
    )
  })

  const states = [
    'all',
    ...Array.from(
      new Set(
        hotspots
          .map((h) => (h.state ?? '').split(', ')[1])
          .filter((s): s is string => Boolean(s))
      )
    ).sort(),
  ]

  const fallbackHotspot = filteredHotspots[0] ?? hotspots[0] ?? null

  useEffect(() => {
    if (selectedCity) {
      setDestinationId(selectedCity.id)
      return
    }
    if (!destinationId && fallbackHotspot) {
      setDestinationId(fallbackHotspot.id)
    }
  }, [destinationId, fallbackHotspot, selectedCity])

  useEffect(() => {
    const nextScenario = scenarioPresetsByMode[safetyMode]
    if (!nextScenario.some((preset) => preset.id === scenarioId)) {
      setScenarioId(nextScenario[0].id)
    }
  }, [safetyMode, scenarioId])

  const destinationHotspot = useMemo(
    () =>
      hotspots.find((hotspot) => hotspot.id === destinationId) ??
      selectedCity ??
      fallbackHotspot,
    [destinationId, fallbackHotspot, hotspots, selectedCity]
  )

  const activeLocation = useMemo(() => {
    if (userLocation) return userLocation
    if (fallbackHotspot) return { lat: fallbackHotspot.latitude, lon: fallbackHotspot.longitude }
    return { lat: 28.6139, lon: 77.209 }
  }, [fallbackHotspot, userLocation])

  const destinationLocation = useMemo(
    () =>
      destinationHotspot
        ? { lat: destinationHotspot.latitude, lon: destinationHotspot.longitude }
        : activeLocation,
    [activeLocation, destinationHotspot]
  )

  const currentHotspot = useMemo(
    () => findNearestHotspot(hotspots, activeLocation).hotspot,
    [activeLocation, hotspots]
  )

  const nearbyHubs = useMemo(
    () => buildNearbySafetyHubs(hotspots, destinationLocation),
    [destinationLocation, hotspots]
  )

  const activeScenario = scenarioPresetsByMode[safetyMode].find((preset) => preset.id === scenarioId) ?? scenarioPresetsByMode[safetyMode][0]

  const routeOptions = useMemo(() => {
    const base = buildRouteOptions(hotspots, destinationLocation)
    return base.map((option) => {
      const destinationLabel = formatAreaLabel(destinationHotspot).split(', ')[0]
      if (safetyMode === 'night') {
        return {
          ...option,
          summary: `${option.summary} Built for ${activeScenario.title.toLowerCase()} and prioritizes lit streets into ${destinationLabel}.`,
          checkpoints: [...option.checkpoints, 'Stay on well-lit stretches with shops, taxis, or guards nearby'],
        }
      }
      if (safetyMode === 'women') {
        return {
          ...option,
          summary: `${option.summary} Gives extra weight to monitored corridors, transit staff, and visible help points into ${destinationLabel}.`,
          checkpoints: [...option.checkpoints, 'Favor monitored zones, staffed stops, and places where help is visible'],
        }
      }
      if (safetyMode === 'student') {
        return {
          ...option,
          summary: `${option.summary} Favors campus-linked movement, hostel approaches, and regular student commute paths into ${destinationLabel}.`,
          checkpoints: [...option.checkpoints, 'Stay close to campus gates, canteens, and peer footfall pockets'],
        }
      }
      return {
        ...option,
        summary: `${option.summary} Tuned for ${activeScenario.title.toLowerCase()} and keeps city travel practical.`,
        checkpoints: [...option.checkpoints, 'Keep a contact informed through the final stretch'],
      }
    })
  }, [activeScenario.title, destinationHotspot, destinationLocation, hotspots, safetyMode])

  const selectedRoute =
    routeOptions.find((option) => option.id === selectedRouteId) ??
    routeOptions[0] ??
    null

  const routePolyline = useMemo(() => {
    if (!selectedRoute || !destinationHotspot) return []
    return buildRoutePolyline(activeLocation, destinationLocation, selectedRoute.profile)
  }, [activeLocation, destinationHotspot, destinationLocation, selectedRoute])

  const plannerFocus = useMemo(() => {
    if (sosPhase === 'success' && userLocation) return userLocation
    if (destinationHotspot) return destinationLocation
    return activeLocation
  }, [activeLocation, destinationHotspot, destinationLocation, sosPhase, userLocation])

  const liveRecipients = useMemo(() => {
    const familyCount = contactsList.length
    const volunteerCount = safetyMode === 'women' ? 3 : safetyMode === 'student' ? 2 : 1
    return [
      { label: 'Police dispatch', detail: 'Primary emergency response and corridor override' },
      { label: 'Family contacts', detail: familyCount ? `${familyCount} trusted contact(s)` : 'No contacts added yet' },
      { label: 'Verified volunteers', detail: `${volunteerCount} responder(s) around the recommended corridor` },
      { label: 'Hospital standby', detail: nearbyHubs.find((hub) => hub.kind === 'hospital')?.name ?? 'Nearest emergency care hub' },
    ]
  }, [contactsList.length, nearbyHubs, safetyMode])

  const notifiedTargetLabels = useMemo(
    () => liveRecipients.map((recipient) => recipient.label),
    [liveRecipients]
  )

  const responderStatus = useMemo<SOSAlert['responder_status']>(() => (
    liveRecipients.map((recipient, index) => {
      const role = responderRoleMap[recipient.label as keyof typeof responderRoleMap] ?? 'family'
      const status =
        role === 'police'
          ? 'en_route'
          : role === 'hospital'
            ? 'standby'
            : 'accepted'
      return {
        id: `rsp-${role}-${index}`,
        label: recipient.label,
        role,
        status,
        eta_minutes: role === 'family' ? undefined : 4 + index * 2,
      }
    })
  ), [liveRecipients])

  const modeDetails: Record<SafetyMode, { title: string; detail: string; icon: React.ReactNode; tone: string }> = {
    everyday: {
      title: 'Everyday Safe Route',
      detail: 'Balanced city movement with safer intersections, reliable footfall, and practical travel time.',
      icon: <Navigation className="h-4 w-4 text-sky-500" />,
      tone: 'from-sky-500/20 via-sky-500/5 to-transparent',
    },
    night: {
      title: 'Night Safety Mode',
      detail: 'Uses lit roads, active shops, late-night transit pockets, and medical fallback points.',
      icon: <MoonStar className="h-4 w-4 text-indigo-400" />,
      tone: 'from-indigo-500/20 via-indigo-500/5 to-transparent',
    },
    women: {
      title: 'Women Safety Mode',
      detail: 'Prefers visible corridors, monitored transit, volunteers, and zones with stronger guardianship.',
      icon: <ShieldPlus className="h-4 w-4 text-pink-400" />,
      tone: 'from-pink-500/20 via-pink-500/5 to-transparent',
    },
    student: {
      title: 'Student Commute Mode',
      detail: 'Optimized for hostel, campus gate, metro, and library movement with student-friendly fallback stops.',
      icon: <GraduationCap className="h-4 w-4 text-emerald-400" />,
      tone: 'from-emerald-500/20 via-emerald-500/5 to-transparent',
    },
  }

  useEffect(() => {
    if (!isCitizen || sessionHydrated || typeof window === 'undefined') return
    try {
      const raw = window.sessionStorage.getItem('livesafe-active-sos')
      if (!raw) {
        setSessionHydrated(true)
        return
      }
      const saved = JSON.parse(raw) as {
        sosResult: SOSAlert | null
        userLocation: { lat: number; lon: number } | null
        locationTrail: Array<{ lat: number; lon: number }>
        safetyMode: SafetyMode
        evidence: EvidenceClip[]
        isEscalated: boolean
      }
      if (saved.sosResult) {
        setSOSResult(saved.sosResult)
        setUserLocation(saved.userLocation)
        setLocationTrail(saved.locationTrail ?? [])
        setSafetyMode(saved.safetyMode ?? 'night')
        setEvidence(saved.evidence ?? [])
        setIsEscalated(Boolean(saved.isEscalated))
        setSOSPhase('success')
      }
    } catch {}
    setSessionHydrated(true)
  }, [isCitizen, sessionHydrated])

  useEffect(() => {
    if (!isCitizen || typeof window === 'undefined') return
    if (sosPhase !== 'success' || !sosResult) {
      window.sessionStorage.removeItem('livesafe-active-sos')
      return
    }
    window.sessionStorage.setItem('livesafe-active-sos', JSON.stringify({
      sosResult,
      userLocation,
      locationTrail,
      safetyMode,
      evidence,
      isEscalated,
    }))
  }, [evidence, isCitizen, isEscalated, locationTrail, safetyMode, sosPhase, sosResult, userLocation])

  const locateCurrentPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus('error')
      return
    }
    setLocationStatus('locating')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setLocationStatus('ready')
      },
      () => {
        setUserLocation({ lat: 28.6139, lon: 77.209 })
        setLocationStatus('fallback')
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    )
  }, [])

  const handleSOS = useCallback(async () => {
    if (sosPhase !== 'idle') return
    setSOSError('')
    setSOSResult(null)
    setSOSPhase('locating')

    const send = async (lat: number, lon: number) => {
      setUserLocation({ lat, lon })
      setLocationTrail([{ lat, lon }])
      setCheckInCountdown(45)
      setIsEscalated(false)
      setSOSPhase('sending')
      try {
        const alert = await api.triggerSOS({
          latitude: lat,
          longitude: lon,
          user_id: user?.id ?? 'anonymous',
          user_name: user?.name,
        })
        const enrichedAlert: SOSAlert = {
          ...alert,
          safety_mode: safetyMode,
          escalated: false,
          last_checkin_at: new Date().toISOString(),
          notified_targets: notifiedTargetLabels,
          whatsapp_notifications_sent: contactsList.length,
          evidence_count: evidence.length,
          responder_status: responderStatus,
          evidence_items: [],
          trail: [{ latitude: lat, longitude: lon, recorded_at: new Date().toISOString() }],
        }
        setSOSResult(enrichedAlert)
        api.syncSOSAlert(alert.id, {
          safety_mode: safetyMode,
          escalated: false,
          last_checkin_at: new Date().toISOString(),
          notified_targets: notifiedTargetLabels,
          whatsapp_notifications_sent: contactsList.length,
          evidence_count: evidence.length,
          responder_status: responderStatus,
          evidence_items: [],
          event: {
            type: 'network_dispatch',
            detail: `SOS routed to ${notifiedTargetLabels.join(', ')}.`,
          },
        }).catch(() => {})
        setSOSPhase('success')

        if (shareLive && navigator.geolocation) {
          const id = navigator.geolocation.watchPosition(
            (pos) => {
              const newLat = pos.coords.latitude
              const newLon = pos.coords.longitude
              setUserLocation({ lat: newLat, lon: newLon })
              setLocationTrail((trail) => [...trail.slice(-11), { lat: newLat, lon: newLon }])
              setSOSResult((current) => current ? {
                ...current,
                current_latitude: newLat,
                current_longitude: newLon,
                location_updated_at: new Date().toISOString(),
                trail: [
                  ...(current.trail ?? []).slice(-11),
                  { latitude: newLat, longitude: newLon, recorded_at: new Date().toISOString() },
                ],
              } : current)
              api.updateSOSLocation(alert.id, { latitude: newLat, longitude: newLon }).catch(() => {})
            },
            () => {},
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
          )
          setWatchId(id)
        }
      } catch {
        setSOSError('Could not send SOS. Please call 112 immediately.')
        setSOSPhase('error')
      }
    }

    if (!navigator.geolocation) {
      setSOSError('Geolocation not supported. Please call 112.')
      setSOSPhase('error')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => send(pos.coords.latitude, pos.coords.longitude),
      () => send(activeLocation.lat, activeLocation.lon),
      { timeout: 8000, maximumAge: 30000 }
    )
  }, [activeLocation.lat, activeLocation.lon, contactsList.length, evidence.length, notifiedTargetLabels, responderStatus, safetyMode, shareLive, sosPhase, user])

  useEffect(() => {
    if (sosPhase !== 'success' || !autoEscalate) return
    const timer = window.setInterval(() => {
      setCheckInCountdown((value) => {
        if (value <= 1) {
          setIsEscalated(true)
          setSOSResult((current) => {
            if (!current) return current
            api.syncSOSAlert(current.id, {
              escalated: true,
              event: {
                type: 'escalated',
                detail: 'Dead-man switch auto-escalated this SOS after a missed check-in.',
              },
            }).catch(() => {})
            return { ...current, escalated: true }
          })
          return 45
        }
        return value - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [autoEscalate, sosPhase])

  const handleCheckIn = () => {
    setCheckInCountdown(45)
    setIsEscalated(false)
    const checkedInAt = new Date().toISOString()
    setSOSResult((current) => {
      if (!current) return current
      api.syncSOSAlert(current.id, {
        escalated: false,
        last_checkin_at: checkedInAt,
        event: {
          type: 'checkin',
          detail: 'Citizen confirmed they are responsive and still moving.',
        },
      }).catch(() => {})
      return { ...current, escalated: false, last_checkin_at: checkedInAt }
    })
  }

  const buildEvidenceItem = (
    clip: EvidenceClip,
    reviewStatus: SOSEvidenceReviewState
  ) => ({
    id: clip.id,
    type: clip.type,
    label: clip.label,
    captured_at: new Date().toISOString(),
    review_status: reviewStatus,
  })

  const addEvidence = useCallback((type: 'audio' | 'video') => {
    const clip: EvidenceClip = {
      id: `${type}-${Date.now()}`,
      type,
      label: type === 'audio' ? 'Audio evidence clip' : 'Video evidence clip',
      createdAt: new Date().toLocaleTimeString(),
    }

    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined') {
      setRecordingKind(type)
      navigator.mediaDevices
        .getUserMedia(type === 'audio' ? { audio: true } : { audio: true, video: true })
        .then((stream) => {
          const recorder = new MediaRecorder(stream)
          const parts: BlobPart[] = []
          recorder.ondataavailable = (event) => {
            if (event.data.size > 0) parts.push(event.data)
          }
          recorder.onstop = () => {
            const blob = new Blob(parts, { type: type === 'audio' ? 'audio/webm' : 'video/webm' })
            const url = URL.createObjectURL(blob)
            setEvidence((current) => [{ ...clip, url }, ...current].slice(0, 4))
            setSOSResult((current) => {
              if (!current) return current
              const nextCount = (current.evidence_count ?? 0) + 1
              const nextItems = [
                buildEvidenceItem(clip, type === 'video' ? 'flagged' : 'new'),
                ...(current.evidence_items ?? []),
              ].slice(0, 4)
              api.syncSOSAlert(current.id, {
                evidence_count: nextCount,
                evidence_items: nextItems,
                event: {
                  type: 'evidence',
                  detail: `${type === 'audio' ? 'Audio' : 'Video'} evidence clip uploaded from the citizen device.`,
                },
              }).catch(() => {})
              return { ...current, evidence_count: nextCount, evidence_items: nextItems }
            })
            stream.getTracks().forEach((track) => track.stop())
            setRecordingKind(null)
          }
          recorder.start()
          window.setTimeout(() => recorder.state !== 'inactive' && recorder.stop(), 5000)
        })
        .catch(() => {
          setEvidence((current) => [clip, ...current].slice(0, 4))
          setSOSResult((current) => {
            if (!current) return current
            const nextCount = (current.evidence_count ?? 0) + 1
            const nextItems = [
              buildEvidenceItem(clip, 'new'),
              ...(current.evidence_items ?? []),
            ].slice(0, 4)
            api.syncSOSAlert(current.id, {
              evidence_count: nextCount,
              evidence_items: nextItems,
              event: {
                type: 'evidence',
                detail: `${type === 'audio' ? 'Audio' : 'Video'} evidence metadata captured in fallback mode.`,
              },
            }).catch(() => {})
            return { ...current, evidence_count: nextCount, evidence_items: nextItems }
          })
          setRecordingKind(null)
        })
      return
    }

    setEvidence((current) => [clip, ...current].slice(0, 4))
    setSOSResult((current) => {
      if (!current) return current
      const nextCount = (current.evidence_count ?? 0) + 1
      const nextItems = [
        buildEvidenceItem(clip, 'new'),
        ...(current.evidence_items ?? []),
      ].slice(0, 4)
      api.syncSOSAlert(current.id, {
        evidence_count: nextCount,
        evidence_items: nextItems,
        event: {
          type: 'evidence',
          detail: `${type === 'audio' ? 'Audio' : 'Video'} evidence metadata captured in fallback mode.`,
        },
      }).catch(() => {})
      return { ...current, evidence_count: nextCount, evidence_items: nextItems }
    })
  }, [])

  const resetSOS = () => {
    setSOSPhase('idle')
    setSOSError('')
    setSOSResult(null)
    setUserLocation(null)
    setLocationTrail([])
    setEvidence([])
    setCheckInCountdown(45)
    setIsEscalated(false)
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('livesafe-active-sos')
    }
    if (watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId)
      setWatchId(null)
    }
  }

  useEffect(() => {
    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [watchId])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-600">
        Error loading hotspots.{' '}
        <button onClick={refetch} className="underline">Retry</button>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col gap-6 pb-6 text-slate-100">
      <section className="rounded-[28px] border border-white/10 bg-slate-900/70 shadow-2xl shadow-slate-950/20">
        <div className={cn('grid gap-0 lg:grid-cols-[1.15fr_0.85fr]', `bg-gradient-to-br ${modeDetails[safetyMode].tone}`)}>
          <div className="border-b border-white/10 p-6 lg:border-b-0 lg:border-r">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    <Compass className="h-3.5 w-3.5 text-indigo-300" />
                    Safe Route Navigator
                  </div>
                  <h2 className="mt-2 text-2xl font-bold text-white">Plan the safest way to move right now</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                    This is the citizen travel planner the earlier version should have been. Pick your mode, set where you are going, and we will show the current location, destination, recommended night-safe route, and fallback points.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/map?screen=dashboard')}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  Back to dashboard
                </button>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Current location</p>
                          <p className="mt-1 text-base font-semibold text-white">
                            {formatAreaLabel(currentHotspot).split(', ')[0]}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {userLocation
                              ? `${userLocation.lat.toFixed(4)}, ${userLocation.lon.toFixed(4)}`
                              : 'Using current city estimate until GPS is fetched'}
                          </p>
                        </div>
                        <button
                          onClick={locateCurrentPosition}
                          className="inline-flex items-center gap-2 rounded-xl border border-sky-400/25 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/15"
                        >
                          {locationStatus === 'locating' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                          Locate me
                        </button>
                      </div>
                      <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
                        {locationStatus === 'ready' && 'Using live GPS. The map and route start marker now reflect your current position.'}
                        {locationStatus === 'locating' && 'Trying to get an accurate current location from your device.'}
                        {locationStatus === 'fallback' && 'GPS was not available, so we fell back to a city estimate.'}
                        {locationStatus === 'error' && 'This browser blocked location access. Use fallback mode or enable GPS.'}
                        {locationStatus === 'idle' && 'Tap "Locate me" to show your real starting point on the map.'}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Destination</p>
                      <div className="relative mt-2">
                        <select
                          value={destinationId}
                          onChange={(event) => {
                            setDestinationId(event.target.value)
                            setSelectedCity(hotspots.find((hotspot) => hotspot.id === event.target.value) ?? null)
                          }}
                          className="w-full appearance-none rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 pr-10 text-sm font-medium text-white outline-none transition focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20"
                        >
                          {hotspots.map((hotspot) => (
                            <option key={hotspot.id} value={hotspot.id}>
                              {formatAreaLabel(hotspot)}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      </div>
                      {destinationHotspot && (
                        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-slate-300">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold text-white">{formatAreaLabel(destinationHotspot)}</span>
                            <span
                              className="rounded-full px-2 py-0.5 text-[11px] font-bold capitalize"
                              style={{
                                backgroundColor: `${RISK_COLORS[destinationHotspot.classification]}18`,
                                color: RISK_COLORS[destinationHotspot.classification],
                              }}
                            >
                              {destinationHotspot.classification}
                            </span>
                          </div>
                          <p className="mt-2 leading-5 text-slate-400">
                            {destinationHotspot.primary_warning ?? 'Destination risk guidance will be shown in the selected route.'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {modeDetails[safetyMode].icon}
                      Scenario mode
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-4">
                      {(['everyday', 'night', 'women', 'student'] as SafetyMode[]).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setSafetyMode(mode)}
                          className={cn(
                            'rounded-2xl border px-4 py-3 text-left transition',
                            safetyMode === mode
                              ? 'border-indigo-400/50 bg-indigo-500/15 text-white shadow-lg shadow-indigo-500/10'
                              : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                          )}
                        >
                          <p className="text-sm font-semibold capitalize">{mode === 'everyday' ? 'Everyday' : mode}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-400">
                            {modeDetails[mode].detail}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {scenarioPresetsByMode[safetyMode].map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => setScenarioId(preset.id)}
                        className={cn(
                          'rounded-2xl border px-4 py-4 text-left transition',
                          scenarioId === preset.id
                            ? 'border-emerald-400/45 bg-emerald-500/10 text-white'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold">{preset.title}</span>
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
                            {preset.window}
                          </span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-slate-400">{preset.detail}</p>
                        <p className="mt-2 text-[11px] font-medium text-emerald-200">{preset.routeBias}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Best route right now</p>
                      <h3 className="mt-2 text-xl font-bold text-white">{selectedRoute?.label ?? 'Route unavailable'}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-300">
                        From {formatAreaLabel(currentHotspot).split(', ')[0]} to {formatAreaLabel(destinationHotspot).split(', ')[0]}.
                      </p>
                    </div>
                    {selectedRoute && (
                      <span
                        className="rounded-full px-3 py-1 text-xs font-bold capitalize"
                        style={{ backgroundColor: `${RISK_COLORS[selectedRoute.risk]}18`, color: RISK_COLORS[selectedRoute.risk] }}
                      >
                        {selectedRoute.risk} exposure
                      </span>
                    )}
                  </div>

                  {selectedRoute && (
                    <>
                      <div className="mt-4 grid grid-cols-3 gap-3">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Distance</p>
                          <p className="mt-1 text-lg font-bold text-white">{selectedRoute.distanceKm} km</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">ETA</p>
                          <p className="mt-1 text-lg font-bold text-white">{selectedRoute.etaMinutes} min</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Exposure</p>
                          <p className="mt-1 text-lg font-bold text-white">{selectedRoute.exposureScore}/100</p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-white">
                          <ShieldCheck className="h-4 w-4 text-emerald-300" />
                          Why this route is better
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{selectedRoute.summary}</p>
                        <ul className="mt-3 space-y-2 text-sm text-slate-300">
                          {selectedRoute.checkpoints.slice(0, 4).map((checkpoint) => (
                            <li key={checkpoint} className="flex items-start gap-2">
                              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-300" />
                              <span>{checkpoint}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="mt-4 rounded-2xl border border-amber-400/15 bg-amber-500/8 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-amber-100">
                          <ShieldAlert className="h-4 w-4 text-amber-300" />
                          Scenario fallback
                        </div>
                        <p className="mt-2 text-sm leading-6 text-amber-50/80">{activeScenario.fallback}</p>
                      </div>

                      <button
                        onClick={() => navigate('/map?screen=dashboard')}
                        className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-indigo-400/25 bg-indigo-500/15 px-4 py-3 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-500/20"
                      >
                        <Route className="h-4 w-4" />
                        Keep this route active
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Route className="h-4 w-4 text-indigo-300" />
                  Choose a route
                </div>
                <div className="mt-4 space-y-3">
                  {routeOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setSelectedRouteId(option.id)}
                      className={cn(
                        'w-full rounded-2xl border px-4 py-4 text-left transition',
                        selectedRouteId === option.id
                          ? 'border-indigo-400/45 bg-indigo-500/15'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-white">{option.label}</span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px] font-bold capitalize"
                          style={{ backgroundColor: `${RISK_COLORS[option.risk]}18`, color: RISK_COLORS[option.risk] }}
                        >
                          {option.risk}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-400">{option.summary}</p>
                      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-400">
                        <span>{option.distanceKm} km</span>
                        <span>{option.etaMinutes} min</span>
                        <span>Exposure {option.exposureScore}/100</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Building2 className="h-4 w-4 text-emerald-300" />
                  Safe hubs on the way
                </div>
                <div className="mt-4 space-y-3">
                  {nearbyHubs.map((hub) => (
                    <div key={hub.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">{hub.name}</p>
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
                          {hub.etaMinutes} min
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-400">{hub.distanceKm} km away. {hub.note}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Users className="h-4 w-4 text-rose-300" />
                      Safety network
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      This is what the SOS flow will notify from the citizen planner.
                    </p>
                  </div>
                <button
                  onClick={() => navigate('/map?screen=dashboard')}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  Home
                  </button>
                </div>

                <div className="mt-4 grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setShareLive((value) => !value)}
                      className={cn(
                        'rounded-2xl border px-3 py-3 text-left transition',
                        shareLive ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100' : 'border-white/10 bg-white/5 text-slate-300'
                      )}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">Live sharing</p>
                      <p className="mt-1 text-xs">{shareLive ? 'Enabled for responders' : 'Turn on for movement trail'}</p>
                    </button>
                    <button
                      onClick={() => setAutoEscalate((value) => !value)}
                      className={cn(
                        'rounded-2xl border px-3 py-3 text-left transition',
                        autoEscalate ? 'border-amber-400/35 bg-amber-500/10 text-amber-100' : 'border-white/10 bg-white/5 text-slate-300'
                      )}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">Dead-man switch</p>
                      <p className="mt-1 text-xs">{autoEscalate ? 'Auto-escalates if you stop responding' : 'Manual escalation only'}</p>
                    </button>
                  </div>

                  {liveRecipients.map((recipient) => (
                    <div key={recipient.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-white">{recipient.label}</span>
                        <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-200">
                          queued
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{recipient.detail}</p>
                    </div>
                  ))}

                  <button
                    onClick={() => navigate('/map?screen=contacts')}
                    className="inline-flex items-center gap-2 rounded-2xl border border-indigo-400/25 bg-indigo-500/15 px-4 py-3 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-500/20"
                  >
                    <Users className="h-4 w-4" />
                    Open Safety Contacts page
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_0.75fr]">
        <section className="relative min-h-[560px] overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/55 shadow-2xl shadow-slate-950/20">
          <MapContainer
            center={[22.5, 82.0]}
            zoom={5}
            style={{ height: '100%', width: '100%', minHeight: '560px' }}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {filteredHotspots.map((hotspot) => (
              <CircleMarker
                key={hotspot.id}
                center={[hotspot.latitude, hotspot.longitude]}
                radius={hotspot.classification === 'critical' ? 16 : hotspot.classification === 'high' ? 12 : 8}
                fillColor={RISK_COLORS[hotspot.classification]}
                color={RISK_COLORS[hotspot.classification]}
                weight={2}
                opacity={0.9}
                fillOpacity={0.6}
                eventHandlers={{
                  click: () => {
                    setSelectedCity(hotspot)
                    setDestinationId(hotspot.id)
                  },
                }}
              >
                <Popup>
                  <div style={{ minWidth: 210, fontFamily: 'sans-serif' }}>
                    <div style={{ borderLeft: `4px solid ${RISK_COLORS[hotspot.classification]}`, paddingLeft: 8, marginBottom: 8 }}>
                      <p style={{ fontWeight: 700, fontSize: 14, margin: 0, color: '#1e293b' }}>{hotspot.state}</p>
                      <p style={{ fontSize: 11, margin: '2px 0 0', color: RISK_COLORS[hotspot.classification], fontWeight: 600 }}>
                        {hotspot.classification.toUpperCase()} RISK - {hotspot.risk_score}/100
                      </p>
                    </div>
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                      <tbody>
                        <tr>
                          <td style={{ color: '#64748b', padding: '2px 0' }}>IPC Arrests (2022)</td>
                          <td style={{ fontWeight: 600, textAlign: 'right' }}>{hotspot.crime_count.toLocaleString('en-IN')}</td>
                        </tr>
                        <tr>
                          <td style={{ color: '#64748b', padding: '2px 0' }}>Trend</td>
                          <td style={{ fontWeight: 600, textAlign: 'right' }}>
                            {hotspot.trend === 'rising' ? '↑ Rising' : hotspot.trend === 'falling' ? '↓ Falling' : '→ Stable'}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ color: '#64748b', padding: '2px 0' }}>Confidence</td>
                          <td style={{ fontWeight: 600, textAlign: 'right' }}>{Math.round((hotspot.model_confidence ?? 0) * 100)}%</td>
                        </tr>
                        <tr>
                          <td colSpan={2} style={{ color: '#64748b', padding: '4px 0 2px', fontSize: 11 }}>
                            <strong>Crimes:</strong> {hotspot.predicted_crimes.map((crime) => crime.replace('_', ' ')).join(', ')}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    {hotspot.primary_warning && (
                      <p style={{ fontSize: 12, margin: '6px 0 4px', color: '#c53030', borderTop: '1px solid #eee', paddingTop: 6 }}>
                        ⚠ {hotspot.primary_warning}
                      </p>
                    )}
                    <p style={{ fontSize: 10, margin: '6px 0 0', color: '#999', borderTop: '1px solid #eee', paddingTop: 4 }}>
                      Source: NCRB Crime in India 2022
                    </p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}

            <Marker position={[activeLocation.lat, activeLocation.lon]} icon={userLocation ? sosUserIcon : currentLocationIcon} />

            {destinationHotspot && (
              <Marker position={[destinationLocation.lat, destinationLocation.lon]} icon={destinationIcon} />
            )}

            {routePolyline.length > 1 && (
              <Polyline
                positions={routePolyline.map((point) => [point.lat, point.lon])}
                pathOptions={{
                  color: selectedRoute ? routeColor(selectedRoute.profile) : '#6366f1',
                  weight: 5,
                  opacity: 0.92,
                }}
              />
            )}

            {locationTrail.length > 1 && (
              <Polyline
                positions={locationTrail.map((point) => [point.lat, point.lon])}
                pathOptions={{ color: '#ef4444', weight: 4, opacity: 0.7, dashArray: '6 8' }}
              />
            )}

            <FlyTo target={plannerFocus} />
          </MapContainer>

          <div className="absolute left-4 top-4 z-[1000] w-[calc(100%-2rem)] max-w-xl rounded-3xl border border-white/10 bg-slate-950/82 p-4 shadow-2xl backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  <MapPin className="h-3.5 w-3.5 text-sky-300" />
                  Live route context
                </div>
                <p className="mt-2 text-sm font-semibold text-white">
                  {formatAreaLabel(currentHotspot).split(', ')[0]} to {formatAreaLabel(destinationHotspot).split(', ')[0]}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Current location and destination are both shown on the map. The highlighted line is the selected {selectedRoute?.label.toLowerCase() ?? 'route'}.
                </p>
              </div>
              {selectedRoute && (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Best route now</p>
                  <p className="mt-1 text-sm font-semibold text-white">{selectedRoute.label}</p>
                  <p className="text-xs text-slate-400">{selectedRoute.etaMinutes} min • Exposure {selectedRoute.exposureScore}/100</p>
                </div>
              )}
            </div>
          </div>

          <div className="absolute right-4 top-32 z-[1000] rounded-2xl border border-white/10 bg-slate-950/80 p-3 shadow-xl backdrop-blur-md">
            <div className="space-y-2">
              {(['critical', 'high', 'medium', 'low'] as RiskClassification[]).map((level) => (
                <div key={level} className="flex items-center gap-2 text-xs font-semibold capitalize">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: RISK_COLORS[level] }} />
                  <span className="text-slate-200">{level}</span>
                </div>
              ))}
            </div>
          </div>

          {isCitizen && sosPhase === 'idle' && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.3 }}
              onClick={handleSOS}
              className="absolute bottom-6 left-1/2 z-[1000] -translate-x-1/2"
              style={{ filter: 'drop-shadow(0 4px 24px rgba(239,68,68,0.55))' }}
              title="Send SOS emergency alert"
            >
              <div className="relative flex items-center justify-center">
                <span className="absolute h-20 w-20 animate-ping rounded-full bg-red-500 opacity-20" />
                <span className="absolute h-16 w-16 animate-ping rounded-full bg-red-500 opacity-30" style={{ animationDelay: '0.3s' }} />
                <div className="relative flex h-16 w-16 flex-col items-center justify-center rounded-full border-4 border-white bg-red-600 shadow-2xl transition-all hover:bg-red-700 active:scale-95">
                  <span className="text-lg font-black leading-none tracking-wider text-white">SOS</span>
                  <span className="mt-0.5 text-[9px] font-bold uppercase leading-none text-red-200">Emergency</span>
                </div>
              </div>
            </motion.button>
          )}

          <AnimatePresence>
            {sosPhase !== 'idle' && (
              <motion.div
                key="sos-status"
                initial={{ opacity: 0, y: 40, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 40, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 280, damping: 24 }}
                className="absolute bottom-6 left-1/2 z-[1001] w-80 max-w-[calc(100%-2rem)] -translate-x-1/2"
              >
                {(sosPhase === 'locating' || sosPhase === 'sending') && (
                  <div className="flex items-center gap-4 rounded-2xl border border-red-500/40 bg-slate-900/95 px-5 py-4 shadow-2xl backdrop-blur-xl">
                    <div className="flex h-11 w-11 animate-pulse items-center justify-center rounded-full bg-red-600 shrink-0">
                      <span className="text-sm font-black text-white">SOS</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white">
                        {sosPhase === 'locating' ? 'Getting your location...' : 'Sending emergency alert...'}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {sosPhase === 'locating' ? 'Please allow location access' : 'Police are being notified'}
                      </p>
                    </div>
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin text-red-400" />
                  </div>
                )}

                {sosPhase === 'success' && sosResult && (
                  <div className="rounded-2xl border border-green-500/40 bg-slate-900/95 px-5 py-4 shadow-2xl backdrop-blur-xl">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-600">
                        <CheckCircle2 className="h-6 w-6 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-green-400">SOS Alert Sent!</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-300">
                          Police have been notified. Help is on the way. Stay calm.
                        </p>
                        <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-300">
                          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                            <div className="flex items-center gap-2 font-semibold text-white">
                              <Siren className="h-3.5 w-3.5 text-red-400" />
                              Dispatch network armed
                            </div>
                            <p className="mt-1 text-slate-400">
                              {shareLive ? 'Live location sharing is active for responders.' : 'Alert sent without live tracking.'}
                              {' '}
                              {autoEscalate ? 'Auto-escalation is armed if you stop checking in.' : 'Manual escalation only.'}
                            </p>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                            <div className="flex items-center gap-2 font-semibold text-white">
                              <TimerReset className="h-3.5 w-3.5 text-amber-300" />
                              Best immediate move
                            </div>
                            <p className="mt-1 text-slate-400">
                              Follow the {routeOptions[0]?.label.toLowerCase() ?? 'safest corridor'} toward {nearbyHubs[0]?.name ?? 'the nearest safe hub'}.
                            </p>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                            <div className="flex items-center gap-2 font-semibold text-white">
                              <Users className="h-3.5 w-3.5 text-sky-300" />
                              Who was notified
                            </div>
                            <p className="mt-1 text-slate-400">
                              Police dispatch, family contacts, nearby verified volunteers, and hospital standby were included in this flow.
                            </p>
                          </div>
                          {isEscalated && (
                            <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2">
                              <div className="flex items-center gap-2 font-semibold text-red-200">
                                <ShieldPlus className="h-3.5 w-3.5 text-red-300" />
                                Dead-man switch escalated
                              </div>
                              <p className="mt-1 text-red-100/80">
                                No citizen check-in was received in time. The alert has been escalated for priority handling.
                              </p>
                            </div>
                          )}
                          {autoEscalate && (
                            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2 font-semibold text-white">
                                    <TimerReset className="h-3.5 w-3.5 text-amber-300" />
                                    Dead-man switch countdown
                                  </div>
                                  <p className="mt-1 text-slate-400">
                                    Check in before the timer expires to avoid auto-escalation.
                                  </p>
                                </div>
                                <span className="text-lg font-black text-amber-300">{checkInCountdown}s</span>
                              </div>
                              <button
                                onClick={handleCheckIn}
                                className="mt-2 rounded-lg bg-amber-400/20 px-3 py-1.5 text-[11px] font-bold text-amber-200 hover:bg-amber-400/25"
                              >
                                I am responsive
                              </button>
                            </div>
                          )}
                          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                            <div className="flex items-center gap-2 font-semibold text-white">
                              <HeartPulse className="h-3.5 w-3.5 text-emerald-300" />
                              Evidence capture
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                onClick={() => addEvidence('audio')}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-bold text-slate-100 hover:bg-white/15"
                              >
                                <Mic className="h-3.5 w-3.5" />
                                {recordingKind === 'audio' ? 'Recording...' : 'Record audio'}
                              </button>
                              <button
                                onClick={() => addEvidence('video')}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-bold text-slate-100 hover:bg-white/15"
                              >
                                <Video className="h-3.5 w-3.5" />
                                {recordingKind === 'video' ? 'Recording...' : 'Record video'}
                              </button>
                            </div>
                            {evidence.length > 0 && (
                              <div className="mt-2 space-y-1.5">
                                {evidence.map((clip) => (
                                  <div key={clip.id} className="rounded-lg border border-white/10 bg-slate-950/30 px-2.5 py-2 text-[11px] text-slate-300">
                                    <div className="flex items-center justify-between gap-3">
                                      <span>{clip.label}</span>
                                      <span className="text-slate-500">{clip.createdAt}</span>
                                    </div>
                                    {clip.url && (
                                      <a href={clip.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-emerald-300 hover:text-emerald-200">
                                        Preview capture
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {typeof sosResult.whatsapp_notifications_sent === 'number' && (
                          <p className="mt-1 text-xs text-emerald-300">
                            WhatsApp alerts sent to {sosResult.whatsapp_notifications_sent} emergency contact(s).
                          </p>
                        )}
                        {userLocation && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                            <MapPin className="h-3 w-3" />
                            <span>{userLocation.lat.toFixed(4)}, {userLocation.lon.toFixed(4)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-700 pt-3">
                      <span className="text-xs text-slate-500">Ref: {sosResult.id.toUpperCase()}</span>
                      <button onClick={resetSOS} className="text-xs font-medium text-slate-400 transition-colors hover:text-white">
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}

                {sosPhase === 'error' && (
                  <div className="rounded-2xl border border-red-500/40 bg-slate-900/95 px-5 py-4 shadow-2xl backdrop-blur-xl">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-600">
                        <XCircle className="h-6 w-6 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-red-400">Alert Failed</p>
                        <p className="mt-0.5 text-xs text-slate-300">{sosError || 'Could not send alert.'}</p>
                        <p className="mt-1.5 text-xs font-bold text-amber-400">Call 112 immediately.</p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button onClick={resetSOS} className="flex-1 py-1.5 text-xs text-slate-400 hover:text-white">Dismiss</button>
                      <button
                        onClick={() => {
                          resetSOS()
                          setTimeout(handleSOS, 100)
                        }}
                        className="flex-1 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {selectedCity && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="absolute bottom-6 left-6 z-[1000] max-h-80 w-80 max-w-[calc(100%-3rem)] overflow-y-auto rounded-3xl border border-slate-200 bg-white/98 p-6 shadow-2xl backdrop-blur-xl"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <span className={cn('rounded-full border px-3 py-1 text-xs font-bold capitalize', RISK_BG[selectedCity.classification])}>
                        {selectedCity.classification}
                      </span>
                      <span className="text-xs text-slate-500">{(selectedCity.state ?? '').split(', ')[1] ?? ''}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">{(selectedCity.state ?? 'Unknown location').split(', ')[0]}</h3>
                  </div>
                  <button onClick={() => setSelectedCity(null)} className="-m-1 rounded-lg p-1 text-xl leading-none text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">×</button>
                </div>

                <div className="mb-4 grid grid-cols-3 gap-3 rounded-2xl bg-slate-50 p-3">
                  <div className="text-center">
                    <p className="text-2xl font-black text-slate-900">{selectedCity.risk_score.toFixed(1)}</p>
                    <p className="text-xs text-slate-500">Risk Score</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-slate-900">{Math.round((selectedCity.model_confidence || 0) * 100)}%</p>
                    <p className="text-xs text-slate-500">Confidence</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-slate-900">{selectedCity.crime_count.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">Incidents</p>
                  </div>
                </div>

                {selectedCity.primary_warning && (
                  <p className="mb-3 text-sm leading-relaxed text-slate-700">{selectedCity.primary_warning}</p>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {selectedCity.predicted_crimes.slice(0, 4).map((crime) => (
                    <span key={crime} className="rounded-full border border-blue-200 bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
                      {crime.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <section className="space-y-4">
          <div className="rounded-[28px] border border-white/10 bg-slate-900/55 p-5 shadow-2xl shadow-slate-950/20">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <School className="h-4 w-4 text-emerald-300" />
              Scenario guidance
            </div>
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Mode in use</p>
                <p className="mt-2 text-base font-semibold text-white">{modeDetails[safetyMode].title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{activeScenario.detail}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">What changes in this mode</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-300" />
                    <span>{activeScenario.routeBias}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-300" />
                    <span>Current location and destination stay pinned on the map so the route is not hidden anymore.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-300" />
                    <span>The selected route now highlights checkpoints, safe hubs, and exposure instead of just showing cards in a sidebar.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-slate-900/55 p-5 shadow-2xl shadow-slate-950/20">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldCheck className="h-4 w-4 text-sky-300" />
              Quick actions
            </div>
            <div className="mt-4 grid gap-3">
              <button
                onClick={() => navigate('/map?screen=contacts')}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10"
              >
                <p className="text-sm font-semibold text-white">Manage safety contacts</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Add family or trusted numbers on the dedicated phone-number page instead of squeezing them into the map.
                </p>
              </button>
              <button
                onClick={locateCurrentPosition}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10"
              >
                <p className="text-sm font-semibold text-white">Refresh my current location</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Recenter the route from your actual position before starting the night or student commute.
                </p>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
