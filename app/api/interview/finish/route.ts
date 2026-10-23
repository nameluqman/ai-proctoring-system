import { readRoomEvidence, isValidRoomId } from "@/lib/evidence-store";
import { readInterviewReport, saveInterviewReport } from "@/lib/interview-store";
import {
  calculateAwaySeconds,
  calculateIntegrityScore,
  calculateViolationCounts,
} from "@/lib/scoreCalculator";
import {
  INTEGRITY_VIOLATION_TYPES,
  type EventLog,
  type IntegrityViolationCounts,
  type IntegrityViolationType,
  type InterviewReport,
} from "@/types/telemetry";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 5 * 1024 * 1024;
const MAX_EVENTS = 10_000;
const EVENT_TYPE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) && value === new Date(value).toISOString();
}

function validateEvent(value: unknown): EventLog | null {
  if (!isRecord(value)) return null;

  const confidenceScore = value.confidenceScore;
  if (
    typeof value.id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id) ||
    typeof value.type !== "string" ||
    !EVENT_TYPE_PATTERN.test(value.type) ||
    typeof value.message !== "string" ||
    value.message.length > 500 ||
    !isIsoDate(value.timestamp) ||
    (value.presence !== undefined && typeof value.presence !== "boolean") ||
    (confidenceScore !== undefined &&
      (typeof confidenceScore !== "number" || !Number.isFinite(confidenceScore) || confidenceScore < 0 || confidenceScore > 1))
  ) {
    return null;
  }

  return {
    id: value.id,
    type: value.type,
    message: value.message,
    timestamp: value.timestamp,
    ...(typeof value.presence === "boolean" ? { presence: value.presence } : {}),
    ...(typeof confidenceScore === "number" ? { confidenceScore } : {}),
  };
}

export async function POST(request: Request) {
  const originHeader = request.headers.get("origin");
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const requestHost = forwardedHost || request.headers.get("host");
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const requestProtocol = forwardedProtocol || new URL(request.url).protocol.slice(0, -1);
  const expectedOrigin = requestHost ? `${requestProtocol}://${requestHost}` : new URL(request.url).origin;
  let origin: string | null = null;
  try {
    origin = originHeader ? new URL(originHeader).origin : null;
  } catch {
    origin = null;
  }
  if (!origin || origin !== expectedOrigin) {
    return Response.json({ error: "Finish requests must originate from this application." }, { status: 403 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return Response.json({ error: "The session report is too large to upload." }, { status: 413 });
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_BYTES) {
    return Response.json({ error: "The session report is too large to upload." }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return Response.json({ error: "The session report payload is not valid JSON." }, { status: 400 });
  }

  if (
    !isRecord(payload) ||
    typeof payload.roomId !== "string" ||
    !isValidRoomId(payload.roomId) ||
    !isIsoDate(payload.startedAt) ||
    !isIsoDate(payload.finishedAt) ||
    !Array.isArray(payload.events) ||
    payload.events.length > MAX_EVENTS ||
    (payload.telemetryTruncated !== undefined && typeof payload.telemetryTruncated !== "boolean") ||
    (payload.omittedEventCount !== undefined &&
      (!Number.isInteger(payload.omittedEventCount) ||
        Number(payload.omittedEventCount) < 0 ||
        Number(payload.omittedEventCount) > 1_000_000))
  ) {
    return Response.json({ error: "The session report contains invalid or incomplete data." }, { status: 400 });
  }

  const startedAt = Date.parse(payload.startedAt);
  const finishedAt = Date.parse(payload.finishedAt);
  if (finishedAt < startedAt || finishedAt > Date.now() + 30_000 || startedAt < Date.now() - 7 * 24 * 60 * 60 * 1000) {
    return Response.json({ error: "The session start or finish time is outside the allowed range." }, { status: 400 });
  }

  const normalizedEvents: EventLog[] = [];
  const eventIds = new Set<string>();
  for (const rawEvent of payload.events) {
    const event = validateEvent(rawEvent);
    if (!event) {
      return Response.json({ error: "One or more telemetry events are invalid." }, { status: 400 });
    }
    if (eventIds.has(event.id)) {
      return Response.json({ error: "The session contains duplicate telemetry event IDs." }, { status: 400 });
    }
    if (Date.parse(event.timestamp) < startedAt || Date.parse(event.timestamp) > finishedAt) {
      return Response.json({ error: "A telemetry event falls outside the interview session." }, { status: 400 });
    }
    eventIds.add(event.id);
    normalizedEvents.push(event);
  }
  const omittedViolationCounts: Partial<Record<IntegrityViolationType, number>> = {};
  if (payload.omittedViolationCounts !== undefined) {
    if (!isRecord(payload.omittedViolationCounts)) {
      return Response.json({ error: "Omitted violation counts are invalid." }, { status: 400 });
    }
    for (const [type, count] of Object.entries(payload.omittedViolationCounts)) {
      if (
        !INTEGRITY_VIOLATION_TYPES.includes(type as IntegrityViolationType) ||
        typeof count !== "number" ||
        !Number.isInteger(count) ||
        count < 0 ||
        count > 1_000_000
      ) {
        return Response.json({ error: "Omitted violation counts are invalid." }, { status: 400 });
      }
      omittedViolationCounts[type as IntegrityViolationType] = count;
    }
  }
  const omittedEventCount = Number(payload.omittedEventCount ?? 0);
  if (Object.values(omittedViolationCounts).reduce((total, count) => total + (count ?? 0), 0) > omittedEventCount) {
    return Response.json({ error: "Omitted event and violation counts do not match." }, { status: 400 });
  }

  const existingReport = await readInterviewReport(payload.roomId);
  if (existingReport) {
    return Response.json({ report: existingReport }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }

  const finishedAtIso = payload.finishedAt;
  const awaySeconds = calculateAwaySeconds(normalizedEvents, finishedAtIso);
  const violationCounts = calculateViolationCounts(normalizedEvents);
  for (const [type, count] of Object.entries(omittedViolationCounts)) {
    violationCounts[type as keyof IntegrityViolationCounts] += count ?? 0;
  }
  const score = calculateIntegrityScore(violationCounts, awaySeconds);
  const evidence = await readRoomEvidence(payload.roomId);
  const evidenceSnapshots = evidence
    .map(({ id, eventId, type, message, timestamp, imageUrl, confidenceScore }) => ({
      id: id || eventId,
      eventId,
      type,
      message,
      timestamp,
      imageUrl,
      confidenceScore,
    }))
    .sort((left, right) => (right.confidenceScore ?? -1) - (left.confidenceScore ?? -1));

  const report: InterviewReport = {
    roomId: payload.roomId,
    startedAt: payload.startedAt,
    finishedAt: finishedAtIso,
    durationSeconds: Math.floor((finishedAt - startedAt) / 1000),
    awaySeconds,
    ...score,
    violationCounts,
    events: normalizedEvents,
    evidenceSnapshots,
    telemetryTruncated: payload.telemetryTruncated === true,
    omittedEventCount,
  };

  await saveInterviewReport(report);
  return Response.json({ report }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("roomId") ?? "";
  if (!isValidRoomId(roomId)) {
    return Response.json({ error: "A valid roomId is required." }, { status: 400 });
  }

  const report: InterviewReport | null = await readInterviewReport(roomId);
  if (!report) {
    return Response.json({ error: "The interview has not been completed." }, { status: 404 });
  }

  if (searchParams.get("status") === "1") {
    return Response.json({ ready: true }, { headers: { "Cache-Control": "no-store" } });
  }

  return Response.json({ report }, { headers: { "Cache-Control": "no-store" } });
}