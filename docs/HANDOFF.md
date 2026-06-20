# Case Study Composer — Front-End Build Brief (for Claude Code)

## 0. What you're building and what you're NOT

Build the React/Vite + Netlify **front end** for an Integral Coaching case-study tool:
an **intake** screen, a **review (accept/edit)** screen, and a **compose/download** action.

The **backend already exists, is deployed, and is proven end to end** — two Cloud Run
services plus Supabase. **Do not rebuild it.** A transcript already flows in and a finished
Word case study comes out via `curl` today. Your job is the human-facing layer that lets a
coach run that pipeline and, critically, **review and correct every AI-drafted field before
it ships**.

Why the review screen matters: the AI passes produce strong, grounded drafts, but some
fields touch clinical/relational judgment (e.g., grief exercises, exercise frequency for a
medically fragile client). The coach must be able to verify each draft against its grounding
evidence and edit it. That review step is the core of the product, not a nicety.

---

## 1. What already exists (live — integrate, don't rebuild)

**GCP project** `nxcourse-audio` (969676508061), region `us-central1`.

**compose-docx** — `https://compose-docx-969676508061.us-central1.run.app`
- `POST /compose` — body is a flat `{ field_key: value }` JSON; returns the filled `.docx`.
  Fills the tagged NVW template faithfully.

**extract-service** — `https://extract-service-969676508061.us-central1.run.app`
- `POST /extract` — runs the AI passes, writes `assessments` + `grounding`, returns a summary.
- `POST /compose-case` — `{ case_id }` → reads the case's assessments, calls compose-docx,
  returns the finished `.docx`.
- `GET /health`

**Supabase** — project ref `ytptautsfmyqibqfygfc`, URL `https://ytptautsfmyqibqfygfc.supabase.co`.
Schema deployed (`schema.sql`, bundled). RLS scopes rows to the coach via `auth.uid()`.
NOTE: `cases.user_id` NOT NULL was temporarily dropped for hand-testing — restore it when
you wire auth (see §8).

**The five AI passes (done):** `six_streams`, `human_domains`, `ten_ways` (Analysis);
`synthesis` (Integral Summary); `program_design`. `synthesis` and `program_design` read the
case's prior assessments back in, so they stay consistent with the analysis. **Not built:**
Client Impact (dormant — only fires with end-of-program transcripts) and Learning (coach
writes it). Render those sections as plain editable fields for now (§4C).

---

## 2. Data model (tables you read/write)

- **cases** — `case_id` (uuid pk), `user_id` (coach, FK auth.users), `client_first_name`,
  `program_dates`, `session_count`, `session_frequency`, `session_duration`,
  `mode` (`full` | `abbreviated`), `status` (`intake` | `review` | `complete`), timestamps.
- **transcripts** — `id`, `case_id` FK, `session_number`, `phase` (`early`|`mid`|`late`),
  `text`, `created_at`. (The service currently receives transcripts in the `/extract` body and
  does NOT persist them. The UI should persist them here AND pass them to `/extract`.)
- **assessments** — `assessment_id` (uuid pk), `case_id` FK, `model`, `field_key`,
  `value` (text), `rating` (text, nullable), `status` (`draft`|`accepted`|`edited`|`manual`),
  timestamps. **Unique on (case_id, field_key).** This is what the review screen edits.
- **grounding** — `id`, `assessment_id` FK, `excerpt` (text), `timestamp_ref` (text).
  The evidence quotes behind a field; display these beside the field on review.
- **prompt_registry** — versioned prompt audit; not needed for v1.

---

## 3. The field map (drives the review screen)

`field_map.json` (bundled) lists all **123** template fields, each:
`{ key, section, label, source, model, grounding, abbreviated }`.

Render the review screen **grouped by `section`, in template order**:
`overview → analysis → integral_summary → program_design → client_impact → learning`.

- **Rating fields** (constrained control, not free text):
  - the six `ss_*_level` fields use the **LOCKED 5-point scale**: `["NA","NA/C","C","C/S","S"]`
    (NA=Needs Attention, C=Competent, S=Strong). Render a dropdown.
  - `ten_ways_status` is short text (Entering / Traversing / Exiting + reason).
- **`grounding: true`** fields have grounding excerpts (quote + timestamp) to show for
  verification.
- **`abbreviated: true`** fields are the Abbreviated case study subset — when
  `case.mode === 'abbreviated'`, show only these.
- Provenance (which pass writes each field) is in `adapters.js` (bundled) if you need it.
  The field_map's `model`/`source` tags are design-intent; `adapters.js` is the source of truth.

