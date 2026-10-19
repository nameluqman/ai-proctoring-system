// app/proctor/page.tsx
"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Header from "@/components/shared/Header";
import MetricsCards from "@/components/proctor/MetricsCards";
import LiveStreamFeed from "@/components/proctor/LiveStreamFeed";
import TelemetryLogger from "@/components/proctor/TelemetryLogger";
import { usePeer } from "@/hooks/usePeer";
import type { EvidenceSnapshot } from "@/types/telemetry";

interface ActivityLog {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

function ProctorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const getOrCreateRoomId = () => {
    if (typeof window === "undefined") return "demo-room";

    const key = "proctor-room-id";
    const stored = window.sessionStorage.getItem(key);

    if (stored) return stored;

    const nextRoomId = `room-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    window.sessionStorage.setItem(key, nextRoomId);
    return nextRoomId;
  };
  
  const rawRoomId = searchParams.get("room");
  const roomId = rawRoomId || getOrCreateRoomId();
  
  useEffect(() => {
    if (!rawRoomId && typeof window !== "undefined") {
      const nextRoomId = getOrCreateRoomId();
      if (window.location.search !== `?room=${nextRoomId}`) {
        router.replace(`/proctor?room=${nextRoomId}`);
      }
    }
  }, [rawRoomId, router]);
  
  const proctorPeerId = `proctor-${roomId}`;
  const { isConnected, peerReady, peerRef } = usePeer(proctorPeerId);
  
  const [hasLiveFeed, setHasLiveFeed] = useState<boolean>(false);
  const [hasScreenFeed, setHasScreenFeed] = useState<boolean>(false);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [evidenceSnapshots, setEvidenceSnapshots] = useState<EvidenceSnapshot[]>([]);
  const [mouseDepartures, setMouseDepartures] = useState(0);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [unfocusEvents, setUnfocusEvents] = useState(0);
  const [clipboardActions, setClipboardActions] = useState(0);
  const [externalDeviceCount, setExternalDeviceCount] = useState(0);
  const [multipleFaceCount, setMultipleFaceCount] = useState(0);
  const [noFaceCount, setNoFaceCount] = useState(0);
  const [gazeDeviationCount, setGazeDeviationCount] = useState(0);
  const [audioAiAlertCount, setAudioAiAlertCount] = useState(0);
  const [sharedDisplayMismatchCount, setSharedDisplayMismatchCount] = useState(0);
  const [screenAwaySeconds, setScreenAwaySeconds] = useState(0);
  const [screenAwaySince, setScreenAwaySince] = useState<number | null>(null);
  const [liveAwaySeconds, setLiveAwaySeconds] = useState(0);
  const [scratchpadText, setScratchpadText] = useState("");
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const activeAwaySinceRef = useRef<number | null>(null);
  const totalMistakes =
    tabSwitches +
    unfocusEvents +
    mouseDepartures +
    clipboardActions +
    externalDeviceCount +
    multipleFaceCount +
    noFaceCount +
    gazeDeviationCount +
    audioAiAlertCount +
    sharedDisplayMismatchCount;

  useEffect(() => {
    if (screenAwaySince === null) return;

    const tick = () => {
      setLiveAwaySeconds(Math.floor((Date.now() - screenAwaySince!) / 1000));
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [screenAwaySince]);

  const displayAwaySeconds = screenAwaySeconds + (screenAwaySince ? liveAwaySeconds : 0);

  useEffect(() => {
    let isActive = true;

    const loadEvidence = async () => {
      try {
        const response = await fetch(`/api/evidence?roomId=${encodeURIComponent(roomId)}`, { cache: "no-store" });
        if (!response.ok) return;

        const data = (await response.json()) as { snapshots?: EvidenceSnapshot[] };
        if (isActive) setEvidenceSnapshots(data.snapshots ?? []);
      } catch (error) {
        console.warn("Could not load proctoring evidence:", error);
      }
    };

    void loadEvidence();
    const timer = window.setInterval(loadEvidence, 750);

    return () => {
      isActive = false;
      window.clearInterval(timer);
    };
  }, [roomId]);

  useEffect(() => {
    const peer = peerRef.current;
    if (!peerReady || !peer) return;

    const handleConnection = (conn: any) => {
      conn.on("data", (data: ActivityLog & { presence?: boolean; data?: string }) => {
        const eventType = String(data.type ?? "");
        const payloadId = String(data.id ?? `${eventType}-${data.message ?? "message"}-${data.timestamp ?? Date.now()}`);

        if (seenEventIdsRef.current.has(payloadId)) {
          return;
        }
        seenEventIdsRef.current.add(payloadId);

        const isPresenceReturn = data.presence === true && eventType !== "SCRATCHPAD_UPDATE";
        const returnedFromAway = isPresenceReturn && activeAwaySinceRef.current !== null;

        const normalizedLog: ActivityLog = {
          ...data,
          id: data.id || `${eventType}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: returnedFromAway ? "CANDIDATE_RETURNED" : eventType,
          message: returnedFromAway
            ? `Candidate came back. ${data.message || "Candidate returned to the assessment."}`
            : data.message || `Candidate triggered ${eventType}.`,
          timestamp: data.timestamp || new Date().toLocaleTimeString(),
        };

