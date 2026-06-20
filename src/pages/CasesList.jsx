import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listCases } from '../lib/db.js'
import { CASE_STATUS } from '../lib/constants.js'

export default function CasesList() {
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const data = await listCases()
        if (alive) setCases(data)
      } catch (e) {
        if (alive) setError(e.message || 'Failed to load cases')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="stack">
      <div className="row">
        <h1 style={{ fontSize: 24 }}>Cases</h1>
        <div className="spacer" />
        <Link className="btn btn-primary" to="/cases/new">
          + New case
        </Link>
      </div>

      {error && <div className="error-text">{error}</div>}

      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 60 }}>
          <div className="spinner spinner-ink" />
        </div>
      ) : cases.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <p className="muted" style={{ marginTop: 0 }}>
            No cases yet. Create your first case to begin.
          </p>
          <Link className="btn btn-primary" to="/cases/new">
            + New case
          </Link>
        </div>
      ) : (
        <div className="card">
          {cases.map((c, i) => {
            const target =
              c.status === CASE_STATUS.INTAKE
                ? `/cases/${c.case_id}/intake`
                : `/cases/${c.case_id}/review`
            return (
              <button
                key={c.case_id}
                onClick={() => navigate(target)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  width: '100%',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  borderTop: i === 0 ? 'none' : '1px solid var(--line-soft)',
                  padding: '16px 18px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>
                    {c.client_first_name || 'Untitled case'}
                  </div>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                    {c.mode} · {c.program_dates || 'no dates'} ·{' '}
                    {c.session_count ? `${c.session_count} sessions` : 'sessions n/a'}
                  </div>
                </div>
                <StatusPill status={c.status} />
                <span className="muted">›</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatusPill({ status }) {
  const map = {
    intake: { label: 'Intake', color: 'var(--muted)' },
    extracting: { label: 'Extracting', color: 'var(--warn)' },
    review: { label: 'In review', color: 'var(--blue)' },
    rendered: { label: 'Rendered', color: 'var(--teal-dark)' },
  }
  const s = map[status] || { label: status, color: 'var(--muted)' }
  return (
    <span
      style={{
        fontSize: 11.5,
        fontWeight: 600,
        color: s.color,
        border: `1px solid ${s.color}`,
        borderRadius: 999,
        padding: '3px 10px',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {s.label}
    </span>
  )
}
