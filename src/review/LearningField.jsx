import { useEffect, useState } from 'react'
import Badge from '../components/Badge.jsx'
import { STATUS } from '../lib/constants.js'

// Learning section (HANDOFF §4C): no AI draft exists — the coach writes these directly.
// Saved as assessments with status 'manual' (model 'reflection').
export default function LearningField({ field, assessment, onPersistManual }) {
  const initial = assessment?.value ?? ''
  const [value, setValue] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    setValue(assessment?.value ?? '')
  }, [assessment?.value, assessment?.assessment_id])

  const dirty = value !== (assessment?.value ?? '')

  async function save() {
    setBusy(true)
    setErr(null)
    try {
      await onPersistManual(field.key, { value, model: 'reflection', status: STATUS.MANUAL })
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
        <Badge status={assessment?.status} />
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        placeholder="Write your reflection…"
      />
      {err && <div className="error-text" style={{ marginTop: 8 }}>{err}</div>}
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn btn-primary btn-sm" disabled={busy || !dirty} onClick={save}>
          {busy && <span className="spinner" />}
          Save
        </button>
        {dirty && <span className="muted" style={{ fontSize: 12 }}>Unsaved changes</span>}
      </div>
    </div>
  )
}
