import { useEffect, useState } from 'react'
import Badge from '../components/Badge.jsx'
import GroundingPanel from './GroundingPanel.jsx'
import { SS_LEVEL_SCALE, SS_LEVEL_LABELS, STATUS, isLevelField } from '../lib/constants.js'

// One assessment-backed field on the review screen: label, editable draft, optional
// rating control, status badge, grounding evidence, and per-field accept/edit actions.
export default function ReviewField({ field, assessment, onPersist }) {
  const isLevel = isLevelField(field.key)
  const isTenWaysStatus = field.key === 'ten_ways_status'

  const initialValue = assessment?.value ?? ''
  // For level fields the scale lives in `rating`; fall back to value (adapters set both).
  const initialRating = assessment?.rating ?? (isLevel ? assessment?.value ?? '' : null)

  const [value, setValue] = useState(initialValue)
  const [rating, setRating] = useState(initialRating)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  // Re-sync when the underlying assessment changes (e.g. after a section-wide accept).
  useEffect(() => {
    setValue(assessment?.value ?? '')
    setRating(assessment?.rating ?? (isLevel ? assessment?.value ?? '' : null))
  }, [assessment?.value, assessment?.rating, assessment?.assessment_id, isLevel])

  const status = assessment?.status
  const dirty =
    value !== (assessment?.value ?? '') ||
    (rating ?? '') !== (assessment?.rating ?? (isLevel ? assessment?.value ?? '' : '') ?? '')

  async function persist(nextStatus) {
    setBusy(true)
    setErr(null)
    try {
      // For level fields keep value and rating in sync so compose-docx reads the level.
      const patch = isLevel
        ? { value: rating || '', rating: rating || null, status: nextStatus }
        : { value, rating: rating ?? null, status: nextStatus }
      await onPersist(field.key, patch)
    } catch (e) {
      setErr(e.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  if (!assessment) {
    return (
      <div style={fieldWrap}>
        <FieldHeader field={field} status={null} />
        <div className="muted" style={{ fontSize: 13, fontStyle: 'italic' }}>
          Not yet generated.
        </div>
      </div>
    )
  }

  return (
    <div style={fieldWrap}>
      <FieldHeader field={field} status={status} />

      {isLevel ? (
        <select
          value={rating || ''}
          onChange={(e) => setRating(e.target.value)}
          style={{ maxWidth: 220 }}
        >
          <option value="" disabled>
            Select competence…
          </option>
          {SS_LEVEL_SCALE.map((lvl) => (
            <option key={lvl} value={lvl}>
              {SS_LEVEL_LABELS[lvl]}
            </option>
          ))}
        </select>
      ) : isTenWaysStatus ? (
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Entering / Traversing / Exiting + reason"
        />
      ) : (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={Math.min(10, Math.max(3, Math.ceil((value.length || 0) / 90)))}
        />
      )}

      {field.grounding && <GroundingPanel grounding={assessment.grounding} />}

      {err && (
        <div className="error-text" style={{ marginTop: 8 }}>
          {err}
        </div>
      )}

      <div className="row" style={{ marginTop: 10 }}>
        <button
          className="btn btn-teal btn-sm"
          disabled={busy || status === STATUS.ACCEPTED}
          onClick={() => persist(STATUS.ACCEPTED)}
          title="Mark this draft as accepted"
        >
          {busy && <span className="spinner" />}
          {status === STATUS.ACCEPTED ? 'Accepted' : 'Accept'}
        </button>
        <button
          className="btn btn-primary btn-sm"
          disabled={busy || !dirty}
          onClick={() => persist(STATUS.EDITED)}
          title="Save your edits"
        >
          Save edit
        </button>
        {dirty && (
          <button
            className="btn btn-ghost btn-sm"
            disabled={busy}
            onClick={() => {
              setValue(assessment.value ?? '')
              setRating(assessment.rating ?? (isLevel ? assessment.value ?? '' : null))
            }}
          >
            Revert
          </button>
        )}
        {dirty && <span className="muted" style={{ fontSize: 12 }}>Unsaved changes</span>}
      </div>
    </div>
  )
}

function FieldHeader({ field, status }) {
  return (
    <div
      className="row"
      style={{ marginBottom: 8, alignItems: 'flex-start', gap: 10 }}
    >
      <label className="field-label" style={{ margin: 0, fontSize: 14, color: 'var(--ink)' }}>
        {field.label}
      </label>
      <div className="spacer" />
      <Badge status={status} />
    </div>
  )
}

const fieldWrap = {
  padding: '16px 18px',
  borderTop: '1px solid var(--line-soft)',
}