        setLogs((prev) => [normalizedLog, ...prev]);

        if (eventType === "SCRATCHPAD_UPDATE" && typeof (data as any).data === "string") {
          setScratchpadText((data as any).data);
          return;
        }

        if (
          data.presence === false &&
          eventType !== "TAB_RETURN" &&
          eventType !== "WINDOW_FOCUS" &&
          eventType !== "MOUSE_ENTER" &&
          eventType !== "AI_LISTENING_DETECTED" &&
          eventType !== "AI_AUDIO_DETECTED"
        ) {
          const awayStartedAt = Date.now();
          activeAwaySinceRef.current ??= awayStartedAt;
          setScreenAwaySince((prev) => prev ?? awayStartedAt);
          setLiveAwaySeconds(0);
        }

        if (isPresenceReturn) {
          const awayStartedAt = activeAwaySinceRef.current;
          if (awayStartedAt !== null) {
            const partialSeconds = Math.max(0, Math.floor((Date.now() - awayStartedAt) / 1000));
            setScreenAwaySeconds((total) => total + partialSeconds);
            activeAwaySinceRef.current = null;
            setScreenAwaySince(null);
            setLiveAwaySeconds(0);
          }
        }

        switch (eventType) {
          case "TAB_SWITCH":
            setTabSwitches((c) => c + 1);
            break;
          case "WINDOW_UNFOCUS":
            setUnfocusEvents((c) => c + 1);
            break;
          case "MOUSE_DEPARTURE":
            setMouseDepartures((c) => c + 1);
            break;
          case "CLIPBOARD_ACTION":
            setClipboardActions((c) => c + 1);
            break;
          case "EXTERNAL_DEVICE_DETECTED":
            setExternalDeviceCount((c) => c + 1);
            break;
          case "MULTIPLE_FACES_DETECTED":
            setMultipleFaceCount((c) => c + 1);
            break;
          case "NO_FACE_DETECTED":
            setNoFaceCount((c) => c + 1);
            break;
          case "GAZE_DEVIATION":
            setGazeDeviationCount((c) => c + 1);
            break;
          case "AI_LISTENING_DETECTED":
          case "AI_AUDIO_DETECTED":
            setAudioAiAlertCount((c) => c + 1);
            break;
          case "SHARED_DISPLAY_MISMATCH":
            setSharedDisplayMismatchCount((c) => c + 1);
            break;
          default:
            break;
        }
      });
    };

    peer.on("connection", handleConnection);

    return () => {
      peer.off("connection", handleConnection);
    };
  }, [peerReady, peerRef]);

  const handleFlag = () => {
    const flagLog: ActivityLog = {
      id: Math.random().toString(36).substring(2, 9),
      type: "FLAGGED",
      message: "Proctor manually flagged suspicious activity.",
      timestamp: new Date().toLocaleTimeString(),
    };
    setLogs((prev) => [flagLog, ...prev]);
  };

  const handleClearLogs = () => {
    setLogs([]);
    setTabSwitches(0);
    setUnfocusEvents(0);
    setMouseDepartures(0);
    setClipboardActions(0);
    setExternalDeviceCount(0);
    setMultipleFaceCount(0);
    setNoFaceCount(0);
    setGazeDeviationCount(0);
    setAudioAiAlertCount(0);
    setSharedDisplayMismatchCount(0);
    setScreenAwaySeconds(0);
    setScreenAwaySince(null);
    setLiveAwaySeconds(0);
    activeAwaySinceRef.current = null;
    seenEventIdsRef.current.clear();
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.18),_transparent_32%),linear-gradient(180deg,#020817_0%,#020b1f_100%)] text-slate-100 flex flex-col font-sans">
      <Header
        title="Interviewer Station"
        role="proctor"
        badgeText={isConnected ? "Candidate Connected" : "Waiting for Candidate"}
        badgeType={isConnected ? "success" : "warning"}
        roomId={roomId}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        <MetricsCards
          totalViolations={totalMistakes}
          screenAwaySeconds={displayAwaySeconds}
          stats={{
            tabSwitches,
            unfocusEvents,
            mouseDepartures,
            clipboardActions,
            externalDeviceCount,
            multipleFaceCount,
            noFaceCount,
            gazeDeviationCount,
            audioAiAlertCount,
            sharedDisplayMismatchCount,
          }}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_0.85fr] gap-6 items-start">
          <LiveStreamFeed
            hasLiveFeed={hasLiveFeed}
            setHasLiveFeed={setHasLiveFeed}
            hasScreenFeed={hasScreenFeed}
            setHasScreenFeed={setHasScreenFeed}
            peerRef={peerRef}
            peerReady={peerReady}
            onFlag={handleFlag}
            onClearLogs={handleClearLogs}
          />

          <div className="space-y-6">
            <TelemetryLogger logs={logs} scratchpadText={scratchpadText} evidenceSnapshots={evidenceSnapshots} />
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ProctorPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400 text-sm">Loading proctor session...</div>}>
      <ProctorContent />
    </Suspense>
  );
}