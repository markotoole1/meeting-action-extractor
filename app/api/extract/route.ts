import { NextRequest, NextResponse } from "next/server";

// Server-only route. The API key lives in an environment variable and never
// reaches the browser. The client posts raw notes here; this endpoint asks the
// model to return structured JSON, parses it, and hands back a clean object.

// --- Minimal in-memory rate limiter -----------------------------------------
// Best-effort per-IP speed bump (serverless instances are stateless). For busy
// public traffic add Upstash Redis. The real cost backstop is the monthly spend
// cap in the Anthropic console.
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const record = hits.get(ip);
  if (!record || now > record.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  record.count += 1;
  return record.count > MAX_REQUESTS;
}

// Pull the first {...} block out of the model's text and parse it. Robust to
// stray prose or ```json fences even though we ask for raw JSON.
function extractJson(text: string): unknown | null {
  const fenced = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(fenced.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Give it a minute and try again." },
      { status: 429 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Server is missing its API key. Add ANTHROPIC_API_KEY and restart." },
      { status: 500 }
    );
  }

  let body: { notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const notes = (body.notes || "").trim();
  if (!notes) {
    return NextResponse.json({ error: "Paste your meeting notes first." }, { status: 400 });
  }

  const system = [
    "You extract structure from raw meeting notes or transcripts.",
    "Return ONLY a JSON object, no prose, no markdown fences, in exactly this shape:",
    '{ "decisions": string[], "actions": [{ "task": string, "owner": string, "due": string }], "questions": string[], "followup": string }',
    "Rules:",
    "- decisions: concrete decisions that were actually made. Empty array if none.",
    "- actions: things someone agreed to do. owner is the person's name, or \"Unassigned\" if unclear. due is a date/timeframe if stated, else an empty string.",
    "- questions: unresolved open questions or things left undecided. Empty array if none.",
    "- followup: a short, ready-to-send recap message summarising the meeting for attendees.",
    "- Do not invent people, dates, or decisions that aren't supported by the notes.",
  ].join("\n");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1500,
        system,
        messages: [{ role: "user", content: `Meeting notes:\n"""${notes}"""` }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("Anthropic API error:", res.status, detail);
      return NextResponse.json(
        { error: "The model call failed. Check your key and spend cap." },
        { status: 502 }
      );
    }

    const data = await res.json();
    const text = (data.content || [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n");

    const parsed = extractJson(text) as {
      decisions?: string[];
      actions?: { task: string; owner: string; due: string }[];
      questions?: string[];
      followup?: string;
    } | null;

    if (!parsed) {
      return NextResponse.json(
        { error: "Couldn't structure the notes. Try again." },
        { status: 502 }
      );
    }

    // Normalise so the client always gets well-formed arrays/strings.
    return NextResponse.json({
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
      followup: typeof parsed.followup === "string" ? parsed.followup : "",
    });
  } catch (err) {
    console.error("Request failed:", err);
    return NextResponse.json(
      { error: "Something went wrong reaching the model." },
      { status: 500 }
    );
  }
}
