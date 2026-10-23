// app/candidate/page.tsx
"use client";

import React, { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/shared/Header";
import Scratchpad from "@/components/candidate/Scratchpad";
import WebcamFeed from "@/components/candidate/WebcamFeed";
import { usePeer } from "@/hooks/usePeer";
import { usePresenceTracker } from "@/hooks/usePresenceTracker";
import { useScreenShare } from "@/hooks/useScreenShare";
import { useWebcamAI } from "@/hooks/useWebcamAI";
import { useAudioSpoofMonitor } from "@/hooks/useAudioSpoofMonitor";
import { AlertCircle, CheckCircle2, LoaderCircle, MonitorUp, Square } from "lucide-react";
import type { MediaConnection } from "peerjs";
import { INTEGRITY_VIOLATION_TYPES, type EventLog, type IntegrityViolationType } from "@/types/telemetry";

const MAX_STORED_TELEMETRY_EVENTS = 10_000;
const INTEGRITY_VIOLATION_TYPE_SET = new Set<string>(INTEGRITY_VIOLATION_TYPES);

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
  "SYNTHETIC_AUDIO_SUSPECTED",
  "SHARED_DISPLAY_MISMATCH",
]);

const WEBCAM_EVIDENCE_TYPES = new Set([
  "EXTERNAL_DEVICE_DETECTED",
  "MULTIPLE_FACES_DETECTED",
  "NO_FACE_DETECTED",
  "GAZE_DEVIATION",
  "SYNTHETIC_AUDIO_SUSPECTED",
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
  const router = useRouter();
  const roomId = searchParams.get("room");

  const candidatePeerId = roomId ? `candidate-${roomId}` : "";
  const targetProctorId = roomId ? `proctor-${roomId}` : "";

  const { isConnected, peerReady, peerRef, dataConnRef } = usePeer(candidatePeerId, targetProctorId);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const sessionStartedAtRef = useRef<string | null>(null);
  const telemetryEventsRef = useRef<EventLog[]>([]);
  const omittedEventCountRef = useRef(0);
  const omittedViolationCountsRef = useRef<Partial<Record<IntegrityViolationType, number>>>({});
  const pendingEvidenceRef = useRef(new Set<Promise<void>>());
  const isFinishingRef = useRef(false);
  const finishTimestampRef = useRef<string | null>(null);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [microphoneStream, setMicrophoneStream] = useState<MediaStream | null>(null);
  const [monitoringEnabled, setMonitoringEnabled] = useState(true);
  const [isFinishing, setIsFinishing] = useState(false);
  const [interviewFinished, setInterviewFinished] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const screenShareVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenCaptureStreamRef = useRef<MediaStream | null>(null);
  const largestViewportRef = useRef<{ width: number; height: number } | null>(null);
  const windowLayoutViolationSinceRef = useRef<number | null>(null);
  const windowLayoutMismatchReportedRef = useRef(false);

  useEffect(() => {
    sessionStartedAtRef.current ??= new Date().toISOString();
  }, []);

  const captureEvidence = useCallback(
    async (eventId: string, type: string, message: string, confidenceScore?: number) => {
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
      const context = canvas.getContext("2d");
      if (!context) {
        capturedBitmap?.close();
        throw new Error("Could not create a canvas context for the evidence screenshot.");
      }
      try {
        context.drawImage(frame, 0, 0, canvas.width, canvas.height);
      } finally {
        capturedBitmap?.close();
      }

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
      if (confidenceScore !== undefined) {
        formData.append("confidenceScore", String(confidenceScore));
      }

      const response = await fetch("/api/evidence", {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        console.warn("Could not save proctoring evidence:", await response.text());
      }
    },
    [roomId]
  );

  // Send telemetry logs across the PeerJS Data Connection
  const sendTelemetryEvent = useCallback(
    (type: string, message: string, presenceState?: boolean, confidenceScore?: number) => {
      const eventId = crypto.randomUUID();
      const timestamp = new Date().toISOString();
      const event: EventLog = {
        id: eventId,
        type,
        message: message.slice(0, 500),
        timestamp,
        ...(presenceState !== undefined ? { presence: presenceState } : {}),
        ...(confidenceScore !== undefined ? { confidenceScore } : {}),
      };
      sessionStartedAtRef.current ??= timestamp;

      if (telemetryEventsRef.current.length < MAX_STORED_TELEMETRY_EVENTS) {
        telemetryEventsRef.current.push(event);
      } else {
        omittedEventCountRef.current += 1;
        if (INTEGRITY_VIOLATION_TYPE_SET.has(type)) {
          const violationType = type as IntegrityViolationType;
          omittedViolationCountsRef.current[violationType] =
            (omittedViolationCountsRef.current[violationType] ?? 0) + 1;
        }
      }

      if (dataConnRef.current && dataConnRef.current.open) {
        dataConnRef.current.send({
          ...event,
        });
      }
      if (MISTAKE_EVENT_TYPES.has(type)) {
        const pendingCapture = captureEvidence(eventId, type, message, confidenceScore).catch((error) => {
          console.warn("Could not capture proctoring evidence:", error);
        });
        pendingEvidenceRef.current.add(pendingCapture);
        void pendingCapture.finally(() => pendingEvidenceRef.current.delete(pendingCapture));
      }
      return event;
    },
    [captureEvidence, dataConnRef]
  );

  const [scratchpadText, setScratchpadText] = useState("");
  const handleWebcamStream = useCallback((stream: MediaStream) => {
    setWebcamStream(stream);
  }, []);
  const handleMicrophoneStream = useCallback((stream: MediaStream | null) => {
    setMicrophoneStream(stream);
  }, []);
  const handleSyntheticAudioSuspected = useCallback(
    (message: string, confidenceScore?: number) =>
      sendTelemetryEvent("SYNTHETIC_AUDIO_SUSPECTED", message, undefined, confidenceScore),
    [sendTelemetryEvent]
  );
  const audioSpoofMonitorStatus = useAudioSpoofMonitor(
    monitoringEnabled ? microphoneStream : null,
    handleSyntheticAudioSuspected
  );

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

  const webcamCallRef = useRef<MediaConnection | null>(null);
  const screenShareCallRef = useRef<MediaConnection | null>(null);
  const microphoneCallRef = useRef<MediaConnection | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const { isSharing: isShareActive, startShare, stopShare, shareError } = useScreenShare(() => {
    setIsScreenSharing(false);
    screenCaptureStreamRef.current = null;
    if (screenShareCallRef.current) {
      screenShareCallRef.current.close();
      screenShareCallRef.current = null;
    }
    if (screenShareVideoRef.current) {
      screenShareVideoRef.current.srcObject = null;
    }
    if (!isFinishingRef.current) {
      sendTelemetryEvent("SCREEN_SHARE_STOPPED", "Full screen share ended.", true);
    }
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
    if (!monitoringEnabled) return;

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

    const stream = await startShare();
    if (!stream) return;

    screenCaptureStreamRef.current = stream;
    if (screenShareVideoRef.current) {
      screenShareVideoRef.current.srcObject = stream;
      screenShareVideoRef.current.play().catch(() => undefined);
    }

    setIsScreenSharing(true);
    startPeerMediaCall(stream, "screen", "SCREEN_SHARE_STARTED", "Candidate started full screen share.");
  }, [isScreenSharing, isShareActive, monitoringEnabled, sendTelemetryEvent, startShare, stopShare, startPeerMediaCall]);

  useEffect(() => {
    if (!monitoringEnabled || !peerReady || !targetProctorId || !microphoneStream) return;

    const call = peerRef.current?.call(targetProctorId, microphoneStream, {
      metadata: { source: "audio" },
    });
    if (!call) return;

    microphoneCallRef.current = call;
    call.on("error", (error) => {
      console.error("Candidate microphone stream failed:", error);
    });

    return () => {
      call.close();
      if (microphoneCallRef.current === call) {
        microphoneCallRef.current = null;
      }
    };
  }, [monitoringEnabled, peerReady, peerRef, targetProctorId, microphoneStream]);

  useEffect(() => {
    if (!monitoringEnabled) return;

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
  }, [monitoringEnabled, sendTelemetryEvent]);

  useWebcamAI({
    videoRef: webcamVideoRef,
    onEvent: sendTelemetryEvent,
    enabled: monitoringEnabled,
    intervalMs: 250,
  });

  useEffect(() => {
    if (!monitoringEnabled || !peerReady || !targetProctorId || !webcamStream || isScreenSharing || isShareActive) return;

    startPeerMediaCall(webcamStream, "webcam", "WEBCAM_STARTED", "Live candidate webcam feed initiated.");

    return () => {
      webcamCallRef.current?.close();
      webcamCallRef.current = null;
    };
  }, [monitoringEnabled, peerReady, targetProctorId, webcamStream, isScreenSharing, isShareActive, startPeerMediaCall]);

  // Hook for standard visibility change / focus tracking
  usePresenceTracker({ onEvent: sendTelemetryEvent, enabled: monitoringEnabled });

  const handleFinishInterview = useCallback(async () => {
    if (!roomId || isFinishingRef.current || interviewFinished) return;

    isFinishingRef.current = true;
    setIsFinishing(true);
    setFinishError(null);
    setMonitoringEnabled(false);

    if (isScreenSharing || isShareActive) {
      sendTelemetryEvent("SCREEN_SHARE_STOPPED", "Screen sharing stopped when the interview was finished.", true);
    }

    try {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      while (pendingEvidenceRef.current.size > 0) {
        await Promise.allSettled([...pendingEvidenceRef.current]);
      }

      stopShare();
      screenCaptureStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenCaptureStreamRef.current = null;
      if (screenShareVideoRef.current) screenShareVideoRef.current.srcObject = null;
      setIsScreenSharing(false);

      webcamCallRef.current?.close();
      webcamCallRef.current = null;
      screenShareCallRef.current?.close();
      screenShareCallRef.current = null;
      microphoneCallRef.current?.close();
      microphoneCallRef.current = null;
      webcamStream?.getTracks().forEach((track) => track.stop());
      microphoneStream?.getTracks().forEach((track) => track.stop());
      setWebcamStream(null);
      setMicrophoneStream(null);

      if (!finishTimestampRef.current) {
        const finishEvent = sendTelemetryEvent(
          "INTERVIEW_FINISHED",
          "Candidate submitted the completed interview.",
          true
        );
        finishTimestampRef.current = finishEvent.timestamp;
      }

      const response = await fetch("/api/interview/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          startedAt: sessionStartedAtRef.current ?? finishTimestampRef.current,
          finishedAt: finishTimestampRef.current,
          events: telemetryEventsRef.current,
          telemetryTruncated: omittedEventCountRef.current > 0,
          omittedEventCount: omittedEventCountRef.current,
          omittedViolationCounts: omittedViolationCountsRef.current,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "The interview report could not be saved.");
      }

      setInterviewFinished(true);
      router.replace(`/candidate/complete?room=${encodeURIComponent(roomId)}`);
    } catch (error) {
      console.error("Could not finish the interview and save its report:", error);
      setFinishError(error instanceof Error ? error.message : "The interview report could not be saved.");
    } finally {
      isFinishingRef.current = false;
      setIsFinishing(false);
    }
  }, [
    interviewFinished,
    isScreenSharing,
    isShareActive,
    microphoneStream,
    roomId,
    router,
    sendTelemetryEvent,
    stopShare,
    webcamStream,
  ]);

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

  if (interviewFinished) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <Header title="Interview Complete" role="candidate" badgeText="Report submitted" badgeType="success" roomId={roomId} />
        <main className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center p-6">
          <section className="w-full rounded-2xl border border-emerald-800/60 bg-slate-900 p-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
            <h1 className="mt-4 text-xl font-bold text-white">Interview submitted</h1>
            <p className="mt-2 text-sm text-slate-300">
              Monitoring has stopped. Your session events, away time, scorecard, and available screenshots were sent to the proctor.
            </p>
            <p className="mt-4 text-xs text-slate-500">
              The integrity score is an automated review signal, not a finding that misconduct occurred.
            </p>
          </section>
        </main>
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
            Screen sharing is optional; use your microphone for spoken answers
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleScreenShareToggle}
              disabled={!monitoringEnabled}
              className={[
                "inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all",
                isScreenSharing || isShareActive
                  ? "border-rose-700 bg-rose-950/60 text-rose-200 hover:bg-rose-900/70"
                  : "border-indigo-700 bg-indigo-950/60 text-indigo-100 hover:bg-indigo-900/70",
              ].join(" ")}
            >
              {isScreenSharing || isShareActive ? <Square className="h-4 w-4" /> : <MonitorUp className="h-4 w-4" />}
              {isScreenSharing || isShareActive ? "Stop Screen Share" : "Share Screen"}
            </button>
            <button
              type="button"
              onClick={() => void handleFinishInterview()}
              disabled={isFinishing}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-700 bg-rose-950/60 px-4 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-900/70 disabled:cursor-wait disabled:opacity-60"
            >
              {isFinishing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {isFinishing ? "Submitting report..." : "Finish Interview"}
            </button>
          </div>
        </div>

        {finishError && (
          <div role="alert" className="rounded-lg border border-rose-700/50 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
            {finishError} Monitoring has stopped; you can retry report submission.
          </div>
        )}

        {shareError && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{shareError}</p>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <WebcamFeed
            videoRef={webcamVideoRef}
            onStream={handleWebcamStream}
            onMicrophoneStream={handleMicrophoneStream}
            audioSpoofMonitorStatus={audioSpoofMonitorStatus}
            disabled={!monitoringEnabled}
          />

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
                    <p className="text-xs uppercase tracking-[0.26em] text-slate-400">Optional screen share</p>
                    <p className="text-sm text-slate-200">Enable your microphone in the webcam panel to answer aloud.</p>
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