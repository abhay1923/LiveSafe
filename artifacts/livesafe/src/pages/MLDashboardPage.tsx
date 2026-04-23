import { useState } from 'react'
import { useApi } from '@/app/hooks/useApi'
import { api } from '@/app/services/api'
import AppLayout from '@/components/layout/AppLayout'
import { RadialBarChart, RadialBar, ResponsiveContainer, Tooltip } from 'recharts'
import { Brain, RefreshCw, CheckCircle, AlertTriangle, Database, Cpu, Loader2 } from 'lucide-react'

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="metric-bar">
      <div className="metric-bar-header">
        <span className="metric-label">{label}</span>
        <span className="metric-value" style={{ color }}>{(value * 100).toFixed(1)}%</span>
      </div>
      <div className="metric-track">
        <div
          className="metric-fill"
          style={{ width: `${value * 100}%`, background: color }}
        />
      </div>
    </div>
  )
}

export default function MLDashboardPage() {
  const { data: metrics, isLoading, error, refetch } = useApi((sig) => api.getMLMetrics(sig))
  const [retraining, setRetraining] = useState(false)
  const [retrainMsg, setRetrainMsg] = useState('')

  const handleRetrain = async () => {
    setRetraining(true)
    setRetrainMsg('')
    try {
      const res = await api.retrainModel()
      setRetrainMsg(`✅ ${res.message} (Job ID: ${res.job_id})`)
    } catch (err) {
      setRetrainMsg(`❌ ${err instanceof Error ? err.message : 'Retrain failed.'}`)
    } finally {
      setRetraining(false)
      setTimeout(() => refetch(), 3000)
    }
  }

  const radialData = metrics
    ? [
        { name: 'Accuracy',  value: Math.round(metrics.accuracy * 100),  fill: '#6366f1' },
        { name: 'Precision', value: Math.round(metrics.precision * 100), fill: '#22c55e' },
        { name: 'Recall',    value: Math.round(metrics.recall * 100),    fill: '#f59e0b' },
        { name: 'F1 Score',  value: Math.round(metrics.f1_score * 100),  fill: '#38bdf8' },
      ]
    : []

  return (
    <AppLayout title="ML Dashboard" subtitle="Model performance, retraining, and prediction engine">
      <div className="ml-page">
        {isLoading && (
          <div className="ml-loading">
            <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
            <span>Loading model metrics…</span>
          </div>
        )}

        {error && (
          <div className="ml-error">
            <AlertTriangle size={20} color="#ef4444" />
            Failed to load ML metrics. Please try again.
          </div>
        )}

        {metrics && (
          <>
            {/* Model info banner */}
            <div className="model-banner">
              <div className="model-banner-left">
                <div className="model-icon"><Brain size={24} color="#818cf8" /></div>
                <div>
                  <div className="model-name">Crime Prediction Model</div>
                  <div className="model-meta">
                    Version {metrics.model_version} ·{' '}
                    Trained on {metrics.sample_count.toLocaleString('en-IN')} samples ·{' '}
                    Last trained {new Date(metrics.last_trained).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>
              <button
                className="btn btn-primary retrain-btn"
                onClick={handleRetrain}
                disabled={retraining}
              >
                {retraining
                  ? <><Loader2 size={15} className="spin" /> Queuing Retrain…</>
                  : <><RefreshCw size={15} /> Retrain Model</>
                }
              </button>
            </div>

            {retrainMsg && (
              <div className={`retrain-msg ${retrainMsg.startsWith('✅') ? 'success' : 'fail'}`}>
                {retrainMsg}
              </div>
            )}

            {/* Metrics grid */}
            <div className="ml-grid">
              {/* Radial chart */}
              <div className="ml-card radial-card">
                <h3>Model Performance Overview</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <RadialBarChart
                    cx="50%" cy="50%"
                    innerRadius={30} outerRadius={100}
                    data={radialData}
                    startAngle={90} endAngle={-270}
                  >
                    <RadialBar
                      background={{ fill: '#0f172a' }}
                      dataKey="value"
                      label={{ position: 'insideStart', fill: '#f1f5f9', fontSize: 10, fontWeight: 700 }}
                    />
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => [`${v}%`]}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="radial-legend">
                  {radialData.map((d) => (
                    <div key={d.name} className="radial-legend-item">
                      <div className="radial-dot" style={{ background: d.fill }} />
                      <span>{d.name}</span>
                      <strong style={{ color: d.fill }}>{d.value}%</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Metric bars */}
              <div className="ml-card metrics-card">
                <h3>Detailed Metrics</h3>
                <div className="metrics-bars">
                  <MetricBar label="Accuracy"  value={metrics.accuracy}  color="#6366f1" />
                  <MetricBar label="Precision" value={metrics.precision} color="#22c55e" />
                  <MetricBar label="Recall"    value={metrics.recall}    color="#f59e0b" />
                  <MetricBar label="F1 Score"  value={metrics.f1_score}  color="#38bdf8" />
                </div>
                <div className="metrics-footer">
                  <div className="metrics-footer-item">
                    <Database size={14} color="#64748b" />
                    <span>Training samples: <strong>{metrics.sample_count.toLocaleString('en-IN')}</strong></span>
                  </div>
                  <div className="metrics-footer-item">
                    <Cpu size={14} color="#64748b" />
                    <span>Algorithm: <strong>{metrics.algorithm ?? 'XGBoost + LightGBM + RandomForest Ensemble'}</strong></span>
                  </div>
                  <div className="metrics-footer-item">
                    <CheckCircle size={14} color="#22c55e" />
                    <span>Status: <strong style={{ color: '#22c55e' }}>Operational</strong></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Model info cards */}
            <div className="model-info-grid">
              <div className="model-info-card">
                <div className="info-icon" style={{ background: 'rgba(99,102,241,0.12)' }}>📊</div>
                <div className="info-title">Dataset Source</div>
                <div className="info-desc">Official NCRB-derived India city crime data, retrained on the 2020-2023 published window used by the app&apos;s v5 hotspot model</div>
              </div>
              <div className="model-info-card">
                <div className="info-icon" style={{ background: 'rgba(34,197,94,0.12)' }}>🎯</div>
                <div className="info-title">Feature Engineering</div>
                <div className="info-desc">City crime rates, trend signals, spatial clusters, socio-economic proxies, and chargesheet-rate features</div>
              </div>
              <div className="model-info-card">
                <div className="info-icon" style={{ background: 'rgba(245,158,11,0.12)' }}>🔄</div>
                <div className="info-title">Retraining Schedule</div>
                <div className="info-desc">Manual retraining is available now; automated refresh should only be enabled when a real backend training job is connected</div>
              </div>
              <div className="model-info-card">
                <div className="info-icon" style={{ background: 'rgba(56,189,248,0.12)' }}>🛡️</div>
                <div className="info-title">Prediction Latency</div>
                <div className="info-desc">Local fallback inference is instant in the browser; backend latency depends on whether a production ML service is connected</div>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        .ml-page { display: flex; flex-direction: column; gap: 1.25rem; }
        .ml-loading, .ml-error {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          padding: 3rem;
          color: #94a3b8;
          font-size: 0.9rem;
        }
        .model-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          background: rgba(99,102,241,0.08);
          border: 1px solid rgba(129,140,248,0.2);
          border-radius: 12px;
          padding: 1.1rem 1.25rem;
          flex-wrap: wrap;
        }
        .model-banner-left { display: flex; align-items: center; gap: 0.85rem; }
        .model-icon {
          width: 48px;
          height: 48px;
          background: rgba(99,102,241,0.15);
          border: 1.5px solid rgba(129,140,248,0.3);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .model-name { font-size: 1rem; font-weight: 700; color: #f1f5f9; }
        .model-meta { font-size: 0.76rem; color: #64748b; margin-top: 3px; }
        .retrain-btn { white-space: nowrap; }
        .retrain-msg {
          padding: 0.7rem 1rem;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 500;
        }
        .retrain-msg.success { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.25); color: #86efac; }
        .retrain-msg.fail    { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); color: #f87171; }
        .ml-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1rem;
        }
        .ml-card {
          background: #1e293b;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 1.25rem;
        }
        .ml-card h3 { margin: 0 0 1rem; font-size: 0.9rem; font-weight: 700; color: #f1f5f9; }
        .radial-legend {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.5rem;
          margin-top: 0.5rem;
        }
        .radial-legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.78rem;
          color: #94a3b8;
        }
        .radial-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
        .radial-legend-item strong { margin-left: auto; font-size: 0.8rem; }
        .metrics-bars { display: flex; flex-direction: column; gap: 1rem; }
        .metric-bar { display: flex; flex-direction: column; gap: 6px; }
        .metric-bar-header { display: flex; justify-content: space-between; }
        .metric-label { font-size: 0.8rem; color: #94a3b8; font-weight: 500; }
        .metric-value { font-size: 0.85rem; font-weight: 700; }
        .metric-track {
          height: 6px;
          background: rgba(255,255,255,0.06);
          border-radius: 9999px;
          overflow: hidden;
        }
        .metric-fill {
          height: 100%;
          border-radius: 9999px;
          transition: width 1s ease;
        }
        .metrics-footer {
          margin-top: 1.25rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(255,255,255,0.05);
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .metrics-footer-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.78rem;
          color: #64748b;
        }
        .metrics-footer-item strong { color: #94a3b8; }
        .model-info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 0.85rem;
        }
        .model-info-card {
          background: #1e293b;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .info-icon {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.1rem;
          flex-shrink: 0;
        }
        .info-title { font-size: 0.85rem; font-weight: 700; color: #f1f5f9; }
        .info-desc  { font-size: 0.76rem; color: #64748b; line-height: 1.5; }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>
    </AppLayout>
  )
}
