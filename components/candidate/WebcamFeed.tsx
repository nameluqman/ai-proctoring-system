"use client";

import React, { useEffect, useState } from "react";

interface WebcamFeedProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export default function WebcamFeed({ videoRef }: WebcamFeedProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let stream: MediaStream | null = null;

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

        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        await video.play();
        setStatus("ready");
      } catch (error) {
        console.warn("Webcam access failed:", error);
        setStatus("error");
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [videoRef]);

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
