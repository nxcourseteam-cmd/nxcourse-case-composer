# Case Study Composer — Front End

React + Vite front end for the Integral Coaching case-study tool. It lets a coach
create a case, attach transcripts, run the AI extraction passes, **review and correct
every drafted field against its grounding evidence**, and compose the finished Word
document.

The backend (two Cloud Run services + Supabase) is already live — this app only
integrates with it. See `docs/HANDOFF.md` for the full brief.

## Stack

- React 18 + Vite 5, React Router 6
- Supabase JS (auth + data, RLS-scoped per coach)
- `mammoth` for in-browser `.docx` → text (lazy-loaded)
- Deploys to Netlify (`netlify.toml` included)

## Setup

```bash
npm install
cp .env.example .env   # then fill in VITE_SUPABASE_ANON_KEY
npm run dev            # http://localhost:5173
```

### Environment variables

| Var | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://ytptautsfmyqibqfygfc.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase **anon/public** key (Project Settings → API) |
| `VITE_EXTRACT_URL` | `https://extract-service-969676508061.us-central1.run.app` |
| `VITE_COMPOSE_URL` | `https://compose-docx-969676508061.us-central1.run.app` |

> **Never** put the Supabase `service_role` key here — it stays server-side on the
> Cloud Run services. Only the anon key belongs in the front end.

## Deploy (Netlify)

Build command `npm run build`, publish directory `dist` (already set in
`netlify.toml`). Add the four `VITE_*` vars in Netlify → Site settings → Environment
variables. The SPA redirect rule is included so deep links resolve.

## Routes

- `/login` — Supabase auth (magic link or email + password)
- `/` — cases list
- `/cases/new` — create a case
- `/cases/:id/intake` — add transcripts, run extraction
- `/cases/:id/review` — **the core**: review/edit/accept drafted fields, then compose

## Service integration

- `POST {EXTRACT_URL}/extract` — runs the five passes, writes `assessments` + `grounding`.
- `POST {EXTRACT_URL}/compose-case` — `{ case_id }` → returns the finished `.docx` blob.

Transcripts are persisted to the `transcripts` table by this UI **and** passed in the
`/extract` body (the service doesn't persist them itself — HANDOFF §8).

## Backend follow-ups (HANDOFF §8)

Tracked in `docs/restore_auth.sql` and `docs/HANDOFF.md`:

1. Restore `cases.user_id NOT NULL` (it was dropped for hand-testing).
2. Add a re-run guard so `/extract` only overwrites `status='draft'` fields, never
   `accepted`/`edited` ones (needed before the "Regenerate section" feature is safe).
3. Rotate the Anthropic + Supabase service_role keys exposed during bring-up.

These are backend changes — not part of this front end.
