import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  createCase,
  getCase,
  updateCase,
  listTranscripts,
  addTranscript,
  deleteTranscript,
} from '../lib/db.js'
import { runExtract } from '../lib/api.js'
import {
  CASE_MODES,
  TRANSCRIPT_PHASES,
  CASE_STATUS,
  EXPERIENCE_LEVELS,
  DEFAULT_EXPERIENCE_LEVEL,
} from '../lib/constants.js'

const countWords = (t) => (t ? t.trim().split(/\s+/).filter(Boolean).length : 0)

export default function Intake() {
  const { caseId } = useParams()
  const navigate = useNavigate()

  if (!caseId) return <CreateCase onCreated={(c) => navigate(`/cases/${c.case_id}/intake`)} />
  return <ManageCase caseId={caseId} navigate={navigate} />
}

// ---------------------------------------------------------------------------
// Step 1: create the case
// ---------------------------------------------------------------------------
function CreateCase({ onCreated }) {
  const [form, setForm] = useState({
    client_first_name: '',
    program_dates: '',
    session_count: '',
    session_frequency: '',
    session_duration: '',
    mode: 'full',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      const payload = {
        client_first_name: form.client_first_name || null,
        program_dates: form.program_dates || null,
        session_count: form.session_count ? Number(form.session_count) : null,
        session_frequency: form.session_frequency || null,
        session_duration: form.session_duration ? Number(form.session_duration) : null,
        mode: form.mode,
        status: CASE_STATUS.INTAKE,
      }
      const created = await createCase(payload)
      onCreated(created)
    } catch (e) {
      setErr(e.message || 'Could not create case')
      setBusy(false)
    }
  }

  return (
    <div className="stack" style={{ maxWidth: 620 }}>
      <div>
        <Link to="/" className="muted" style={{ fontSize: 13 }}>
          ← All cases
        </Link>
        <h1 style={{ fontSize: 24, marginTop: 6 }}>New case</h1>
      </div>

      <form className="card" style={{ padding: 24 }} onSubmit={submit}>
        <div className="stack">
          <div>
            <label className="field-label">Client's first name</label>
            <input value={form.client_first_name} onChange={set('client_first_name')} required />
          </div>
          <div className="row" style={{ gap: 14 }}>
            <div style={{ flex: 1 }}>
              <label className="field-label">Program start &amp; end dates</label>
              <input
                value={form.program_dates}
                onChange={set('program_dates')}
                placeholder="e.g. Jan–Jun 2026"
              />
            </div>
            <div style={{ width: 130 }}>
              <label className="field-label">Mode</label>
              <select value={form.mode} onChange={set('mode')}>
                {CASE_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="row" style={{ gap: 14 }}>
            <div style={{ flex: 1 }}>
              <label className="field-label">Sessions</label>
              <input
                type="number"
                value={form.session_count}
                onChange={set('session_count')}
                min="0"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="field-label">Frequency</label>
              <input
                value={form.session_frequency}
                onChange={set('session_frequency')}
                placeholder="e.g. weekly"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="field-label">Duration (min)</label>
              <input
                type="number"
                value={form.session_duration}
                onChange={set('session_duration')}
                min="0"
              />
            </div>
          </div>
          {err && <div className="error-text">{err}</div>}
          <div className="row">
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy && <span className="spinner" />}
              Create case
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2: add transcripts and generate the assessment
// ---------------------------------------------------------------------------
function ManageCase({ caseId, navigate }) {
  const [caseRow, setCaseRow] = useState(null)
  const [transcripts, setTranscripts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [extracting, setExtracting] = useState(false)
  const [extractMsg, setExtractMsg] = useState(null)
  const [experienceLevel, setExperienceLevel] = useState(DEFAULT_EXPERIENCE_LEVEL)

  async function refresh() {
    const [c, ts] = await Promise.all([getCase(caseId), listTranscripts(caseId)])
    setCaseRow(c)
    setTranscripts(ts)
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        await refresh()
      } catch (e) {
        if (alive) setError(e.message || 'Failed to load case')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId])

  async function handleAdd(t) {
    const created = await addTranscript(caseId, t)
    setTranscripts((prev) =>
      [...prev, created].sort((a, b) => (a.session_number ?? 0) - (b.session_number ?? 0))
    )
  }

  async function handleDelete(id) {
    await deleteTranscript(id)
    setTranscripts((prev) => prev.filter((t) => t.transcript_id !== id))
  }

  async function handleExtract() {
    setExtracting(true)
    setError(null)
    setExtractMsg('Running the five AI passes — this usually takes 30–90 seconds…')
    try {
      await updateCase(caseId, { status: CASE_STATUS.EXTRACTING })
      const phase = transcripts[0]?.phase || 'early'
      await runExtract({
        caseId,
        clientFirstName: caseRow.client_first_name,
        phase,
        transcripts: transcripts.map((t) => ({
          session_number: t.session_number,
          phase: t.phase,
          text: t.raw_text,
        })),
        experienceLevel,
        // omit model_keys → run all five passes (synthesis/program_design ordered last)
      })
      await updateCase(caseId, { status: CASE_STATUS.REVIEW })
      navigate(`/cases/${caseId}/review`)
    } catch (e) {
      setError(e.message || 'Extraction failed')
      // roll status back so the coach can retry
      await updateCase(caseId, { status: CASE_STATUS.INTAKE }).catch(() => {})
      setExtracting(false)
      setExtractMsg(null)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', padding: 80 }}>
        <div className="spinner spinner-ink" />
      </div>
    )
  }
  if (error && !caseRow) return <div className="error-text">{error}</div>

  const canExtract = transcripts.length > 0 && !extracting

  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div>
          <Link to="/" className="muted" style={{ fontSize: 13 }}>
            ← All cases
          </Link>
          <h1 style={{ fontSize: 24, marginTop: 6 }}>
            {caseRow.client_first_name || 'Untitled case'}
          </h1>
          <div className="muted" style={{ fontSize: 13 }}>
            {caseRow.mode} · {caseRow.program_dates || 'no dates'}
          </div>
        </div>
        <div className="spacer" />
        {caseRow.status !== CASE_STATUS.INTAKE && (
          <Link className="btn btn-ghost" to={`/cases/${caseId}/review`}>
            Go to review
          </Link>
        )}
      </div>

      {error && <div className="error-text">{error}</div>}

      <TranscriptList transcripts={transcripts} onDelete={handleDelete} disabled={extracting} />

      <AddTranscriptForm
        nextSession={transcripts.length + 1}
        onAdd={handleAdd}
        disabled={extracting}
      />

      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 16, marginBottom: 6 }}>Generate assessment</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>
          Runs all five AI passes (Six Streams, Human Domains, Ten Ways, Synthesis, Program
          Design) and writes the drafted fields you'll review and correct.
        </p>
        <div style={{ maxWidth: 420, marginBottom: 14 }}>
          <label className="field-label" htmlFor="experience-level">
            Writing register (coach experience level)
          </label>
          <select
            id="experience-level"
            value={experienceLevel}
            onChange={(e) => setExperienceLevel(Number(e.target.value))}
            disabled={extracting}
          >
            {EXPERIENCE_LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
          <p className="muted" style={{ fontSize: 12, margin: '6px 0 0' }}>
            Adjusts only the voice and depth of the prose — never the developmental
            assessment, ratings, or grounding.
          </p>
        </div>
        {extractMsg && (
          <div
            style={{
              background: 'var(--blue-tint)',
              color: 'var(--blue-dark)',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13.5,
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span className="spinner spinner-ink" />
            {extractMsg}
          </div>
        )}
        <button className="btn btn-primary" onClick={handleExtract} disabled={!canExtract}>
          {extracting && <span className="spinner" />}
          Generate assessment →
        </button>
        {transcripts.length === 0 && (
          <span className="muted" style={{ fontSize: 12.5, marginLeft: 12 }}>
            Add at least one transcript first.
          </span>
        )}
      </div>
    </div>
  )
}

function TranscriptList({ transcripts, onDelete, disabled }) {
  if (transcripts.length === 0) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 16, marginBottom: 4 }}>Transcripts</h2>
        <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
          No transcripts yet. Add one below.
        </p>
      </div>
    )
  }
  return (
    <div className="card">
      <h2 style={{ fontSize: 16, padding: '16px 18px 8px' }}>
        Transcripts ({transcripts.length})
      </h2>
      {transcripts.map((t) => (
        <div
          key={t.transcript_id}
          className="row"
          style={{ padding: '12px 18px', borderTop: '1px solid var(--line-soft)' }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, fontSize: 14 }}>
              Session {t.session_number ?? '—'}{' '}
              <span className="muted" style={{ fontWeight: 400 }}>
                · {t.phase || 'phase n/a'} · {t.word_count ?? countWords(t.raw_text)} words
              </span>
            </div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
              {(t.raw_text || '').slice(0, 100)}…
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onDelete(t.transcript_id)}
            disabled={disabled}
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  )
}

