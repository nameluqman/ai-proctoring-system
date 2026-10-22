import React from "react";
import Image from "next/image";
import type { EventLog, EvidenceSnapshot } from "@/types/telemetry";

interface TelemetryLoggerProps {
  logs: EventLog[];
  scratchpadText?: string;
  evidenceSnapshots: EvidenceSnapshot[];
}

export default function TelemetryLogger({ logs, scratchpadText = "", evidenceSnapshots }: TelemetryLoggerProps) {
  return (
    <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl p-5 shadow-[0_18px_50px_rgba(15,23,42,0.35)] backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Monitoring</p>
          <h3 className="mt-1 text-lg font-bold text-white">Screen Activity Log</h3>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-950/70 px-2.5 py-1 text-[10px] font-medium text-slate-300 font-mono">
          {logs.length} Events
        </span>
      </div>

      <div className="flex-1 space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {logs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-6 text-center">
            <p className="text-xs text-slate-500">No activity recorded yet.</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-600">Live events will appear here</p>
          </div>
        ) : (
          logs.map((log, index) => {
            const isNewest = index === 0;

            return (
              <div
                key={log.id}
                className={[
                  "rounded-xl border p-3 text-xs transition-all",
                  isNewest
                    ? "border-amber-500/60 bg-amber-500/10 shadow-[0_0_0_1px_rgba(251,191,36,0.2)]"
                    : "border-slate-800 bg-slate-950/60",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${isNewest ? "text-amber-300" : "text-indigo-300"}`}>
                      {log.type}
                    </span>
                    {isNewest && (
                      <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-200">
                        New
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">{log.timestamp}</span>
                </div>
                <p className={isNewest ? "mt-2 text-amber-100" : "mt-2 text-slate-300"}>{log.message}</p>
              </div>
            );
          })
        )}
      </div>

      <section className="mt-4 border-t border-slate-800 pt-4" aria-label="Recent candidate screenshots">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Review Screenshots</p>
          <span className="text-[10px] font-mono text-slate-500">{evidenceSnapshots.length} saved</span>
        </div>
        {evidenceSnapshots.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-700 px-3 py-4 text-center text-xs text-slate-500">
            Screenshots may be captured from the webcam or screen when a review event is detected.
          </p>
        ) : (
          <div className="max-h-[420px] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {evidenceSnapshots.map((snapshot) => (
                <a
                  key={snapshot.id}
                  href={snapshot.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950 transition hover:border-amber-500/60 hover:shadow-[0_0_0_1px_rgba(251,191,36,0.2)]"
                  title={`${snapshot.type}: ${snapshot.message}`}
                >
                  <Image
                    src={snapshot.imageUrl}
                    alt={`Evidence for ${snapshot.type}`}
                    width={640}
                    height={360}
                    unoptimized
                    className="aspect-video w-full object-cover"
                  />
                  <div className="border-t border-slate-800 bg-slate-950/90 px-2 py-2">
                    <p className="truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-300">
                      {snapshot.type}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[10px] text-slate-300">
                      {snapshot.message}
                    </p>
                    <p className="mt-1 text-[9px] text-slate-500 font-mono">
                      {snapshot.timestamp}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </section>

      {scratchpadText && (
        <div className="mt-4 border-t border-slate-800 pt-4">
          <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-slate-400">Live Scratchpad</p>
          <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
            {scratchpadText}
          </div>
        </div>
      )}
    </div>
  );
}