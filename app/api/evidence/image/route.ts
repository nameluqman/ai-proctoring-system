import { readFile } from "node:fs/promises";
import { getScreenshotPath, isValidEventId, isValidRoomId } from "@/lib/evidence-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("roomId") ?? "";
  const eventId = searchParams.get("eventId") ?? "";

  if (!isValidRoomId(roomId) || !isValidEventId(eventId)) {
    return new Response("Invalid evidence reference.", { status: 400 });
  }

  try {
    const image = await readFile(getScreenshotPath(roomId, eventId));
    return new Response(new Uint8Array(image), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Screenshot not found.", { status: 404 });
  }
}