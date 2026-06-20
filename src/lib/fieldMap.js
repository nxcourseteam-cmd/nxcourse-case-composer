// Field map helpers — the field_map.json drives the review screen (HANDOFF §3).
import fieldMapJson from '../field_map.json'
import { SECTION_ORDER } from './constants.js'

export const FIELD_MAP_VERSION = fieldMapJson.version
export const FIELDS = fieldMapJson.fields

// Quick lookup by key.
export const FIELD_BY_KEY = FIELDS.reduce((acc, f) => {
  acc[f.key] = f
  return acc
}, {})

export const getField = (key) => FIELD_BY_KEY[key]

// Fields grouped by section, preserving template order both across and within sections.
export function fieldsBySection({ abbreviatedOnly = false } = {}) {
  const groups = {}
  for (const section of SECTION_ORDER) groups[section] = []
  for (const f of FIELDS) {
    if (abbreviatedOnly && !f.abbreviated) continue
    if (!groups[f.section]) groups[f.section] = []
    groups[f.section].push(f)
  }
  // Return as ordered array of { section, fields }, dropping empty sections.
  return SECTION_ORDER.map((section) => ({
    section,
    fields: groups[section] || [],
  })).filter((g) => g.fields.length > 0)
}

// The four Learning fields are coach-authored (status 'manual'); no AI draft exists.
export const LEARNING_KEYS = FIELDS.filter((f) => f.section === 'learning').map((f) => f.key)
