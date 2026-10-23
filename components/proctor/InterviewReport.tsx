"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getViolationDeduction } from "@/lib/scoreCalculator";
import { INTEGRITY_VIOLATION_TYPES, type InterviewReport } from "@/types/telemetry";

const VIOLATION_LABELS: Record<(typeof INTEGRITY_VIOLATION_TYPES)[number], string> = {
  TAB_SWITCH: "Tab switches",
  WINDOW_UNFOCUS: "Window unfocus",
  MOUSE_DEPARTURE: "Mouse departures",
  CLIPBOARD_ACTION: "Clipboard actions",
  EXTERNAL_DEVICE_DETECTED: "Phone detections",
  MULTIPLE_FACES_DETECTED: "Multiple faces",
  NO_FACE_DETECTED: "No face detected",
  GAZE_DEVIATION: "Gaze deviations",
  SYNTHETIC_AUDIO_SUSPECTED: "Possible synthetic audio",
  SHARED_DISPLAY_MISMATCH: "Display mismatches",
};

const TIMELINE_EVENT_TYPE_SET = new Set([...INTEGRITY_VIOLATION_TYPES, "CONTEXT_MENU"]);
const TIMELINE_EVENT_LABELS: Record<string, string> = {
  ...VIOLATION_LABELS,
  CONTEXT_MENU: "Right-click context menu",
};

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;
  return hours > 0
    ? `${hours}h ${minutes}m ${remainingSeconds}s`
    : `${minutes}m ${remainingSeconds}s`;
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function riskStyle(riskLevel: InterviewReport["riskLevel"]) {
  switch (riskLevel) {
    case "low":
      return "border-emerald-700 bg-emerald-950/60 text-emerald-200";
    case "medium":
      return "border-amber-700 bg-amber-950/60 text-amber-200";
    case "high":
      return "border-rose-700 bg-rose-950/60 text-rose-200";
  }
}

