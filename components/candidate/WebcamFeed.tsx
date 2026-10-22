"use client";

import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import type { AudioSpoofMonitorStatus } from "@/hooks/useAudioSpoofMonitor";

interface WebcamFeedProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onStream: (stream: MediaStream) => void;
  onMicrophoneStream: (stream: MediaStream | null) => void;
  audioSpoofMonitorStatus: AudioSpoofMonitorStatus;
}

export default function WebcamFeed({
  videoRef,
  onStream,
  onMicrophoneStream,
  audioSpoofMonitorStatus,
}: WebcamFeedProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [microphoneStream, setMicrophoneStream] = useState<MediaStream | null>(null);
  const [microphoneLoading, setMicrophoneLoading] = useState(false);
  const [microphoneError, setMicrophoneError] = useState<string | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    mountedRef.current = true;

    const startCamera = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus("error");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        video.srcObject = stream;
        await video.play();
        onStream(stream);
        setStatus("ready");
      } catch (error) {
        console.warn("Webcam access failed:", error);
        setStatus("error");
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      onMicrophoneStream(null);
      const activeMicrophoneStream = microphoneStreamRef.current;
      microphoneStreamRef.current = null;
      activeMicrophoneStream?.getTracks().forEach((track) => track.stop());
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [onMicrophoneStream, onStream, videoRef]);

  const toggleMicrophone = async () => {
    setMicrophoneError(null);
    if (microphoneStream) {
      microphoneStream.getAudioTracks().forEach((track) => track.stop());
      microphoneStreamRef.current = null;
      setMicrophoneStream(null);
      onMicrophoneStream(null);
      return;
    }

    setMicrophoneLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      microphoneStreamRef.current = stream;
      for (const track of stream.getAudioTracks()) {
        track.onended = () => {
          if (microphoneStreamRef.current !== stream) return;
          microphoneStreamRef.current = null;
          setMicrophoneStream(null);
          onMicrophoneStream(null);
        };
      }
      setMicrophoneStream(stream);
      onMicrophoneStream(stream);
    } catch (error) {
      console.warn("Microphone access failed:", error);
      if (mountedRef.current) {
        setMicrophoneError("Microphone permission was denied or no microphone is available.");
      }
    } finally {
      if (mountedRef.current) setMicrophoneLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-3 shadow-[0_18px_50px_rgba(15,23,42,0.4)]">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Interview Camera</p>
          <h2 className="mt-1 text-base font-semibold text-white">Candidate Webcam</h2>
        </div>

        <span
          className={[
            "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em]",
            status === "ready"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : status === "loading"
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-rose-500/40 bg-rose-500/10 text-rose-300",
          ].join(" ")}
        >
          <span
            className={[
              "h-1.5 w-1.5 rounded-full",
              status === "ready"
                ? "bg-emerald-400"
                : status === "loading"
                  ? "bg-amber-400 animate-pulse"
                  : "bg-rose-400",
            ].join(" ")}
          />
          {status === "ready" ? "Live" : status === "loading" ? "Starting" : "Unavailable"}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-400">
          {microphoneStream
            ? "Mic audio is shared with the proctor and screened locally for possible synthetic speech."
            : "Allow microphone access to answer aloud. Possible synthetic-audio alerts save a webcam screenshot for proctor review."}
        </p>
        <button
          type="button"
          onClick={() => void toggleMicrophone()}
          disabled={microphoneLoading}
          aria-pressed={microphoneStream !== null}
          className={[
            "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition",
            microphoneStream
              ? "border-rose-700 bg-rose-950/60 text-rose-200 hover:bg-rose-900/70"
              : "border-indigo-700 bg-indigo-950/60 text-indigo-100 hover:bg-indigo-900/70",
          ].join(" ")}
        >
          {microphoneStream ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          {microphoneLoading ? "Connecting microphone..." : microphoneStream ? "Turn microphone off" : "Enable microphone"}
        </button>
      </div>
      {microphoneError && (
        <p role="alert" className="mb-3 text-xs text-rose-300">
          {microphoneError}
        </p>
      )}
      {microphoneStream && (
        <p
          role={audioSpoofMonitorStatus === "error" ? "alert" : "status"}
          className={`mb-3 text-xs ${
            audioSpoofMonitorStatus === "error"
              ? "text-rose-300"
              : audioSpoofMonitorStatus === "ready"
                ? "text-emerald-300"
                : "text-slate-400"
          }`}
        >
          {audioSpoofMonitorStatus === "loading"
            ? "Loading experimental audio screening..."
            : audioSpoofMonitorStatus === "ready"
              ? "Experimental AASIST-L audio screening is active. It can be wrong; alerts are not proof."
              : audioSpoofMonitorStatus === "error"
                ? "Audio screening is unavailable. Your microphone can still be used for the interview."
                : ""}
        </p>
      )}

      <div className="relative overflow-hidden rounded-[1.4rem] border border-slate-700 bg-slate-950 shadow-inner shadow-slate-950/80">
        <div className="absolute inset-0 bg-gradient-to-tr from-slate-900/40 via-transparent to-slate-700/30" />

        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="relative z-10 h-[360px] w-full object-cover object-center bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_48%)] sm:h-[420px]"
        />

        <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent px-4 py-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Status</p>
            <p className="text-sm font-medium text-white">
              {status === "ready" ? "Your camera is active" : status === "loading" ? "Preparing camera" : "Camera access needed"}
            </p>
          </div>

          <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-200 backdrop-blur-sm">
            Face view
          </div>
        </div>
      </div>
    </div>
  );
}