---

## 4. What to build

### A. Auth
Supabase Auth (magic link or email+password). `auth.uid()` scopes all rows via RLS. After
wiring auth, restore `cases.user_id` NOT NULL with `DEFAULT auth.uid()` (see §8).

### B. Intake screen
- **Create case**: `client_first_name`, program metadata, `mode`.
- **Add transcript(s)**: paste text and/or upload `.docx`/`.txt`. For `.docx`, extract text
  with `mammoth` in-browser. Each transcript: `session_number`, `phase`, `text`. Persist to
  `transcripts`.
- **Generate assessment** → `POST /extract` with
  `{ case_id, client_first_name, phase, transcripts: [{session_number, phase, text}], model_keys? }`.
  Omit `model_keys` to run all five passes in one call (the service orders synthesis and
  program_design last automatically). Show a 30–90s progress state. On success → review.

### C. Review screen (the core)
- Load `assessments` for the case + their `grounding` (join on `assessment_id`).
- Group by section (template order). For each field render: **label**, the **drafted value**
  in an editable textarea, a **rating control** where applicable, a **status badge**, and the
  field's **grounding excerpts** (quote + timestamp) in an expandable/side panel.
- Per-field actions: **Accept** (`status → accepted`), **Edit** (on change → `status → edited`,
  persist `value`/`rating`), or leave `draft`. Add **"Accept all in section."**
- Persist edits to `assessments` (`value`, `rating`, `status`, `updated_at`).
- **Client Impact** (53 fields) and **Learning** (4 fields): no AI drafts exist. Render Learning
  as plain editable textareas the coach fills directly (status `manual`). Render Client Impact
  read-only/empty with a note that it generates from end-of-program sessions later.

### D. Compose / download
- **Generate Word document** → `POST /compose-case { case_id }` → receive `.docx` blob →
  trigger download. Optionally set `case.status = 'complete'`.

### E. Nice-to-have
- **Regenerate a section**: `POST /extract` with `model_keys: ["six_streams"]` etc. (See §8 —
  a backend guard is needed so re-runs don't overwrite accepted/edited fields.)

---

## 5. Stack & conventions

- **React + Vite**, deploy on **Netlify** (matches `nxcourse-navigator` / `wl-lesson-tool`).
  Suggested repo: `nxcourse-case-composer`.
- **Supabase JS** (`@supabase/supabase-js`) for auth + data.
  Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. **Never** put the service_role key in the
  front end — the Cloud Run services hold it server-side.
- Service URLs as env: `VITE_EXTRACT_URL`, `VITE_COMPOSE_URL`.
- **Brand**: primary blue `#3067AE`, teal `#40C0BF`, black/white. Headings **Cera Pro**, body
  **Poppins**. Calm, focused, professional — a coach reviewing sensitive client material.

---

## 6. Service API contracts (exact)

**POST /extract**
```json
// request
{
  "case_id": "uuid",
  "client_first_name": "Angelique",
  "phase": "early",
  "transcripts": [{ "session_number": 1, "phase": "early", "text": "..." }],
  "model_keys": ["six_streams","human_domains","ten_ways","synthesis","program_design"]
}
// response
{ "ok": true, "case_id": "uuid",
  "summary": { "six_streams": {"assessments":19,"grounding":18}, "...": {} } }
```

**POST /compose-case**
```json
// request
{ "case_id": "uuid" }
// response: binary .docx (Content-Disposition: attachment)
```

---

## 7. Build sequence

1. Scaffold Vite/React + Supabase auth + routing.
2. Cases list + create.
3. Intake (transcript add + extract trigger + progress).
4. **Review screen** (assessments + grounding; edit/accept/save). The heart — spend the time here.
5. Compose/download.
6. Polish: bulk-accept, regenerate, status transitions.

---

## 8. Open decisions / follow-ups (flag; mostly small backend tweaks)

- **Persist transcripts** from the UI (service doesn't today).
- **Re-run guard (backend):** `/extract` upserts on `(case_id, field_key)` and would overwrite
  `accepted`/`edited` fields on a regenerate. Add a guard so it only overwrites `status='draft'`.
- **Restore RLS:** `ALTER TABLE cases ALTER COLUMN user_id SET NOT NULL;` + default `auth.uid()`
  once auth exists.
- **Client Impact / Learning:** dormant / coach-authored, per §4C.
- **Secrets:** rotate the Anthropic + Supabase service_role keys (they were exposed during
  backend bring-up). Done outside this UI, on the Cloud Run env vars.
