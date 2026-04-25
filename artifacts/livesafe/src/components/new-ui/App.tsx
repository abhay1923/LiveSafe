import React, { useState, useEffect } from 'react'
import {
  Shield, LayoutDashboard, Map as MapIcon, Zap,
  BarChart3, Settings, LogOut, Search, Bell, Menu, X,
  AlertTriangle, Siren, Activity, Brain, Users, PhoneCall,
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/app/hooks/useAuth'
import type { Screen, UserRole } from '@/types'

import HotspotMap from '@/components/HotspotMapNew'
import Dashboard from '@/components/new-ui/Dashboard'
import Simulation from '@/components/new-ui/Simulation'
import Reports from '@/components/new-ui/Reports'
import SettingsPage from '@/components/new-ui/SettingsPage'
import SafetyContactsPage from '@/components/new-ui/SafetyContactsPage'

interface NavItemConfig {
  icon: React.ReactNode
  label: string
  key: Screen
  roles: UserRole[]
  route?: string
}

const ALL_NAV_ITEMS: NavItemConfig[] = [
  { icon: <LayoutDashboard />, label: 'Dashboard',         key: 'dashboard',  roles: ['citizen', 'police', 'admin'] },
  { icon: <MapIcon />,         label: 'Map Analysis',      key: 'hotspot',    roles: ['citizen', 'police', 'admin'] },
  { icon: <Zap />,             label: 'Prediction Models', key: 'simulation', roles: ['citizen', 'police', 'admin'] },
  { icon: <BarChart3 />,       label: 'Reports',           key: 'reports',    roles: ['citizen', 'police', 'admin'] },
  { icon: <PhoneCall />,       label: 'Safety Contacts',   key: 'contacts',   roles: ['citizen'] },
  { icon: <AlertTriangle />,   label: 'Report Incident',   key: 'report',     roles: ['citizen'],             route: '/report' },
  { icon: <Siren />,           label: 'SOS Alerts',        key: 'sos',        roles: ['police', 'admin'],     route: '/sos' },
  { icon: <Activity />,        label: 'Analytics',         key: 'analytics',  roles: ['police', 'admin'],     route: '/analytics' },
  { icon: <Brain />,           label: 'ML Dashboard',      key: 'ml',         roles: ['admin'],               route: '/ml' },
  { icon: <Users />,           label: 'User Management',   key: 'users',      roles: ['admin'],               route: '/users' },
]

const ROLE_LABELS: Record<UserRole, string> = {
  citizen: 'Citizen',
  police:  'Police Officer',
  admin:   'Administrator',
  super_admin: 'Super Admin',
}

const ROLE_COLORS: Record<UserRole, string> = {
  citizen: '#22c55e',
  police:  '#38bdf8',
  admin:   '#f59e0b',
  super_admin: '#a855f7',
}

type InternalScreen = 'dashboard' | 'hotspot' | 'simulation' | 'reports' | 'contacts' | 'settings'

export default function NewApp() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [screen, setScreen] = useState<InternalScreen>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => { setScreen('dashboard') }, [user?.id])
  useEffect(() => { setMobileOpen(false) }, [screen])
  useEffect(() => {
    const screenParam = new URLSearchParams(location.search).get('screen')
    if (screenParam === 'dashboard' || screenParam === 'hotspot' || screenParam === 'simulation' || screenParam === 'reports' || screenParam === 'contacts' || screenParam === 'settings') {
      setScreen(screenParam)
    }
  }, [location.search])

  const role = user?.role ?? 'citizen'
  const nav = ALL_NAV_ITEMS.filter(item => item.roles.includes(role))
  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'
  const roleColor = ROLE_COLORS[role]

  const handleNavClick = (item: NavItemConfig) => {
    if (item.route) navigate(item.route)
    else {
      const nextScreen = item.key as InternalScreen
      setScreen(nextScreen)
      navigate(`/map?screen=${nextScreen}`)
    }
  }

  const renderScreen = () => {
    switch (screen) {
      case 'dashboard':  return <Dashboard />
      case 'hotspot':    return <HotspotMap />
      case 'simulation': return <Simulation />
      case 'reports':    return <Reports />
      case 'contacts':   return <SafetyContactsPage />
      case 'settings':   return <SettingsPage />
      default:           return <Dashboard />
    }
  }

  const expanded = isMobile ? true : sidebarOpen
  const showSidebar = isMobile ? mobileOpen : true

  const screenTitles: Record<InternalScreen, string> = {
    dashboard: 'Dashboard',
    hotspot: 'Map Analysis',
    simulation: 'Prediction Models',
    reports: 'Reports & Analytics',
    contacts: 'Safety Contacts',
    settings: 'Settings',
  }

  return (
    <div
      className="flex h-screen overflow-hidden font-sans text-slate-100"
      style={{
        background:
          'radial-gradient(1200px 600px at 10% -10%, rgba(99,102,241,0.18), transparent 60%),' +
          'radial-gradient(900px 500px at 110% 10%, rgba(56,189,248,0.10), transparent 60%),' +
          'linear-gradient(180deg, #0b1023 0%, #0a0e1f 100%)',
      }}
    >
      {/* Mobile backdrop */}
      <AnimatePresence>
        {isMobile && mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence>
        {showSidebar && (
          <motion.aside
            key="sidebar"
            initial={isMobile ? { x: -300 } : false}
            animate={{
              x: 0,
              width: isMobile ? 280 : (expanded ? 264 : 80),
            }}
            exit={isMobile ? { x: -300 } : undefined}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            className={cn(
              'flex flex-col z-50 shrink-0 overflow-hidden border-r border-white/5',
              isMobile ? 'fixed inset-y-0 left-0' : 'relative',
            )}
            style={{
              background: 'linear-gradient(180deg, rgba(15,23,42,0.95) 0%, rgba(10,14,31,0.98) 100%)',
              backdropFilter: 'blur(20px)',
            }}
          >
            {/* Logo */}
            <div className="p-5 flex items-center gap-3 border-b border-white/5 shrink-0">
              <div
                className="p-2.5 rounded-xl shrink-0 shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  boxShadow: '0 8px 24px rgba(99,102,241,0.35)',
                }}
              >
                <Shield className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              {expanded && (
                <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
                  <p className="font-bold text-base leading-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                    LiveSafe
                  </p>
                  <p className="text-[10px] text-slate-500 leading-tight tracking-wider mt-0.5">
                    CRIMEPREDICT AI · v5
                  </p>
                </motion.div>
              )}
              {isMobile && (
                <button
                  onClick={() => setMobileOpen(false)}
                  className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Role badge */}
            {expanded && user && (
              <motion.div
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className="mx-3 mt-4 px-3.5 py-2.5 rounded-2xl border relative overflow-hidden"
                style={{
                  borderColor: roleColor + '33',
                  background: `linear-gradient(135deg, ${roleColor}18 0%, ${roleColor}05 100%)`,
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: roleColor }} />
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: roleColor }}>
                    {ROLE_LABELS[role]}
                  </p>
                </div>
                <p className="text-sm text-slate-200 truncate mt-1 font-medium">{user.name}</p>
              </motion.div>
            )}

            {/* Nav */}
            <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
              {expanded && (
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-3 pb-2 pt-1">
                  Navigation
                </p>
              )}
              {nav.map(item => (
                <NavItemButton
                  key={item.key}
                  icon={item.icon}
                  label={item.label}
                  active={!item.route && screen === (item.key as InternalScreen)}
                  collapsed={!expanded}
                  onClick={() => handleNavClick(item)}
                  isExternal={Boolean(item.route)}
                />
              ))}
            </nav>

            {/* Footer */}
            <div className="p-3 border-t border-white/5 space-y-1 shrink-0">
              <NavItemButton
                icon={<Settings />}
                label="Settings"
                collapsed={!expanded}
                onClick={() => {
                  setScreen('settings')
                  navigate('/map?screen=settings')
                }}
                active={screen === 'settings'}
              />
              <NavItemButton
                icon={<LogOut />}
                label="Log Out"
                collapsed={!expanded}
                onClick={logout}
                danger
              />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Topbar */}
        <header
          className="h-16 flex items-center justify-between px-4 sm:px-6 shrink-0 border-b border-white/5"
          style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(16px)' }}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={() => isMobile ? setMobileOpen(true) : setSidebarOpen(v => !v)}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-white"
              aria-label="Toggle sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="hidden sm:block">
              <h1 className="text-sm font-semibold text-white leading-none">
                {screenTitles[screen]}
              </h1>
              <p className="text-[11px] text-slate-500 mt-1 leading-none">
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>

            <div className="relative max-w-md w-full hidden md:block ml-auto mr-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search cities, incidents, reports…"
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/5 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button className="relative p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-white">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-slate-900" />
            </button>
            <div className="h-8 w-px bg-white/10 mx-0.5 hidden sm:block" />
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-white leading-none">
                  {user?.name ?? 'Guest'}
                </p>
                <p className="text-[11px] mt-1 font-medium leading-none" style={{ color: roleColor }}>
                  {ROLE_LABELS[role]}
                </p>
              </div>
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${roleColor} 0%, ${roleColor}cc 100%)`,
                  boxShadow: `0 4px 16px ${roleColor}44`,
                }}
              >
                {initials}
              </div>
            </div>
          </div>
        </header>

        {/* Screen */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={screen}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="min-h-full"
            >
              {renderScreen()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

function NavItemButton({
  icon, label, active = false, onClick, collapsed = false, isExternal = false, danger = false,
}: {
  icon: React.ReactNode; label: string; active?: boolean
  onClick?: () => void; collapsed?: boolean; isExternal?: boolean; danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        'relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group',
        active
          ? 'text-white'
          : danger
            ? 'text-slate-500 hover:bg-red-500/10 hover:text-red-400'
            : 'text-slate-400 hover:bg-white/5 hover:text-white',
      )}
      style={
        active
          ? {
              background: 'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(139,92,246,0.18) 100%)',
              boxShadow: '0 4px 16px rgba(99,102,241,0.2), inset 0 1px 0 rgba(255,255,255,0.08)',
            }
          : undefined
      }
    >
      {active && (
        <motion.span
          layoutId="active-pill"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
          style={{ background: 'linear-gradient(180deg, #818cf8, #6366f1)' }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
      <div className="shrink-0">
        {React.isValidElement<{ className?: string }>(icon)
          ? React.cloneElement(icon, { className: 'w-5 h-5' })
          : icon}
      </div>
      {!collapsed && (
        <span className="font-medium text-sm whitespace-nowrap flex-1 text-left">{label}</span>
      )}
      {!collapsed && isExternal && (
        <span className="text-[10px] opacity-40 group-hover:opacity-80 transition-opacity">↗</span>
      )}
    </button>
  )
}
