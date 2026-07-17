# Action Points — Meeting Notes → Next Steps

Paste raw meeting notes or a transcript, get back a structured brief: decisions made, action items with owners, open questions, and a ready-to-send follow-up message. Built with **Next.js** (App Router) and the **Anthropic API**. The key stays server-side and never reaches the browser.

## Features

- **Decisions** — what was actually decided.
- **Action items** — each with an owner and a due date where one was stated.
- **Open questions** — what was left unresolved.
- **Follow-up message** — a ready-to-send recap you can copy in one click.
- **Load a sample** if you don't have notes handy.

## How it works

```
Browser (app/page.tsx)
   │  POST /api/extract  { notes }
   ▼
Serverless proxy (app/api/extract/route.ts)   ← the key lives here, in an env var
   │  asks the model for structured JSON, parses it
   ▼
Anthropic API  →  { decisions, actions, questions, followup }  →  rendered brief
```

The model is prompted to return strict JSON; the route parses and normalises it so the UI always receives well-formed data. The browser only ever talks to your own `/api/extract` endpoint.

## Run it locally

1. `npm install`
2. `cp .env.example .env.local`, then paste your key from [console.anthropic.com](https://console.anthropic.com) into `.env.local`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
3. `npm run dev`
4. Open http://localhost:3000

## Deploy to Vercel

1. Push to GitHub (`.gitignore` already excludes `.env*`).
2. Vercel: **New Project → import the repo.**
3. Add `ANTHROPIC_API_KEY` in **Settings → Environment Variables.**
4. Deploy, then optionally add a custom domain under **Settings → Domains.**

## Cost & safety

- Uses `claude-haiku-4-5`, the lowest-cost current model. Swap the `model:` line for `claude-sonnet-5` for more polished output.
- **Set a monthly spend cap in the Anthropic console** — the real backstop.
- A light in-memory rate limiter is included; add [Upstash Redis](https://upstash.com) for busy public traffic.
- If a key is ever committed by accident, **rotate it** — deleting the file isn't enough.

## Tech

Next.js (App Router, TypeScript) · Anthropic API · structured-JSON extraction with a normalising parser · zero-dependency server proxy (raw `fetch`) · Bricolage Grotesque + Inter · no database, no auth.
