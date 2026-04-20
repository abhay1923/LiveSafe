import React, { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  // Explicit class field declaration — required for strict TS when node_modules absent
  declare state: State
  declare props: Readonly<Props> & Readonly<{ children?: ReactNode }>

  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo })
    console.error('[LiveSafe] Uncaught render error:', error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
          color: '#e2e8f0', fontFamily: 'system-ui, sans-serif',
          padding: '2rem', textAlign: 'center',
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🛡️</div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem', color: '#f1f5f9' }}>
            LiveSafe — Unexpected Error
          </h1>
          <p style={{ color: '#94a3b8', maxWidth: '480px', marginBottom: '2rem', lineHeight: 1.6 }}>
            Something went wrong while rendering. Please try refreshing the page.
          </p>
          {import.meta.env.DEV && this.state.error && (
            <pre style={{
              background: '#1e293b', border: '1px solid #334155', borderRadius: '8px',
              padding: '1rem', maxWidth: '600px', width: '100%', textAlign: 'left',
              overflow: 'auto', fontSize: '0.75rem', color: '#f87171', marginBottom: '1.5rem',
            }}>
              {this.state.error.toString()}
              {'\n\n'}
              {this.state.errorInfo?.componentStack}
            </pre>
          )}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={this.handleReset} style={{
              background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px',
              padding: '0.75rem 1.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
            }}>
              Try Again
            </button>
            <button onClick={() => window.location.assign('/')} style={{
              background: 'transparent', color: '#94a3b8', border: '1px solid #334155',
              borderRadius: '8px', padding: '0.75rem 1.5rem', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.9rem',
            }}>
              Go to Home
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
