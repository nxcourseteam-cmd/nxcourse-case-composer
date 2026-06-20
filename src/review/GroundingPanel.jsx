import { useState } from 'react'

// Shows the transcript evidence (quote + timestamp) behind a drafted field, so the
// coach can verify the draft against grounding before accepting (HANDOFF §0, §4C).
export default function GroundingPanel({ grounding }) {
  const [open, setOpen] = useState(false)
  const count = grounding?.length || 0

  if (count === 0) {
    return (
      <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        No grounding excerpts attached.
      </div>
    )
  }

  return (
    <div style={{ marginTop: 10 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn btn-ghost btn-sm"
        aria-expanded={open}
        style={{ fontSize: 12 }}
      >
        {open ? '▾' : '▸'} Grounding evidence ({count})
      </button>
      {open && (
        <ul
          style={{
            listStyle: 'none',
            margin: '10px 0 0',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {grounding.map((g) => (
            <li
              key={g.grounding_id}
              style={{
                borderLeft: '3px solid var(--teal)',
                background: 'var(--teal-tint)',
                padding: '8px 12px',
                borderRadius: '0 6px 6px 0',
              }}
            >
              <div style={{ fontSize: 13.5, fontStyle: 'italic', color: 'var(--ink)' }}>
                “{g.excerpt}”
              </div>
              {g.timestamp_ref && (
                <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
                  {g.timestamp_ref}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
