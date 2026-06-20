// Cloud Run service calls (HANDOFF §6). The backend is live — we only integrate.
import { supabase } from './supabase.js'

const EXTRACT_URL = import.meta.env.VITE_EXTRACT_URL
const COMPOSE_URL = import.meta.env.VITE_COMPOSE_URL

// Attach the coach's Supabase access token so the services can scope by auth.uid().
// The services may or may not require it today, but sending it is harmless and
// future-proofs the re-run guard / RLS work noted in HANDOFF §8.
async function authHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const headers = { 'Content-Type': 'application/json' }
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
  return headers
}

/**
 * POST /extract — run the AI passes for a case.
 * Omit modelKeys to run all five passes (service orders synthesis/program_design last).
 * Note the contract uses `text` per transcript (we store it as raw_text in the DB).
 */
export async function runExtract({
  caseId,
  clientFirstName,
  phase,
  transcripts,
  modelKeys,
  experienceLevel,
}) {
  const body = {
    case_id: caseId,
    client_first_name: clientFirstName,
    phase,
    transcripts: transcripts.map((t) => ({
      session_number: t.session_number,
      phase: t.phase,
      text: t.text,
    })),
  }
  if (modelKeys && modelKeys.length) body.model_keys = modelKeys
  if (experienceLevel != null) body.experience_level = experienceLevel

  const res = await fetch(`${EXTRACT_URL}/extract`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Extract failed (${res.status}): ${detail || res.statusText}`)
  }
  return res.json()
}

/**
 * POST /compose-case — render the finished Word document for a case.
 * This endpoint lives on the extract-service (HANDOFF §1): it reads the case's
 * assessments and calls compose-docx server-side. Returns a Blob ready to download.
 * (VITE_COMPOSE_URL points at compose-docx's direct /compose, kept for future use.)
 */
export async function composeCase(caseId) {
  const res = await fetch(`${EXTRACT_URL}/compose-case`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ case_id: caseId }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Compose failed (${res.status}): ${detail || res.statusText}`)
  }
  const blob = await res.blob()
  // Prefer the server-provided filename if present.
  const disposition = res.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename="?([^"]+)"?/)
  const filename = match ? match[1] : 'case_study.docx'
  return { blob, filename }
}

export { EXTRACT_URL, COMPOSE_URL }
