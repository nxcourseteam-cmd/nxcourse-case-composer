import { useState } from 'react'

// A collapsible section block on the review screen, grouped in template order.
export default function SectionGroup({
  title,
  progressText,
  onAcceptAll,
  acceptAllBusy,
  acceptAllDisabled,
  children,
}) {
  const [open, setOpen] = useState(true)

  return (
    <section className="card" style={{ overflow: 'hidden' }}>
      <div
        className="row"
        style={{
          padding: '14px 18px',
          background: 'var(--blue-tint)',
          borderBottom: open ? '1px solid var(--line)' : 'none',
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ color: 'var(--blue)', fontSize: 13 }}>{open ? '▾' : '▸'}</span>
          <h2 style={{ fontSize: 17, color: 'var(--blue-dark)' }}>{title}</h2>
        </button>
        {progressText && (
          <span className="muted" style={{ fontSize: 12.5 }}>
            {progressText}
          </span>
        )}
        <div className="spacer" />
        {onAcceptAll && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={onAcceptAll}
            disabled={acceptAllBusy || acceptAllDisabled}
          >
            {acceptAllBusy && <span className="spinner spinner-ink" />}
            Accept all in section
          </button>
        )}
      </div>
      {open && <div>{children}</div>}
    </section>
  )
}