function AddTranscriptForm({ nextSession, onAdd, disabled }) {
  const [sessionNumber, setSessionNumber] = useState(nextSession)
  const [phase, setPhase] = useState('early')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [fileName, setFileName] = useState(null)

  useEffect(() => setSessionNumber(nextSession), [nextSession])

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setErr(null)
    setFileName(file.name)
    try {
      if (file.name.toLowerCase().endsWith('.docx')) {
        // Lazy-load mammoth (large) only when a .docx is actually uploaded.
        const mammoth = (await import('mammoth')).default
        const arrayBuffer = await file.arrayBuffer()
        const { value } = await mammoth.extractRawText({ arrayBuffer })
        setText(value)
      } else if (file.name.toLowerCase().endsWith('.txt')) {
        setText(await file.text())
      } else {
        setErr('Unsupported file. Use .docx or .txt.')
      }
    } catch (e) {
      setErr(e.message || 'Could not read file')
    }
  }

  async function submit(e) {
    e.preventDefault()
    if (!text.trim()) {
      setErr('Add transcript text (paste or upload a file).')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await onAdd({
        session_number: Number(sessionNumber),
        phase,
        raw_text: text,
        word_count: countWords(text),
      })
      setText('')
      setFileName(null)
    } catch (e) {
      setErr(e.message || 'Could not add transcript')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card" style={{ padding: 20 }} onSubmit={submit}>
      <h2 style={{ fontSize: 16, marginBottom: 12 }}>Add transcript</h2>
      <div className="row" style={{ gap: 14, marginBottom: 12 }}>
        <div style={{ width: 120 }}>
          <label className="field-label">Session #</label>
          <input
            type="number"
            min="1"
            value={sessionNumber}
            onChange={(e) => setSessionNumber(e.target.value)}
          />
        </div>
        <div style={{ width: 140 }}>
          <label className="field-label">Phase</label>
          <select value={phase} onChange={(e) => setPhase(e.target.value)}>
            {TRANSCRIPT_PHASES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label className="field-label">Upload .docx / .txt</label>
          <input type="file" accept=".docx,.txt" onChange={handleFile} />
          {fileName && (
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Loaded: {fileName}
            </div>
          )}
        </div>
      </div>
      <label className="field-label">Transcript text</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="Paste transcript text here, or upload a file above."
      />
      <div className="row" style={{ marginTop: 6 }}>
        <span className="muted" style={{ fontSize: 12 }}>
          {countWords(text)} words
        </span>
        <div className="spacer" />
        {err && <div className="error-text">{err}</div>}
        <button className="btn btn-teal" type="submit" disabled={busy || disabled}>
          {busy && <span className="spinner" />}
          Add transcript
        </button>
      </div>
    </form>
  )
}
