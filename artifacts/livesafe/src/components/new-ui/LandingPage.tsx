import React from 'react'
import { Shield, Zap, Map as MapIcon, Bell, ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'

export default function LandingPage({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <nav className="max-w-7xl mx-auto px-6 pt-6">
        <div className="bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl px-6 py-3.5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" />
            <span className="font-bold text-xl text-slate-900 tracking-tight">LiveSafe AI</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Features</a>
            <a href="#about" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">About</a>
            <button className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Login</button>
            <button
              onClick={onGetStarted}
              className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <main className="max-w-7xl mx-auto px-6 pt-20 pb-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 text-xs font-bold text-blue-600 mb-6">
              Powered by XGBoost + LightGBM Ensemble
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900 leading-[1.1] tracking-tight">
              Secure Your Community with{' '}
              <span className="text-blue-600">AI-Powered</span> Crime Prediction.
            </h1>
            <p className="mt-6 text-xl text-slate-600 leading-relaxed max-w-xl">
              Proactive safety through advanced data analysis. Anticipate risks before they happen with our state-of-the-art predictive engine trained on 23 years of NCRB data.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <button onClick={onGetStarted} className="bg-blue-600 text-white px-8 py-4 rounded-2xl text-lg font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 flex items-center gap-2">
                Get Started Now <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.2 }} className="relative hidden lg:block">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <p className="font-bold text-slate-800">Live Risk Overview</p>
                <span className="flex items-center gap-1 text-xs font-bold text-green-600">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  Live
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-lg font-black text-slate-900">73</p>
                  <p className="text-xs text-slate-500">Delhi Risk</p>
                </div>
                <div>
                  <p className="text-lg font-black text-slate-900">116</p>
                  <p className="text-xs text-slate-500">Cities</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
