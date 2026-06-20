// Supabase data access. Column names follow schema.sql (the deployed source of truth).
import { supabase, requireSession } from './supabase.js'

// ---- cases ----
export async function listCases() {
  const { data, error } = await supabase
    .from('cases')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getCase(caseId) {
  const { data, error } = await supabase
    .from('cases')
    .select('*')
    .eq('case_id', caseId)
    .single()
  if (error) throw error
  return data
}

export async function createCase(fields) {
  // user_id defaults to auth.uid() server-side (schema.sql), so we don't set it here.
  const { data, error } = await supabase.from('cases').insert(fields).select().single()
  if (error) throw error
  return data
}

export async function updateCase(caseId, patch) {
  const { data, error } = await supabase
    .from('cases')
    .update(patch)
    .eq('case_id', caseId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ---- transcripts ----
export async function listTranscripts(caseId) {
  const { data, error } = await supabase
    .from('transcripts')
    .select('*')
    .eq('case_id', caseId)
    .order('session_number', { ascending: true })
  if (error) throw error
  return data
}

export async function addTranscript(caseId, t) {
  const row = {
    case_id: caseId,
    session_number: t.session_number ?? null,
    session_date: t.session_date ?? null,
    phase: t.phase ?? null,
    raw_text: t.raw_text ?? '',
    word_count: t.word_count ?? null,
  }
  const { data, error } = await supabase.from('transcripts').insert(row).select().single()
  if (error) throw error
  return data
}

export async function deleteTranscript(transcriptId) {
  const { error } = await supabase
    .from('transcripts')
    .delete()
    .eq('transcript_id', transcriptId)
  if (error) throw error
}

// ---- assessments + grounding ----
// Load all assessments for a case with their grounding excerpts joined in.
export async function listAssessmentsWithGrounding(caseId) {
  const { data, error } = await supabase
    .from('assessments')
    .select('*, grounding(*)')
    .eq('case_id', caseId)
  if (error) throw error
  return data
}

export async function updateAssessment(assessmentId, patch) {
  await requireSession() // carry a fresh JWT so RLS doesn't reject the write (42501)
  // updated_at is maintained by the touch_updated_at trigger (schema.sql).
  const { data, error } = await supabase
    .from('assessments')
    .update(patch)
    .eq('assessment_id', assessmentId)
    .select('*, grounding(*)')
    .single()
  if (error) throw error
  return data
}

// Upsert a coach-authored field (Learning section, status 'manual') that has no AI draft.
// Unique on (case_id, field_key) per schema.sql.
export async function upsertManualAssessment({ caseId, fieldKey, model, value, status }) {
  await requireSession() // carry a fresh JWT so RLS doesn't reject the INSERT (42501)
  const { data, error } = await supabase
    .from('assessments')
    .upsert(
      { case_id: caseId, field_key: fieldKey, model, value, status },
      { onConflict: 'case_id,field_key' }
    )
    .select('*, grounding(*)')
    .single()
  if (error) throw error
  return data
}
