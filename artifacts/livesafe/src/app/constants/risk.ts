// Display colours for risk classifications. Values are presentation only;
// all risk data itself comes from the API.
export const RISK_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
}

export const RISK_BG: Record<string, string> = {
  critical: 'bg-red-50 text-red-600 border-red-100',
  high: 'bg-orange-50 text-orange-600 border-orange-100',
  medium: 'bg-yellow-50 text-yellow-600 border-yellow-100',
  low: 'bg-green-50 text-green-600 border-green-100',
}
