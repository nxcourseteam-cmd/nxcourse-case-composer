import { EXPERIENCE_LEVELS } from '../lib/constants.js'

// "Coaching experience level" — a row of five labeled buttons (1–5). Controls the
// writing register only; defaults to 3. Used on create-case and intake.
export default function ExperienceLevelPicker({ value, onChange, disabled }) {
  return (
    <div
      role="radiogroup"
      aria-label="Coaching experience level"
      style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
    >
      {EXPERIENCE_LEVELS.map((l) => {
        const selected = Number(value) === l.value
        return (
          <button
            key={l.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(l.value)}
            title={l.desc}
            style={{
              flex: '1 1 110px',
              minWidth: 100,
              textAlign: 'left',
              cursor: disabled ? 'not-allowed' : 'pointer',
              border: `1px solid ${selected ? 'var(--blue)' : 'var(--line)'}`,
              background: selected ? 'var(--blue-tint)' : 'var(--surface)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 10px',
              opacity: disabled ? 0.6 : 1,
              transition: 'border-color .12s ease, background .12s ease',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-head)',
                fontWeight: 600,
                fontSize: 16,
                color: selected ? 'var(--blue-dark)' : 'var(--ink)',
              }}
            >
              {l.value}
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: selected ? 'var(--blue-dark)' : 'var(--ink-soft)',
                lineHeight: 1.25,
                marginTop: 2,
              }}
            >
              {l.short}
            </div>
          </button>
        )
      })}
    </div>
  )
}
