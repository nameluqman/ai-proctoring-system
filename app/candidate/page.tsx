// app/candidate/page.tsx
"use client";

import React, { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/shared/Header";
import Scratchpad from "@/components/candidate/Scratchpad";
import WebcamFeed from "@/components/candidate/WebcamFeed";
import { usePeer } from "@/hooks/usePeer";
import { usePresenceTracker } from "@/hooks/usePresenceTracker";
import { SCREEN_SHARE_REJECTION_MESSAGE, useScreenShare } from "@/hooks/useScreenShare";
import { useWebcamAI } from "@/hooks/useWebcamAI";
import { useAudioMonitor } from "@/hooks/useAudioMonitor";
import { AlertCircle, MonitorUp, Square } from "lucide-react";

const MISTAKE_EVENT_TYPES = new Set([
  "TAB_SWITCH",
  "WINDOW_UNFOCUS",
  "MOUSE_DEPARTURE",
  "CLIPBOARD_ACTION",
  "CONTEXT_MENU",
  "EXTERNAL_DEVICE_DETECTED",
  "MULTIPLE_FACES_DETECTED",
  "NO_FACE_DETECTED",
  "GAZE_DEVIATION",
  "AI_LISTENING_DETECTED",
  "AI_AUDIO_DETECTED",
  "SCREEN_SHARE_REJECTED",
  "SHARED_DISPLAY_MISMATCH",
]);

const WEBCAM_EVIDENCE_TYPES = new Set([
  "EXTERNAL_DEVICE_DETECTED",
  "MULTIPLE_FACES_DETECTED",
  "NO_FACE_DETECTED",
  "GAZE_DEVIATION",
  "AI_LISTENING_DETECTED",
]);

const SCREEN_TRANSITION_EVENT_TYPES = new Set(["TAB_SWITCH", "WINDOW_UNFOCUS"]);
const MIN_BROWSER_WINDOW_WIDTH = 1024;
const WINDOW_SHRINK_RATIO = 0.8;
const WINDOW_LAYOUT_CHECK_INTERVAL_MS = 500;
const WINDOW_LAYOUT_PERSISTENCE_MS = 2000;
const ALLOWED_WINDOW_ASPECT_RATIOS = [16 / 9, 16 / 10, 4 / 3, 9 / 16, 10 / 16, 3 / 4];
const WINDOW_ASPECT_RATIO_TOLERANCE = 0.1;

function hasAllowedWindowAspectRatio(width: number, height: number) {
  if (width <= 0 || height <= 0) return false;

  const currentRatio = width / height;
  return ALLOWED_WINDOW_ASPECT_RATIOS.some(
    (allowedRatio) => Math.abs(currentRatio - allowedRatio) <= WINDOW_ASPECT_RATIO_TOLERANCE
  );
}

function CandidateContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room");

  const candidatePeerId = roomId ? `candidate-${roomId}` : "";
  const targetProctorId = roomId ? `proctor-${roomId}` : "";

  const { isConnected, peerReady, peerRef, dataConnRef } = usePeer(candidatePeerId, targetProctorId);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenShareVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenCaptureStreamRef = useRef<MediaStream | null>(null);
  const largestViewportRef = useRef<{ width: number; height: number } | null>(null);
  const windowLayoutViolationSinceRef = useRef<number | null>(null);
  const windowLayoutMismatchReportedRef = useRef(false);

  const captureEvidence = useCallback(
    async (eventId: string, type: string, message: string) => {
      if (!roomId) {
        return;
      }

      if (SCREEN_TRANSITION_EVENT_TYPES.has(type)) {
        await new Promise((resolve) => window.setTimeout(resolve, 700));
      }

      const webcamVideo = webcamVideoRef.current;
      const screenVideo = screenShareVideoRef.current;
      const webcamReady = !!webcamVideo && webcamVideo.readyState >= 2 && webcamVideo.videoWidth > 0;
      const screenReady = !!screenCaptureStreamRef.current?.active && !!screenVideo && screenVideo.readyState >= 2 && screenVideo.videoWidth > 0;
      const preferWebcam = WEBCAM_EVIDENCE_TYPES.has(type) && webcamReady;

      const video = preferWebcam ? webcamVideo : screenReady ? screenVideo : webcamReady ? webcamVideo : null;
      if (!video || video.readyState < 2 || !video.videoWidth) {
        return;
      }

      let frame: CanvasImageSource = video;
      let capturedBitmap: ImageBitmap | null = null;
      const screenTrack = screenCaptureStreamRef.current?.getVideoTracks()[0];
      const ImageCaptureConstructor = (window as unknown as {
        ImageCapture?: new (track: MediaStreamTrack) => { grabFrame: () => Promise<ImageBitmap> };
      }).ImageCapture;

      if (SCREEN_TRANSITION_EVENT_TYPES.has(type) && screenTrack && ImageCaptureConstructor) {
        try {
          capturedBitmap = await new ImageCaptureConstructor(screenTrack).grabFrame();
          frame = capturedBitmap;
        } catch {
          // Fall back to the latest frame already rendered by the screen-share video.
        }
      }

      const canvas = document.createElement("canvas");
      const frameWidth = capturedBitmap?.width ?? video.videoWidth;
      const frameHeight = capturedBitmap?.height ?? video.videoHeight;
      const scale = Math.min(1, 1600 / frameWidth);
      canvas.width = Math.round(frameWidth * scale);
      canvas.height = Math.round(frameHeight * scale);
      canvas.getContext("2d")?.drawImage(frame, 0, 0, canvas.width, canvas.height);
      capturedBitmap?.close();

      const screenshot = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.72);
      });
      if (!screenshot) return;

      const formData = new FormData();
      formData.append("screenshot", screenshot, `${eventId}.jpg`);
      formData.append("roomId", roomId);
      formData.append("eventId", eventId);
      formData.append("type", type);
      formData.append("message", message);

      const response = await fetch("/api/evidence", { method: "POST", body: formData });
      if (!response.ok) {
        console.warn("Could not save proctoring evidence:", await response.text());
      }
    },
    [roomId]
  );

  // Send telemetry logs across the PeerJS Data Connection
  const sendTelemetryEvent = useCallback(
    (type: string, message: string, presenceState?: boolean) => {
      const eventId = crypto.randomUUID();
      if (dataConnRef.current && dataConnRef.current.open) {
        dataConnRef.current.send({
          id: eventId,
          type,
          message,
          presence: presenceState,
          timestamp: new Date().toLocaleTimeString(),
        });
      }
      if (MISTAKE_EVENT_TYPES.has(type)) {
        void captureEvidence(eventId, type, message).catch((error) => {
          console.warn("Could not capture proctoring evidence:", error);
        });
      }
    },
    [captureEvidence, dataConnRef]
  );

  const [scratchpadText, setScratchpadText] = useState("");

  const handleScratchpadChange = useCallback(
    (nextValue: string) => {
      setScratchpadText(nextValue);
      if (dataConnRef.current && dataConnRef.current.open) {
        dataConnRef.current.send({
          id: Math.random().toString(36).substring(2, 9),
          type: "SCRATCHPAD_UPDATE",
          message: "Candidate updated scratchpad.",
          timestamp: new Date().toLocaleTimeString(),
          presence: true,
          data: nextValue,
        });
      }
    },
    [dataConnRef]
  );

  const webcamCallRef = useRef<any>(null);
  const screenShareCallRef = useRef<any>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const { isSharing: isShareActive, stream: screenShareStream, startShare, stopShare, shareError } = useScreenShare(() => {
    setIsScreenSharing(false);
    screenCaptureStreamRef.current = null;
    if (screenShareCallRef.current) {
      screenShareCallRef.current.close();
      screenShareCallRef.current = null;
    }
    if (screenShareVideoRef.current) {
      screenShareVideoRef.current.srcObject = null;
    }
    sendTelemetryEvent("SCREEN_SHARE_STOPPED", "Full screen share ended.", true);
  });

  const { prepareSystemAudioCapture } = useAudioMonitor({
    onEvent: sendTelemetryEvent,
    enabled: true,
    systemAudioStream: screenShareStream,
  });

  const startPeerMediaCall = useCallback(
    (stream: MediaStream, source: "webcam" | "screen", eventType: string, message: string) => {
      if (!peerRef.current || !targetProctorId) return;

      const existingCall = source === "webcam" ? webcamCallRef.current : screenShareCallRef.current;
      if (existingCall) {
        existingCall.close();
      }

      const callStream = source === "screen" ? new MediaStream(stream.getVideoTracks()) : stream;
      const call = peerRef.current.call(targetProctorId, callStream, {
        metadata: { source },
      });

      if (source === "webcam") {
        webcamCallRef.current = call;
      } else {
        screenShareCallRef.current = call;
      }
      sendTelemetryEvent(eventType, message, true);
    },
    [peerRef, targetProctorId, sendTelemetryEvent]
  );

  const handleScreenShareToggle = useCallback(async () => {
    if (isScreenSharing || isShareActive) {
      stopShare();
      setIsScreenSharing(false);
      screenCaptureStreamRef.current = null;
      if (screenShareCallRef.current) {
        screenShareCallRef.current.close();
        screenShareCallRef.current = null;
      }
      if (screenShareVideoRef.current) {
        screenShareVideoRef.current.srcObject = null;
      }
      sendTelemetryEvent("SCREEN_SHARE_STOPPED", "Candidate stopped sharing the full screen.", true);
      return;
    }

    prepareSystemAudioCapture();
    const stream = await startShare();
    if (!stream) {
      sendTelemetryEvent(
        "SCREEN_SHARE_REJECTED",
        SCREEN_SHARE_REJECTION_MESSAGE,
        false
      );
      return;
    }

    screenCaptureStreamRef.current = stream;
    if (screenShareVideoRef.current) {
      screenShareVideoRef.current.srcObject = stream;
      screenShareVideoRef.current.play().catch(() => undefined);
    }

    setIsScreenSharing(true);
    startPeerMediaCall(stream, "screen", "SCREEN_SHARE_STARTED", "Candidate started full screen share.");
  }, [isScreenSharing, isShareActive, sendTelemetryEvent, startShare, stopShare, startPeerMediaCall, prepareSystemAudioCapture]);

  useEffect(() => {
    const checkWindowLayout = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isFullscreen =
        document.fullscreenElement !== null ||
        (window.outerWidth >= window.screen.width - 16 &&
          window.outerHeight >= window.screen.height - 32);
      const isSmallTouchViewport =
        width < MIN_BROWSER_WINDOW_WIDTH && window.matchMedia("(pointer: coarse)").matches;
      const shouldCheckLayout = !isFullscreen && !isSmallTouchViewport;
      if (shouldCheckLayout) {
        const largestViewport = largestViewportRef.current;
        if (!largestViewport) {
          largestViewportRef.current = { width, height };
        } else {
          largestViewport.width = Math.max(largestViewport.width, width);
          largestViewport.height = Math.max(largestViewport.height, height);
        }
      }

      const largestViewport = largestViewportRef.current;
      const isShrunkFromBaseline =
        !!largestViewport &&
        (width < largestViewport.width * WINDOW_SHRINK_RATIO ||
          height < largestViewport.height * WINDOW_SHRINK_RATIO);
      const isShrunk =
        shouldCheckLayout &&
        (width < MIN_BROWSER_WINDOW_WIDTH || isShrunkFromBaseline);
      const hasUnusualRatio =
        shouldCheckLayout && !hasAllowedWindowAspectRatio(width, height);
      const isWindowLayoutInvalid = isShrunk || hasUnusualRatio;

      if (!isWindowLayoutInvalid) {
        windowLayoutViolationSinceRef.current = null;
        windowLayoutMismatchReportedRef.current = false;
        return;
      }

      windowLayoutViolationSinceRef.current ??= Date.now();
      if (
        !windowLayoutMismatchReportedRef.current &&
        Date.now() - windowLayoutViolationSinceRef.current >= WINDOW_LAYOUT_PERSISTENCE_MS
      ) {
        windowLayoutMismatchReportedRef.current = true;
        sendTelemetryEvent(
          "SHARED_DISPLAY_MISMATCH",
          "Candidate browser window is shrunk or in split-screen mode."
        );
      }
    };

    checkWindowLayout();
    const interval = window.setInterval(checkWindowLayout, WINDOW_LAYOUT_CHECK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [sendTelemetryEvent]);

  useWebcamAI({
    videoRef: webcamVideoRef,
    onEvent: sendTelemetryEvent,
    enabled: true,
    intervalMs: 250,
  });

  useEffect(() => {
    if (!peerReady || !targetProctorId || !webcamVideoRef.current || isScreenSharing || isShareActive) return;

    const video = webcamVideoRef.current as (HTMLVideoElement & { captureStream?: () => MediaStream }) | null;
    const startWebcamCall = () => {
      if (!video || !peerRef.current || !targetProctorId) return;

      const stream = typeof video.captureStream === "function" ? video.captureStream() : null;
      if (!stream) return;

      startPeerMediaCall(stream, "webcam", "WEBCAM_STARTED", "Live candidate webcam feed initiated.");
    };

    const timer = window.setTimeout(() => {
      if (video && video.readyState >= 2) {
        startWebcamCall();
      }
    }, 600);

    return () => window.clearTimeout(timer);
  }, [peerReady, peerRef, targetProctorId, isScreenSharing, isShareActive, startPeerMediaCall, sendTelemetryEvent]);

  // Hook for standard visibility change / focus tracking
  usePresenceTracker({ onEvent: sendTelemetryEvent });

  if (!roomId) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 max-w-md text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Invalid Interview Link</h2>
          <p className="text-slate-400 text-xs">
            No active room code detected. Please use the complete link provided by your interviewer.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header
        title="Candidate Assessment"
        role="candidate"
        badgeText={isConnected ? "Connected to Interviewer" : "Connecting..."}
        badgeType={isConnected ? "success" : "warning"}
        roomId={roomId}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-400 uppercase tracking-[0.2em]">
            Share mode: full screen with system audio
          </div>
          <button
            type="button"
            onClick={handleScreenShareToggle}
            className={[
              "inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all",
              isScreenSharing || isShareActive
                ? "border-rose-700 bg-rose-950/60 text-rose-200 hover:bg-rose-900/70"
                : "border-indigo-700 bg-indigo-950/60 text-indigo-100 hover:bg-indigo-900/70",
            ].join(" ")}
          >
            {isScreenSharing || isShareActive ? <Square className="h-4 w-4" /> : <MonitorUp className="h-4 w-4" />}
            {isScreenSharing || isShareActive ? "Stop Full Screen Share" : "Share Full Screen"}
          </button>
        </div>

        {shareError && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{shareError}</p>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <WebcamFeed videoRef={webcamVideoRef} />

          <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-3 shadow-[0_18px_50px_rgba(15,23,42,0.4)]">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Screen Share</p>
                <h2 className="mt-1 text-base font-semibold text-white">Full Screen Preview</h2>
              </div>
              <span
                className={[
                  "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em]",
                  isScreenSharing || isShareActive
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border-slate-600 bg-slate-800/60 text-slate-300",
                ].join(" ")}
              >
                <span
                  className={[
                    "h-1.5 w-1.5 rounded-full",
                    isScreenSharing || isShareActive ? "bg-emerald-400 animate-pulse" : "bg-slate-400",
                  ].join(" ")}
                />
                {isScreenSharing || isShareActive ? "Live" : "Idle"}
              </span>
            </div>

            <div className="relative overflow-hidden rounded-[1.4rem] border border-slate-700 bg-slate-950 shadow-inner shadow-slate-950/80">
              <video
                ref={screenShareVideoRef}
                autoPlay
                muted
                playsInline
                className="relative z-10 h-[360px] w-full bg-slate-950 object-contain object-center sm:h-[420px]"
              />

              {!isScreenSharing && !isShareActive && !shareError && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/70 text-center p-6">
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.26em] text-slate-400">Full Screen + Audio Required</p>
                    <p className="text-sm text-slate-200">Share the entire screen and enable system audio.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <Scratchpad value={scratchpadText} onChange={handleScratchpadChange} />
      </main>
    </div>
  );
}

export default function CandidatePage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400 text-sm">Loading candidate environment...</div>}>
      <CandidateContent />
    </Suspense>
  );
}