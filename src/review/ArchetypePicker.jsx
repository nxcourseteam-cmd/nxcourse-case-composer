import { useEffect, useMemo, useState } from 'react'
import Badge from '../components/Badge.jsx'
import { STATUS } from '../lib/constants.js'

// Archetype picker for a narrative (current or deeper) in the Integral Summary.
//
// Candidates come from the synthesis pass as a JSON array of {label, rationale} stored
// on the `*_archetype_candidates` assessment field. The coach's pick is stored as a
// SEPARATE assessment field (`narr_current_archetype` / `narr_deeper_archetype`) with
// status 'manual'. The synthesis pass never emits those selection keys, so a regenerate
// refreshes the candidate list but leaves the coach's locked pick untouched (the lock
// is structural — see Review.jsx / lib/api.js runExtract, which never sends them).
const OTHER = '__other__'

// The persisted value carries a printed label prefix (e.g. "Current Archetype: Busy Bee")
// so it reads cleanly in the composed document; the picker works with the bare label.
function stripPrefix(value, prefix) {
  const v = (value || '').trim()
  if (prefix && v.startsWith(prefix)) return v.slice(prefix.length).trim()
  return v
}

function parseCandidates(raw) {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr
      .filter((c) => c && typeof c.label === 'string' && c.label.trim())
      .map((c) => ({ label: c.label.trim(), rationale: (c.rationale || '').trim() }))
  } catch {
    return []
  }
}

export default function ArchetypePicker({
  title,
  candidatesRaw,
  selection,
  selectionKey,
  valuePrefix = '',
  onPersistManual,
}) {
  const candidates = useMemo(() => parseCandidates(candidatesRaw), [candidatesRaw])
  const locked = stripPrefix(selection?.value, valuePrefix)
  const lockedFromCandidates = candidates.some((c) => c.label === locked)

  // What the coach has selected in the UI: a candidate label, OR the OTHER sentinel.
  const [choice, setChoice] = useState('')
  const [otherText, setOtherText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  // Re-sync from the persisted pick whenever it (or the candidate set) changes. A
  // regenerate that refreshes candidates must NOT move the coach's selection.
  useEffect(() => {
    if (locked && candidates.some((c) => c.label === locked)) {
      setChoice(locked)
      setOtherText('')
    } else if (locked) {
      // A coach-authored label (or one no longer offered) → keep it under "Other".
      setChoice(OTHER)
      setOtherText(locked)
    } else {
      setChoice('')
      setOtherText('')
    }
  }, [locked, candidatesRaw]) // eslint-disable-line react-hooks/exhaustive-deps

  const pendingLabel = choice === OTHER ? otherText.trim() : choice
  const dirty = pendingLabel !== locked
  const canSave = pendingLabel.length > 0 && dirty

  // The candidate list refreshed to options that no longer include the locked pick:
  // surface fresh suggestions without disturbing the coach's choice.
  const newSuggestions =
    locked && candidates.length > 0 && !lockedFromCandidates

  async function save() {
    setBusy(true)
    setErr(null)
    try {
      await onPersistManual(selectionKey, {
        value: `${valuePrefix}${pendingLabel}`,
        model: 'synthesis',
        status: STATUS.MANUAL,
      })
    } catch (e) {
      setErr(e.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ padding: '16px 18px', borderTop: '1px solid var(--line-soft)' }}>
      <div className="row" style={{ marginBottom: 8, alignItems: 'flex-start', gap: 10 }}>
        <label className="field-label" style={{ margin: 0, fontSize: 14, color: 'var(--ink)' }}>
          {title}
        </label>
        <div className="spacer" />
        <Badge status={selection?.status} />
      </div>

      {locked && (
        <div
          style={{
            background: 'var(--teal-tint)',
            border: '1px solid var(--teal)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 12,
            fontSize: 15,
            color: 'var(--teal-dark)',
          }}
        >
          <strong>{title}:</strong> {locked}
        </div>
      )}

      {newSuggestions && (
        <div
          className="muted"
          style={{ fontSize: 12.5, marginBottom: 10, color: 'var(--warn)' }}
        >
          ✨ New suggestions available below — your pick stays until you choose another.
        </div>
      )}

      <div className="stack" style={{ gap: 8 }}>
        {candidates.map((c) => {
          const active = choice === c.label
          return (
            <label
              key={c.label}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                padding: '10px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                border: active ? '1px solid var(--teal)' : '1px solid var(--line-soft)',
                background: active ? 'var(--teal-tint)' : 'transparent',
              }}
            >
              <input
                type="radio"
                name={`archetype-${selectionKey}`}
                checked={active}
                onChange={() => setChoice(c.label)}
                style={{ marginTop: 3 }}
              />
              <span style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--ink)' }}>
                  {c.label}
                </span>
                {c.rationale && (
                  <span
                    className="muted"
                    style={{ display: 'block', fontSize: 12.5, marginTop: 2 }}
                  >
                    {c.rationale}
                  </span>
                )}
              </span>
            </label>
          )
        })}

        {candidates.length === 0 && (
          <div className="muted" style={{ fontSize: 12.5, fontStyle: 'italic' }}>
            No AI suggestions yet — name your own below.
          </div>
        )}

        {/* "Other" — coach names their own archetype */}
        <label
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            padding: '10px 12px',
            borderRadius: 8,
            cursor: 'pointer',
            border: choice === OTHER ? '1px solid var(--teal)' : '1px solid var(--line-soft)',
            background: choice === OTHER ? 'var(--teal-tint)' : 'transparent',
          }}
        >
          <input
            type="radio"
            name={`archetype-${selectionKey}`}
            checked={choice === OTHER}
            onChange={() => setChoice(OTHER)}
            style={{ marginTop: 3 }}
          />
          <span style={{ flex: 1 }}>
            <span style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--ink)' }}>Other</span>
            <input
              type="text"
              value={otherText}
              onChange={(e) => {
                setOtherText(e.target.value)
                if (choice !== OTHER) setChoice(OTHER)
              }}
              placeholder="Name your own archetype…"
              style={{ marginTop: 6, display: 'block', width: '100%', maxWidth: 320 }}
            />
          </span>
        </label>
      </div>

      {err && (
        <div className="error-text" style={{ marginTop: 8 }}>
          {err}
        </div>
      )}

      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn btn-primary btn-sm" disabled={busy || !canSave} onClick={save}>
          {busy && <span className="spinner" />}
          {locked ? 'Update archetype' : 'Save archetype'}
        </button>
        {dirty && pendingLabel.length > 0 && (
          <span className="muted" style={{ fontSize: 12 }}>Unsaved selection</span>
        )}
      </div>
    </div>
  )
}
