export interface EventLog {
  id: string;
  type: string;
  message: string;
  presence?: boolean;
  timestamp: string;
  confidenceScore?: number;
}

export interface HeadPoseAngles {
  pitch: number;
  yaw: number;
  roll: number;
}

export interface MetricsStats {
  tabSwitches: number;
  windowBlurs: number;
  copyPastes: number;
}

export interface EvidenceSnapshot {
  id: string;
  eventId: string;
  type: string;
  message: string;
  timestamp: string;
  imageUrl: string;
  confidenceScore?: number;
}

export const INTEGRITY_VIOLATION_TYPES = [
  "TAB_SWITCH",
  "WINDOW_UNFOCUS",
  "MOUSE_DEPARTURE",
  "CLIPBOARD_ACTION",
  "EXTERNAL_DEVICE_DETECTED",
  "MULTIPLE_FACES_DETECTED",
  "NO_FACE_DETECTED",
  "GAZE_DEVIATION",
  "SYNTHETIC_AUDIO_SUSPECTED",
  "SHARED_DISPLAY_MISMATCH",
] as const;

export type IntegrityViolationType = (typeof INTEGRITY_VIOLATION_TYPES)[number];
export type IntegrityRiskLevel = "low" | "medium" | "high";

export type IntegrityViolationCounts = Record<IntegrityViolationType, number>;

export interface InterviewReport {
  roomId: string;
  startedAt: string;
  finishedAt: string;
  durationSeconds: number;
  awaySeconds: number;
  integrityScore: number;
  riskLevel: IntegrityRiskLevel;
  timePenaltyPoints: number;
  violationCounts: IntegrityViolationCounts;
  events: EventLog[];
  evidenceSnapshots: EvidenceSnapshot[];
  telemetryTruncated: boolean;
  omittedEventCount: number;
}