import React, { useState } from 'react'
import { User, Database, Bell, Users, FileText, Key, Settings as SettingsIcon, Edit2, Trash2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { icon: <User />,         label: 'Profile' },
  { icon: <Database />,     label: 'Data Sources' },
  { icon: <Bell />,         label: 'Notifications' },
  { icon: <Users />,        label: 'Team Permissions' },
  { icon: <FileText />,     label: 'System Logs' },
  { icon: <Key />,          label: 'API Keys' },
  { icon: <SettingsIcon />, label: 'General' },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('Profile')

  return (
    <div className="h-full flex lg:flex-row gap-6 bg-slate-50">
      {/* Sidebar */}
      <div className="w-full lg:w-64 bg-white rounded-3xl border shadow-sm p-6 lg:p-8 space-y-2">
        {NAV_ITEMS.map(item => (
          <button
            key={item.label}
            onClick={() => setActiveTab(item.label)}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all',
              activeTab === item.label ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            )}
          >
            {React.cloneElement(item.icon as React.ReactElement, { className: 'w-5 h-5' })}
            {item.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {activeTab === 'Profile' && (
          <div className="bg-white rounded-3xl border shadow-sm p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Profile Settings</h2>
            {/* Profile content */}
            <p>Profile management placeholder</p>
          </div>
        )}
        {activeTab === 'Notifications' && (
          <div className="bg-white rounded-3xl border shadow-sm p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Notifications</h2>
            {/* Notifications content */}
            <p>Notification settings placeholder</p>
          </div>
        )}
        {/* Add other tabs */}
      </div>
    </div>
  )
}
