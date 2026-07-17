"use client";

import { useState } from "react";

type Action = { task: string; owner: string; due: string };
type Brief = {
  decisions: string[];
  actions: Action[];
  questions: string[];
  followup: string;
};

const SAMPLE = `Standup, Tue. Present: Sarah, Mark, Priya.
Sarah: Q3 landing page is live. We agreed to push the pricing test to next sprint since design isn't ready.
Mark to send the updated copy to Priya by Friday.
Priya raised whether we still need the legacy export — nobody was sure, parking it.
Decided to move the weekly sync to Thursdays.
Sarah will book the venue for the offsite once we confirm numbers.`;

export default function Home() {
  const [notes, setNotes] = useState("");
  const [brief, setBrief] = useState<Brief | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function extract() {
    setError("");
    setBrief(null);
    setCopied(false);
    if (!notes.trim()) {
      setError("Paste your meeting notes first.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Something went wrong.");
      else setBrief(data);
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copyFollowup() {
    if (!brief?.followup) return;
    await navigator.clipboard.writeText(brief.followup);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main className="wrap">
      <header className="masthead">
        <p className="eyebrow">Action Points</p>
        <h1 className="title">Turn messy notes into next steps.</h1>
        <p className="subtitle">
          Paste raw meeting notes or a transcript. Get the decisions, action
          items with owners, open questions, and a ready-to-send recap.
        </p>
      </header>

      <div className="workbench">
        {/* input */}
        <section className="panel" aria-label="Notes">
          <p className="panel-label">The notes</p>
          <label className="field-label" htmlFor="notes">
            Meeting notes or transcript
          </label>
          <textarea
            id="notes"
            rows={14}
            placeholder="Paste your raw notes here…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <button
            type="button"
            className="generate"
            onClick={extract}
            disabled={loading}
          >
            {loading ? "Extracting…" : "Extract action points"}
          </button>
          <p className="hint">
            No notes handy?{" "}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setNotes(SAMPLE);
              }}
              style={{ color: "var(--cobalt)" }}
            >
              Load a sample
            </a>
          </p>
        </section>

        {/* output */}
        <section className="panel" aria-label="Brief" aria-live="polite">
          <p className="panel-label">The brief</p>

          {error && <div className="error">{error}</div>}

          {!error && !brief && (
            <div className="placeholder">
              Decisions, action items, open questions, and a follow-up message
              will appear here.
            </div>
          )}

          {brief && (
            <div className="brief">
              {/* decisions */}
              <div className="section">
                <h2 className="section-head">
                  Decisions
                  {brief.decisions.length > 0 && (
                    <span className="section-count">{brief.decisions.length}</span>
                  )}
                </h2>
                {brief.decisions.length > 0 ? (
                  <ul className="list">
                    {brief.decisions.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty-note">No decisions captured.</p>
                )}
              </div>

              {/* action items */}
              <div className="section">
                <h2 className="section-head">
                  Action items
                  {brief.actions.length > 0 && (
                    <span className="section-count">{brief.actions.length}</span>
                  )}
                </h2>
                {brief.actions.length > 0 ? (
                  <div>
                    {brief.actions.map((a, i) => (
                      <div className="action" key={i}>
                        <span className="action-check" aria-hidden />
                        <div className="action-body">
                          <div className="action-task">{a.task}</div>
                          <div className="action-meta">
                            {a.owner && (
                              <span className="chip chip-owner">{a.owner}</span>
                            )}
                            {a.due && <span className="chip chip-due">{a.due}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-note">No action items captured.</p>
                )}
              </div>

              {/* open questions */}
              <div className="section">
                <h2 className="section-head">
                  Open questions
                  {brief.questions.length > 0 && (
                    <span className="section-count">{brief.questions.length}</span>
                  )}
                </h2>
                {brief.questions.length > 0 ? (
                  <ul className="list">
                    {brief.questions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty-note">Nothing left open.</p>
                )}
              </div>

              {/* follow-up */}
              {brief.followup && (
                <div className="section">
                  <h2 className="section-head">Follow-up message</h2>
                  <div className="followup-card">
                    <div className="followup-head">
                      <span className="followup-dot" />
                      Ready to send
                    </div>
                    <div className="followup-body">{brief.followup}</div>
                    <div className="followup-actions">
                      <button type="button" className="copy-btn" onClick={copyFollowup}>
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <p className="footnote">
        Built with Next.js + the Anthropic API ·{" "}
        <a href="https://markotoole.com">markotoole.com</a>
      </p>
    </main>
  );
}
