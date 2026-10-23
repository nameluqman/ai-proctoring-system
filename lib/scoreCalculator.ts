import {
  INTEGRITY_VIOLATION_TYPES,
  type EventLog,
  type IntegrityRiskLevel,
  type IntegrityViolationCounts,
  type IntegrityViolationType,
} from "@/types/telemetry";

const DEDUCTION_POINTS: Record<IntegrityViolationType, number> = {
  TAB_SWITCH: 10,
  WINDOW_UNFOCUS: 10,
  MOUSE_DEPARTURE: 3,
  CLIPBOARD_ACTION: 3,
  EXTERNAL_DEVICE_DETECTED: 20,
  MULTIPLE_FACES_DETECTED: 15,
  NO_FACE_DETECTED: 10,
  GAZE_DEVIATION: 5,
  SYNTHETIC_AUDIO_SUSPECTED: 20,
  SHARED_DISPLAY_MISMATCH: 10,
};

function emptyViolationCounts(): IntegrityViolationCounts {
  return Object.fromEntries(INTEGRITY_VIOLATION_TYPES.map((type) => [type, 0])) as IntegrityViolationCounts;
}

export function calculateViolationCounts(events: EventLog[]): IntegrityViolationCounts {
  const counts = emptyViolationCounts();
  for (const event of events) {
    if (INTEGRITY_VIOLATION_TYPES.includes(event.type as IntegrityViolationType)) {
      counts[event.type as IntegrityViolationType] += 1;
    }
  }
  return counts;
}

export function calculateAwaySeconds(events: EventLog[], finishedAt: string): number {
  const orderedEvents = events
    .filter((event) => event.presence !== undefined)
    .map((event) => ({ ...event, time: Date.parse(event.timestamp) }))
    .filter((event) => Number.isFinite(event.time))
    .sort((left, right) => left.time - right.time);

  let awayStartedAt: number | null = null;
  let awayMilliseconds = 0;

  for (const event of orderedEvents) {
    if (event.presence === false) {
      awayStartedAt ??= event.time;
    } else if (awayStartedAt !== null) {
      awayMilliseconds += Math.max(0, event.time - awayStartedAt);
      awayStartedAt = null;
    }
  }

  if (awayStartedAt !== null) {
    const finishTime = Date.parse(finishedAt);
    if (Number.isFinite(finishTime)) {
      awayMilliseconds += Math.max(0, finishTime - awayStartedAt);
    }
  }

  return Math.floor(awayMilliseconds / 1000);
}

export function calculateIntegrityScore(
  violationCounts: IntegrityViolationCounts,
  awaySeconds: number
): { integrityScore: number; riskLevel: IntegrityRiskLevel; timePenaltyPoints: number } {
  const violationPenalty = INTEGRITY_VIOLATION_TYPES.reduce(
    (total, type) => total + violationCounts[type] * DEDUCTION_POINTS[type],
    0
  );
  const timePenaltyPoints = Math.min(20, Math.ceil(Math.max(0, awaySeconds - 10) / 10));
  const integrityScore = Math.max(0, 100 - violationPenalty - timePenaltyPoints);
  const riskLevel: IntegrityRiskLevel =
    integrityScore > 85 ? "low" : integrityScore >= 60 ? "medium" : "high";

  return { integrityScore, riskLevel, timePenaltyPoints };
}

export function getViolationDeduction(type: IntegrityViolationType) {
  return DEDUCTION_POINTS[type];
}