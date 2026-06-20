import { useEffect, useState } from 'react'

// Overview intake fields (source: 'intake') live on the `cases` row, not `assessments`.
// They were captured at intake; the coach can confirm/correct them here.
const NUMERIC_KEYS = new Set(['session_count', 'session_duration'])

export default function CaseField({ field, caseRow, onSaveCase }) {
  const initial = caseRow?.[field.key] ?? ''
  const [value, setValue] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    setValue(caseRow?.[field.key] ?? '')
  }, [caseRow, field.key])

  const isNumeric = NUMERIC_KEYS.has(field.key)
  const dirty = String(value ?? '') !== String(caseRow?.[field.key] ?? '')

  async function save() {
    setBusy(true)
    setErr(null)
    try {
      const out = isNumeric ? (value === '' ? null : Number(value)) : value
      await onSaveCase({ [field.key]: out })
    } catch (e) {
      setErr(e.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ padding: '16px 18px', borderTop: '1px solid var(--line-soft)' }}>
      <div className="row" style={{ marginBottom: 8 }}>
        <label className="field-label" style={{ margin: 0, fontSize: 14, color: 'var(--ink)' }}>
          {field.label}
        </label>
        <div className="spacer" />
        <span className="muted" style={{ fontSize: 11 }}>intake</span>
      </div>
      <input
        type={isNumeric ? 'number' : 'text'}
        value={value ?? ''}
        onChange={(e) => setValue(e.target.value)}
        style={{ maxWidth: 360 }}
      />
      {err && <div className="error-text" style={{ marginTop: 8 }}>{err}</div>}
      {dirty && (
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>
            {busy && <span className="spinner" />}
            Save
          </button>
          <button
            className="btn btn-ghost btn-sm"
            disabled={busy}
            onClick={() => setValue(caseRow?.[field.key] ?? '')}
          >
            Revert
          </button>
        </div>
      )}
    </div>
  )
}
