import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  getCase,
  updateCase,
  listAssessmentsWithGrounding,
  updateAssessment,
  upsertManualAssessment,
} from '../lib/db.js'
import { composeCase } from '../lib/api.js'
import { fieldsBySection } from '../lib/fieldMap.js'
import {
  SECTION_LABELS,
  STATUS,
  CASE_STATUS,
  experienceLevel,
} from '../lib/constants.js'
import SectionGroup from '../review/SectionGroup.jsx'
import ReviewField from '../review/ReviewField.jsx'
import CaseField from '../review/CaseField.jsx'
import LearningField from '../review/LearningField.jsx'
import ArchetypePicker from '../review/ArchetypePicker.jsx'

const REVIEWED = new Set([STATUS.ACCEPTED, STATUS.EDITED])

// Each narrative gets an archetype picker rendered directly above its metaphor field.
// The selection is stored under a field_key the synthesis pass never emits, so a
// regenerate refreshes `*_archetype_candidates` but leaves the coach's pick intact.
const ARCHETYPE_PICKERS = {
  narr_current_narrative: {
    title: 'Current archetype',
    candidatesKey: 'current_archetype_candidates',
    selectionKey: 'narr_current_archetype',
    valuePrefix: 'Current Archetype: ',
  },
  narr_deeper_narrative: {
    title: 'Deeper archetype',
    candidatesKey: 'deeper_archetype_candidates',
    selectionKey: 'narr_deeper_archetype',
    valuePrefix: 'Deeper Archetype: ',
  },
}

export default function Review() {
  const { caseId } = useParams()
  const [caseRow, setCaseRow] = useState(null)
  const [assessments, setAssessments] = useState({}) // keyed by field_key
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [composing, setComposing] = useState(false)
  const [composed, setComposed] = useState(null) // { blob, filename } after a successful render
  const [acceptingSection, setAcceptingSection] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const [c, rows] = await Promise.all([
          getCase(caseId),
          listAssessmentsWithGrounding(caseId),
        ])
        if (!alive) return
        setCaseRow(c)
        setAssessments(indexByFieldKey(rows))
      } catch (e) {
        if (alive) setError(e.message || 'Failed to load case')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [caseId])

  const abbreviated = caseRow?.mode === 'abbreviated'
  const groups = useMemo(
    () => fieldsBySection({ abbreviatedOnly: abbreviated }),
    [abbreviated]
  )

  // ---- persistence handlers ----
  const persistAssessment = useCallback(
    async (fieldKey, patch) => {
      const existing = assessments[fieldKey]
      if (!existing) throw new Error(`No assessment row for ${fieldKey}`)
      const updated = await updateAssessment(existing.assessment_id, patch)
      setAssessments((prev) => ({ ...prev, [fieldKey]: updated }))
    },
    [assessments]
  )

  const persistManual = useCallback(
    async (fieldKey, { value, model, status }) => {
      const updated = await upsertManualAssessment({
        caseId,
        fieldKey,
        model,
        value,
        status,
      })
      setAssessments((prev) => ({ ...prev, [fieldKey]: updated }))
    },
    [caseId]
  )

  const saveCase = useCallback(
    async (patch) => {
      const updated = await updateCase(caseId, patch)
      setCaseRow(updated)
    },
    [caseId]
  )

  async function acceptAllInSection(section, fields) {
    setAcceptingSection(section)
    try {
      const targets = fields.filter((f) => {
        const a = assessments[f.key]
        return a && a.status !== STATUS.ACCEPTED
      })
      const updates = await Promise.all(
        targets.map((f) =>
          updateAssessment(assessments[f.key].assessment_id, { status: STATUS.ACCEPTED })
        )
      )
      setAssessments((prev) => {
        const next = { ...prev }
        for (const u of updates) next[u.field_key] = u
        return next
      })
    } catch (e) {
      setError(e.message || 'Accept all failed')
    } finally {
      setAcceptingSection(null)
    }
  }

  // Trigger a browser download for an already-fetched blob (used for both the initial
  // compose and the "Download again" link, so the latter doesn't re-hit the service).
  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  async function handleCompose() {
    setComposing(true)
    setError(null)
    try {
      const { blob, filename } = await composeCase(caseId, caseRow?.client_first_name)
      triggerDownload(blob, filename)
      setComposed({ blob, filename })
      // Optionally mark the case rendered (HANDOFF §4D).
      if (caseRow?.status !== CASE_STATUS.RENDERED) {
        const updated = await updateCase(caseId, { status: CASE_STATUS.RENDERED })
        setCaseRow(updated)
      }
    } catch (e) {
      setError(e.message || 'Compose failed')
    } finally {
      setComposing(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', padding: 80 }}>
        <div className="spinner spinner-ink" />
      </div>
    )
  }

  if (error && !caseRow) {
    return <div className="error-text">{error}</div>
  }

  const hasAssessments = Object.keys(assessments).length > 0

  // ---- overall progress (assessment-backed fields only) ----
  const reviewable = groups
    .flatMap((g) => g.fields)
    .filter((f) => f.section !== 'client_impact' && f.source !== 'intake')
    .filter((f) => f.section !== 'learning')
  const reviewed = reviewable.filter((f) => REVIEWED.has(assessments[f.key]?.status)).length

  return (
    <div className="stack" style={{ gap: 20 }}>
      {/* header */}
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div>
          <Link to="/" className="muted" style={{ fontSize: 13 }}>
            ← All cases
          </Link>
          <h1 style={{ fontSize: 24, marginTop: 6 }}>
            {caseRow.client_first_name || 'Untitled case'}
          </h1>
          <div className="row muted" style={{ fontSize: 13, gap: 14, marginTop: 4 }}>
            <span>Mode: {caseRow.mode}</span>
            <span>
              Register: Level {experienceLevel(caseRow.experience_level).value} —{' '}
              {experienceLevel(caseRow.experience_level).short}
            </span>
            <span>Status: {caseRow.status}</span>
            <span>
              Reviewed {reviewed}/{reviewable.length} drafted fields
            </span>
          </div>
        </div>
        <div className="spacer" />
        <div className="row">
          <Link className="btn btn-ghost" to={`/cases/${caseId}/intake`}>
            Intake & transcripts
          </Link>
          <button className="btn btn-primary" onClick={handleCompose} disabled={composing}>
            {composing && <span className="spinner" />}
            {composed ? 'Regenerate Word document' : 'Generate Word document'}
          </button>
        </div>
      </div>

      {composed && (
        <ComposeConfirmation
          filename={composed.filename}
          onDownloadAgain={() => triggerDownload(composed.blob, composed.filename)}
        />
      )}

      {error && <div className="error-text">{error}</div>}

      {!hasAssessments && (
        <div className="card" style={{ padding: 24 }}>
          <p style={{ marginTop: 0 }}>
            No assessments have been generated for this case yet.
          </p>
          <Link className="btn btn-primary" to={`/cases/${caseId}/intake`}>
            Go to intake to generate
          </Link>
        </div>
      )}

      {/* sections */}
      {groups.map(({ section, fields }) => {
        const isImpact = section === 'client_impact'
        const isLearning = section === 'learning'
        const isOverview = section === 'overview'

        // accept-all only applies to assessment-backed sections
        const acceptableFields = fields.filter(
          (f) => f.source !== 'intake' && assessments[f.key]
        )
        const showAcceptAll = !isImpact && !isLearning && acceptableFields.length > 0
        const allAccepted =
          acceptableFields.length > 0 &&
          acceptableFields.every((f) => assessments[f.key]?.status === STATUS.ACCEPTED)

        // per-section progress text
        let progressText = null
        if (!isImpact && !isLearning) {
          const counted = fields.filter((f) => f.source !== 'intake' && assessments[f.key])
          const done = counted.filter((f) => REVIEWED.has(assessments[f.key]?.status)).length
          if (counted.length) progressText = `${done}/${counted.length} reviewed`
        }

        return (
          <SectionGroup
            key={section}
            title={SECTION_LABELS[section] || section}
            progressText={progressText}
            onAcceptAll={
              showAcceptAll ? () => acceptAllInSection(section, fields) : undefined
            }
            acceptAllBusy={acceptingSection === section}
            acceptAllDisabled={allAccepted}
          >
            {isImpact ? (
              <ClientImpactNote fields={fields} />
            ) : (
              fields.map((field) => {
                if (isLearning) {
                  return (
                    <LearningField
                      key={field.key}
                      field={field}
                      assessment={assessments[field.key]}
                      onPersistManual={persistManual}
                    />
                  )
                }
                if (isOverview && field.source === 'intake') {
                  return (
                    <CaseField
                      key={field.key}
                      field={field}
                      caseRow={caseRow}
                      onSaveCase={saveCase}
                    />
                  )
                }
                const reviewField = (
                  <ReviewField
                    key={field.key}
                    field={field}
                    assessment={assessments[field.key]}
                    onPersist={persistAssessment}
                  />
                )
                const picker = ARCHETYPE_PICKERS[field.key]
                if (picker) {
                  return (
                    <Fragment key={field.key}>
                      <ArchetypePicker
                        title={picker.title}
                        candidatesRaw={assessments[picker.candidatesKey]?.value}
                        selection={assessments[picker.selectionKey]}
                        selectionKey={picker.selectionKey}
                        valuePrefix={picker.valuePrefix}
                        onPersistManual={persistManual}
                      />
                      {reviewField}
                    </Fragment>
                  )
                }
                return reviewField
              })
            )}
          </SectionGroup>
        )
      })}
    </div>
  )
}

