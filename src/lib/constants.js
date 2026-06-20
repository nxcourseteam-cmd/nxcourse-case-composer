// Shared constants derived from the build brief (HANDOFF.md) and schema.sql.

// Section render order — template order (HANDOFF §3).
export const SECTION_ORDER = [
  'overview',
  'analysis',
  'integral_summary',
  'program_design',
  'client_impact',
  'learning',
]

export const SECTION_LABELS = {
  overview: 'Overview',
  analysis: 'Analysis',
  integral_summary: 'Integral Summary',
  program_design: 'Program Design',
  client_impact: 'Client Impact',
  learning: 'Learning',
}

// LOCKED 5-point Six Streams competence scale (HANDOFF §3). Do not change the values.
// NA = Needs Attention, C = Competent, S = Strong.
export const SS_LEVEL_SCALE = ['NA', 'NA/C', 'C', 'C/S', 'S']

export const SS_LEVEL_LABELS = {
  NA: 'NA — Needs Attention',
  'NA/C': 'NA/C',
  C: 'C — Competent',
  'C/S': 'C/S',
  S: 'S — Strong',
}

// assessment_status enum (schema.sql).
export const STATUS = {
  DRAFT: 'draft',
  ACCEPTED: 'accepted',
  EDITED: 'edited',
  GROUNDING_INSUFFICIENT: 'grounding_insufficient',
  MANUAL: 'manual',
}

export const STATUS_LABELS = {
  draft: 'Draft',
  accepted: 'Accepted',
  edited: 'Edited',
  grounding_insufficient: 'Low grounding',
  manual: 'Manual',
}

// case_status enum (schema.sql): intake | extracting | review | rendered.
export const CASE_STATUS = {
  INTAKE: 'intake',
  EXTRACTING: 'extracting',
  REVIEW: 'review',
  RENDERED: 'rendered',
}

export const TRANSCRIPT_PHASES = ['early', 'mid', 'late']

export const CASE_MODES = ['full', 'abbreviated']

// Six Streams competence dropdown applies only to the six ss_*_level fields.
export const isLevelField = (key) =>
  /^ss_.+_level$/.test(key)
