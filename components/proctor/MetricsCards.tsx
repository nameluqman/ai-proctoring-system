// components/proctor/MetricsCards.tsx
import React from "react";
import { Layers, Eye, Copy, MousePointer2Off, MonitorX, AudioLines } from "lucide-react";

interface MetricsCardsProps {
  totalViolations: number;
  screenAwaySeconds: number;
  stats: {
    tabSwitches: number;
    unfocusEvents: number;
    mouseDepartures: number;
    clipboardActions: number;
    externalDeviceCount: number;
    multipleFaceCount: number;
    noFaceCount: number;
    gazeDeviationCount: number;
    aiFocusAlertCount: number;
    syntheticAudioAlertCount: number;
    sharedDisplayMismatchCount: number;
  };
}

const formatDuration = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return [hrs, mins, secs].map((value) => String(value).padStart(2, "0")).join(":");
  }

  return [mins, secs].map((value) => String(value).padStart(2, "0")).join(":");
};

export default function MetricsCards({ totalViolations, screenAwaySeconds, stats }: MetricsCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-1.5 min-[540px]:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 [&>div:not(:first-child)]:!min-h-[52px] [&>div:not(:first-child)]:!px-2 [&>div:not(:first-child)]:!py-1.5">
      <div className="col-span-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-xl border border-rose-800/40 bg-gradient-to-r from-rose-950/60 via-slate-900 to-slate-900 px-3 py-2 min-[540px]:col-span-3 lg:col-span-5 xl:col-span-6">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-[9px] uppercase tracking-[0.14em] text-rose-300/80">Total Mistakes</p>
            <p className="mt-0.5 text-xl font-black leading-none text-white">{totalViolations}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-1.5">
          <span className="text-[9px] uppercase tracking-[0.12em] text-slate-400">Away Time</span>
          <span className="font-mono text-sm font-bold text-amber-300">{formatDuration(screenAwaySeconds)}</span>
        </div>

        <span className="rounded-full border border-rose-800/60 bg-rose-950/40 px-2.5 py-1 text-[10px] font-medium text-rose-200">
          {totalViolations > 0 ? "Needs review" : "No issues"}
        </span>
      </div>

      <div className="flex min-h-[66px] items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-2 sm:px-3">
        <Layers className="h-4 w-4 shrink-0 text-amber-400" />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase leading-tight text-slate-400">Tab Switches</p>
          <p className="mt-0.5 text-base font-bold leading-none text-amber-400">{stats.tabSwitches}</p>
        </div>
      </div>

      <div className="flex min-h-[66px] items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-2 sm:px-3">
        <Eye className="h-4 w-4 shrink-0 text-rose-400" />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase leading-tight text-slate-400">Window Unfocus</p>
          <p className="mt-0.5 text-base font-bold leading-none text-rose-400">{stats.unfocusEvents}</p>
        </div>
      </div>

      <div className="flex min-h-[66px] items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-2 sm:px-3">
        <MousePointer2Off className="h-4 w-4 shrink-0 text-orange-400" />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase leading-tight text-slate-400">Mouse Out of Window</p>
          <p className="mt-0.5 text-base font-bold leading-none text-orange-400">{stats.mouseDepartures}</p>
        </div>
      </div>

      <div className="flex min-h-[66px] items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-2 sm:px-3">
        <Copy className="h-4 w-4 shrink-0 text-indigo-400" />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase leading-tight text-slate-400">Clipboard Actions</p>
          <p className="mt-0.5 text-base font-bold leading-none text-slate-200">{stats.clipboardActions}</p>
        </div>
      </div>

      <div className="flex min-h-[66px] items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-2 sm:px-3">
        <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-amber-400/20 text-[9px] font-bold text-amber-300">
          P
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase leading-tight text-slate-400">Phone Detected</p>
          <p className="mt-0.5 text-base font-bold leading-none text-amber-300">{stats.externalDeviceCount}</p>
        </div>
      </div>

      <div className="flex min-h-[66px] items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-2 sm:px-3">
        <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-rose-500/20 text-[9px] font-bold text-rose-300">
          F
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase leading-tight text-slate-400">Multi-face</p>
          <p className="mt-0.5 text-base font-bold leading-none text-rose-300">{stats.multipleFaceCount}</p>
        </div>
      </div>

      <div className="flex min-h-[66px] items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-2 sm:px-3">
        <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-cyan-400/20 text-[9px] font-bold text-cyan-300">
          N
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase leading-tight text-slate-400">No Face</p>
          <p className="mt-0.5 text-base font-bold leading-none text-cyan-300">{stats.noFaceCount}</p>
        </div>
      </div>

      <div className="flex min-h-[66px] items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-2 sm:px-3">
        <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-violet-400/20 text-[9px] font-bold text-violet-300">
          G
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase leading-tight text-slate-400">Gaze Dev</p>
          <p className="mt-0.5 text-base font-bold leading-none text-violet-300">{stats.gazeDeviationCount}</p>
        </div>
      </div>

      <div className="flex min-h-[66px] items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-2 sm:px-3">
        <Eye className="h-4 w-4 shrink-0 text-cyan-300" />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase leading-tight text-slate-400">AI / Focus Alerts</p>
          <p className="mt-0.5 text-base font-bold leading-none text-cyan-300">{stats.aiFocusAlertCount}</p>
        </div>
      </div>

      <div className="flex min-h-[66px] items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-2 sm:px-3">
        <AudioLines className="h-4 w-4 shrink-0 text-fuchsia-300" />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase leading-tight text-slate-400">Possible Synthetic Audio</p>
          <p className="mt-0.5 text-base font-bold leading-none text-fuchsia-300">{stats.syntheticAudioAlertCount}</p>
        </div>
      </div>

      <div className="flex min-h-[66px] items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-2 sm:px-3">
        <MonitorX className="h-4 w-4 shrink-0 text-rose-400" />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase leading-tight text-slate-400">Display Mismatch</p>
          <p className="mt-0.5 text-base font-bold leading-none text-rose-300">{stats.sharedDisplayMismatchCount}</p>
        </div>
      </div>
    </div>
  );
}