function ComposeConfirmation({ filename, onDownloadAgain }) {
  return (
    <div
      className="card"
      style={{
        padding: '18px 20px',
        borderColor: 'var(--teal)',
        background: 'var(--teal-tint)',
      }}
    >
      <div className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
        <div
          aria-hidden
          style={{
            flexShrink: 0,
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--teal)',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          ✓
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 16, color: 'var(--teal-dark)' }}>Document generated</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--ink-soft)' }}>
            <strong>{filename}</strong> was downloaded to your browser's Downloads folder.
          </p>
          <div className="row" style={{ marginTop: 14, gap: 12 }}>
            <button type="button" className="btn btn-teal btn-sm" onClick={onDownloadAgain}>
              Download again
            </button>
            <Link className="btn btn-ghost btn-sm" to="/">
              Back to all cases
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function ClientImpactNote({ fields }) {
  return (
    <div style={{ padding: '16px 18px' }}>
      <div
        style={{
          background: 'var(--warn-tint)',
          border: '1px solid #f0d9bf',
          borderRadius: 8,
          padding: '12px 14px',
          color: 'var(--warn)',
          fontSize: 13.5,
        }}
      >
        Client Impact is generated later from end-of-program sessions. These{' '}
        {fields.length} fields are dormant for now and not editable in this view.
      </div>
      <ul
        className="muted"
        style={{
          columns: 2,
          fontSize: 12.5,
          marginTop: 14,
          marginBottom: 0,
          paddingLeft: 18,
        }}
      >
        {fields.map((f) => (
          <li key={f.key}>{f.label}</li>
        ))}
      </ul>
    </div>
  )
}

function indexByFieldKey(rows) {
  const map = {}
  for (const r of rows) map[r.field_key] = r
  return map
}