export default function InterviewReportView({ report }: { report: InterviewReport }) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const timelineEvents = useMemo(
    () =>
      report.events
        .filter((event) => TIMELINE_EVENT_TYPE_SET.has(event.type))
        .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp)),
    [report.events]
  );
  const selectedEvent = timelineEvents.find((event) => event.id === selectedEventId) ?? null;
  const orderedEvidence = useMemo(
    () =>
      [...report.evidenceSnapshots]
        .sort((left, right) => (right.confidenceScore ?? -1) - (left.confidenceScore ?? -1))
        .slice(0, 30),
    [report.evidenceSnapshots]
  );

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-5 text-slate-100 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Candidate integrity report</p>
          <h1 className="mt-2 text-2xl font-bold text-white">Session Scorecard</h1>
          <p className="mt-1 text-sm text-slate-400">Room: {report.roomId}</p>
        </div>
        <Link
          href={`/proctor?room=${encodeURIComponent(report.roomId)}`}
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-indigo-500"
        >
          Back to live proctor
        </Link>
      </div>

      <section className="grid gap-4 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
          <p className="text-xs uppercase tracking-wide text-slate-400">Integrity score</p>
          <p className="mt-2 text-4xl font-black text-white">{report.integrityScore}%</p>
          <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase ${riskStyle(report.riskLevel)}`}>
            {report.riskLevel === "low" ? "🟢" : report.riskLevel === "medium" ? "🟡" : "🔴"} {report.riskLevel} risk
          </span>
        </div>
        <Metric label="Interview duration" value={formatDuration(report.durationSeconds)} />
        <Metric label="Away time tracked" value={formatDuration(report.awaySeconds)} />
        <Metric label="Screenshots saved" value={String(report.evidenceSnapshots.length)} />
      </section>

      <p className="rounded-xl border border-amber-800/60 bg-amber-950/30 p-4 text-sm leading-relaxed text-amber-100">
        This is a rule-based review score from browser, webcam, and optional microphone signals—not an AI judgment of
        candidate honesty or proof of misconduct. Signals can be inaccurate. Away time is measured time away from the
        assessment, not verified cheating time. Time penalty: {report.timePenaltyPoints} points.
      </p>

      {report.telemetryTruncated && (
        <p role="status" className="rounded-xl border border-orange-800/60 bg-orange-950/30 p-4 text-sm text-orange-100">
          The event timeline was capped for session size. {report.omittedEventCount} older events were omitted from the
          timeline; violation totals include the omitted violation counts.
        </p>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <h2 className="text-lg font-bold text-white">Violation breakdown</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {INTEGRITY_VIOLATION_TYPES.map((type) => (
            <div key={type} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <span>
                <span className="block text-sm text-slate-300">{VIOLATION_LABELS[type]}</span>
                <span className="mt-1 block text-[11px] text-slate-500">−{getViolationDeduction(type)} points each</span>
              </span>
              <span className="min-w-8 rounded-full bg-slate-800 px-2 py-1 text-center text-sm font-bold text-white">
                {report.violationCounts[type]}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-white">Violation timeline</h2>
            <p className="mt-1 text-xs text-slate-400">Select an event to review its details and recorded time.</p>
          </div>
          <span className="text-xs text-slate-500">{timelineEvents.length} violation events</span>
        </div>
        {timelineEvents.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-slate-700 p-5 text-center text-sm text-slate-400">
            No scored violation events were recorded.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <ol className="max-h-[460px] space-y-2 overflow-y-auto pr-1">
              {timelineEvents.map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedEventId(event.id)}
                    aria-pressed={selectedEventId === event.id}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      selectedEventId === event.id
                        ? "border-indigo-500 bg-indigo-950/50"
                        : "border-slate-800 bg-slate-950/60 hover:border-slate-600"
                    }`}
                  >
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-white">{TIMELINE_EVENT_LABELS[event.type]}</span>
                      <time className="font-mono text-xs text-slate-400">{formatTimestamp(event.timestamp)}</time>
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-300">{event.message}</span>
                  </button>
                </li>
              ))}
            </ol>
            <aside className="rounded-xl border border-slate-800 bg-slate-950/70 p-4" aria-live="polite">
              {selectedEvent ? (
                <>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Selected violation</p>
                  <h3 className="mt-2 font-semibold text-indigo-200">
                    {TIMELINE_EVENT_LABELS[selectedEvent.type]}
                  </h3>
                  <p className="mt-2 text-sm text-slate-300">{selectedEvent.message}</p>
                  <p className="mt-3 text-xs text-slate-400">{formatTimestamp(selectedEvent.timestamp)}</p>
                  <ModelScore score={selectedEvent.confidenceScore} />
                </>
              ) : (
                <p className="text-sm text-slate-400">Choose a timeline event to inspect its details.</p>
              )}
            </aside>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-white">Evidence gallery</h2>
            <p className="mt-1 text-xs text-slate-400">Ordered by available detector score; screenshots without a score follow.</p>
          </div>
          <span className="text-xs text-slate-500">{report.evidenceSnapshots.length} saved</span>
        </div>
        {orderedEvidence.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-slate-700 p-5 text-center text-sm text-slate-400">
            No screenshots were available for this session.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {orderedEvidence.map((snapshot) => (
              <a
                key={snapshot.eventId}
                href={snapshot.imageUrl}
                target="_blank"
                rel="noreferrer"
                className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 transition hover:border-indigo-500"
              >
                <Image
                  src={snapshot.imageUrl}
                  alt={`Evidence for ${snapshot.type}`}
                  width={640}
                  height={360}
                  unoptimized
                  className="aspect-video w-full object-cover"
                />
                <div className="space-y-1 p-3">
                  <p className="text-xs font-semibold uppercase text-amber-300">{snapshot.type.replace(/_/g, " ")}</p>
                  <p className="text-xs text-slate-300">{formatTimestamp(snapshot.timestamp)}</p>
                  <p className="line-clamp-2 text-xs text-slate-400">{snapshot.message}</p>
                  <ModelScore score={snapshot.confidenceScore} />
                </div>
              </a>
            ))}
          </div>
        )}
      </section>

      <p className="text-center text-xs text-slate-500">
        Session started {formatTimestamp(report.startedAt)} · finished {formatTimestamp(report.finishedAt)}
      </p>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function ModelScore({ score }: { score?: number }) {
  return (
    <p className="mt-2 text-[11px] text-slate-500">
      Model score:{" "}
      {score === undefined ? "not available" : `${Math.round(score * 100)}% (uncalibrated; not a probability of misconduct)`}
    </p>
  );
}