// components/proctor/LiveStreamFeed.tsx
"use client";

import React, { useEffect, useRef } from "react";
import { Flag, Mic, RefreshCw, Video, Volume2, VolumeX } from "lucide-react";
import type { MediaConnection, Peer } from "peerjs";

interface LiveStreamFeedProps {
  hasLiveFeed: boolean;
  setHasLiveFeed: (val: boolean) => void;
  hasScreenFeed: boolean;
  setHasScreenFeed: (val: boolean) => void;
  hasAudioFeed: boolean;
  setHasAudioFeed: (val: boolean) => void;
  peerRef: React.MutableRefObject<Peer | null>;
  peerReady: boolean;
  onFlag: () => void;
  onClearLogs: () => void;
}

export default function LiveStreamFeed({
  hasLiveFeed,
  setHasLiveFeed,
  hasScreenFeed,
  setHasScreenFeed,
  hasAudioFeed,
  setHasAudioFeed,
  peerRef,
  peerReady,
  onFlag,
  onClearLogs,
}: LiveStreamFeedProps) {
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioMutedRef = useRef(true);
  const [isAudioMuted, setIsAudioMuted] = React.useState(true);

  useEffect(() => {
    const peer = peerRef.current;
    if (!peerReady || !peer) return;

    const handleCall = (call: MediaConnection) => {
      const metadata: unknown = call.metadata;
      const source =
        metadata &&
        typeof metadata === "object" &&
        "source" in metadata &&
        (metadata.source === "screen" || metadata.source === "audio")
          ? metadata.source
          : "webcam";

      call.on("stream", (remoteStream: MediaStream) => {
        if (source === "audio") {
          audioMutedRef.current = true;
          setIsAudioMuted(true);
          if (audioRef.current) {
            audioRef.current.srcObject = remoteStream;
            audioRef.current.muted = true;
            void audioRef.current.play().catch((error: unknown) => {
              console.error("Could not play the candidate microphone stream:", error);
            });
          }
          for (const track of remoteStream.getAudioTracks()) {
            track.onended = () => {
              if (audioRef.current?.srcObject !== remoteStream) return;
              audioMutedRef.current = true;
              setIsAudioMuted(true);
              setHasAudioFeed(false);
              audioRef.current.srcObject = null;
            };
          }
          setHasAudioFeed(true);
          return;
        }

        const targetRef = source === "screen" ? screenVideoRef : webcamVideoRef;
        if (targetRef.current) {
          targetRef.current.srcObject = remoteStream;
          void targetRef.current.play().catch((error: unknown) => {
            console.error(`Could not play the candidate ${source} stream:`, error);
          });
        }

        if (source === "screen") {
          setHasScreenFeed(true);
        } else {
          setHasLiveFeed(true);
        }
      });

      call.on("close", () => {
        if (source === "audio") {
          audioMutedRef.current = true;
          setIsAudioMuted(true);
          setHasAudioFeed(false);
          if (audioRef.current) audioRef.current.srcObject = null;
        } else if (source === "screen") {
          setHasScreenFeed(false);
          if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
        } else {
          setHasLiveFeed(false);
          if (webcamVideoRef.current) webcamVideoRef.current.srcObject = null;
        }
      });

      call.on("error", (error: Error) => {
        console.error(`Candidate ${source} stream failed:`, error);
        if (source === "audio") {
          audioMutedRef.current = true;
          setIsAudioMuted(true);
          setHasAudioFeed(false);
          if (audioRef.current) audioRef.current.srcObject = null;
        } else if (source === "screen") {
          setHasScreenFeed(false);
          if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
        } else {
          setHasLiveFeed(false);
          if (webcamVideoRef.current) webcamVideoRef.current.srcObject = null;
        }
      });

      call.answer();
    };

    peer.on("call", handleCall);

    return () => {
      peer.off("call", handleCall);
    };
  }, [peerReady, peerRef, setHasAudioFeed, setHasLiveFeed, setHasScreenFeed]);

  const toggleCandidateAudio = () => {
    const nextMuted = !audioMutedRef.current;
    audioMutedRef.current = nextMuted;
    setIsAudioMuted(nextMuted);
    if (audioRef.current) {
      audioRef.current.muted = nextMuted;
      if (!nextMuted) {
        void audioRef.current.play().catch((error: unknown) => {
          console.error("Could not play the candidate microphone stream:", error);
        });
      }
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl p-4 shadow-[0_18px_50px_rgba(15,23,42,0.45)] backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Live Monitoring</p>
          <h2 className="mt-1 text-lg font-bold text-white">Candidate Stream Review</h2>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/60 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          Active
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <audio ref={audioRef} autoPlay muted className="sr-only" />
        <div className="space-y-3 rounded-xl border border-indigo-500/20 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/30 p-2.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center space-x-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-300">
                <Video className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-white">Candidate Webcam</h3>
            </div>
            {hasLiveFeed && (
              <span className="flex items-center space-x-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            )}
          </div>

          <div className="relative aspect-video overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
            <video
              ref={webcamVideoRef}
              autoPlay
              playsInline
              muted
              className={`h-full w-full object-cover ${hasLiveFeed ? "block" : "hidden"}`}
            />

            {!hasLiveFeed && (
              <div className="flex h-full items-center justify-center p-6 text-center text-slate-400">
                <div className="space-y-2">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-500">
                    <Video className="h-5 w-5" />
                  </div>
                  <p className="text-xs uppercase tracking-[0.18em]">Waiting</p>
                  <p className="text-xs text-slate-500">Candidate webcam offline</p>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 px-1">
            <span className="inline-flex items-center gap-2 text-xs text-slate-400">
              <Mic className="h-4 w-4" />
              {hasAudioFeed ? "Candidate microphone connected" : "Candidate microphone off"}
            </span>
            <button
              type="button"
              onClick={toggleCandidateAudio}
              disabled={!hasAudioFeed}
              aria-pressed={!isAudioMuted}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAudioMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              {isAudioMuted ? "Unmute candidate" : "Mute candidate"}
            </button>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-amber-500/20 bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950/20 p-2.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center space-x-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/10 text-amber-300">
                <Video className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-white">Full Screen Share</h3>
            </div>
            {hasScreenFeed && (
              <span className="flex items-center space-x-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Live
              </span>
            )}
          </div>

          <div className="relative aspect-video overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
            <video
              ref={screenVideoRef}
              autoPlay
              playsInline
              muted
              className={`h-full w-full object-contain ${hasScreenFeed ? "block" : "hidden"}`}
            />

            {!hasScreenFeed && (
              <div className="flex h-full items-center justify-center p-6 text-center text-slate-400">
                <div className="space-y-2">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-500">
                    <Video className="h-5 w-5" />
                  </div>
                  <p className="text-xs uppercase tracking-[0.18em]">Waiting</p>
                  <p className="text-xs text-slate-500">Full screen share offline</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 pt-2">
        <button
          onClick={onFlag}
          className="inline-flex items-center gap-2 rounded-lg border border-rose-800/70 bg-rose-950/50 px-3.5 py-2 text-[11px] font-medium text-rose-200 transition hover:bg-rose-900/60"
        >
          <Flag className="h-3.5 w-3.5" />
          <span>Flag Suspicious Activity</span>
        </button>

        <button
          onClick={onClearLogs}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-[11px] font-medium text-slate-200 transition hover:bg-slate-700"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Reset Logs</span>
        </button>
      </div>
    </div>
  );
}