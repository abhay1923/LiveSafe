import { AlertCircle, MessageCircleMore, PhoneCall, ShieldCheck, UserRoundPlus } from 'lucide-react'
import EmergencyContactsCard from '@/components/EmergencyContactsCard'

export default function SafetyContactsPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 shadow-2xl shadow-slate-950/20">
        <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="border-b border-white/10 bg-gradient-to-br from-emerald-500/20 via-emerald-500/5 to-transparent p-6 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
              <PhoneCall className="h-3.5 w-3.5" />
              Safety Contacts
            </div>
            <h1 className="mt-3 text-3xl font-bold text-white">Add the people your SOS should reach</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              This is the dedicated phone-number page the citizen flow needed. Keep trusted contacts here, and the SOS network can include family or friends without crowding the map or route planner.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <ShieldCheck className="h-4 w-4 text-emerald-300" />
                  Better SOS flow
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  When SOS is triggered, these contacts can be included alongside police and emergency responders.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <UserRoundPlus className="h-4 w-4 text-sky-300" />
                  Add trusted people
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Parents, roommates, close friends, guardians, or anyone who should know where you are.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <MessageCircleMore className="h-4 w-4 text-pink-300" />
                  WhatsApp-ready
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Use full numbers with country code so the alert flow has something usable.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="rounded-3xl border border-amber-400/15 bg-amber-500/10 p-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                <div>
                  <p className="text-sm font-semibold text-amber-100">Suggested contact mix</p>
                  <ul className="mt-3 space-y-2 text-sm text-amber-50/80">
                    <li>1 family member who will answer quickly</li>
                    <li>1 nearby friend, roommate, or classmate</li>
                    <li>1 backup contact outside your immediate area</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-white">How this connects with the rest of the app</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                <li>Citizen map and route planner now stay focused on navigation and safety scenarios.</li>
                <li>Contacts live here on their own page, so the phone-number form has room and does not feel squeezed.</li>
                <li>During SOS, the app still includes these contacts in the broader safety network.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-slate-900/55 p-6 shadow-2xl shadow-slate-950/20">
        <EmergencyContactsCard
          title="Trusted Phone Numbers"
          description="Add the people who should receive SOS updates. This screen is dedicated to phone numbers so the citizen route planner stays clean."
        />
      </section>
    </div>
  )
}
