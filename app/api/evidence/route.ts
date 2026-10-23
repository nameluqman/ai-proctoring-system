import { readRoomEvidence, isValidEventId, isValidRoomId, saveEvidence, type StoredEvidence } from "@/lib/evidence-store";

export const runtime = "nodejs";

const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;
const MISTAKE_EVENTS = new Set([
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

export async function POST(request: Request) {
  const formData = await request.formData();
  const screenshot = formData.get("screenshot");
  const roomId = String(formData.get("roomId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  const type = String(formData.get("type") ?? "");
  const message = String(formData.get("message") ?? "").slice(0, 500);
  const rawConfidenceScore = formData.get("confidenceScore");
  const confidenceScore = rawConfidenceScore === null ? undefined : Number(rawConfidenceScore);

  if (!(screenshot instanceof File) || screenshot.type !== "image/jpeg" || screenshot.size > MAX_SCREENSHOT_BYTES) {
    return Response.json({ error: "A JPEG screenshot under 8 MB is required." }, { status: 400 });
  }
  if (!isValidRoomId(roomId) || !isValidEventId(eventId) || !MISTAKE_EVENTS.has(type)) {
    return Response.json({ error: "Invalid room or event data." }, { status: 400 });
  }
  if (
    confidenceScore !== undefined &&
    (!Number.isFinite(confidenceScore) || confidenceScore < 0 || confidenceScore > 1)
  ) {
    return Response.json({ error: "Confidence score must be between 0 and 1." }, { status: 400 });
  }

  const snapshot: StoredEvidence = {
    id: eventId,
    eventId,
    roomId,
    type,
    message,
    timestamp: new Date().toISOString(),
    imageUrl: `/api/evidence/image?roomId=${encodeURIComponent(roomId)}&eventId=${eventId}`,
    screenshotFile: `${eventId}.jpg`,
    confidenceScore,
  };

  await saveEvidence(snapshot, Buffer.from(await screenshot.arrayBuffer()));
  return Response.json({ snapshot }, { status: 201 });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("roomId") ?? "";
  if (!isValidRoomId(roomId)) {
    return Response.json({ error: "A valid roomId is required." }, { status: 400 });
  }

  const entries = await readRoomEvidence(roomId);
  const snapshots = entries.map(({ id, eventId, type, message, timestamp, imageUrl, confidenceScore }) => ({
    id: id || eventId,
    eventId,
    type,
    message,
    timestamp,
    imageUrl,
    confidenceScore,
  }));

  return Response.json({ snapshots }, { headers: { "Cache-Control": "no-store" } });
}