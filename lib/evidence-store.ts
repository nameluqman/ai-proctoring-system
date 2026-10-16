import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EvidenceSnapshot } from "@/types/telemetry";

const EVIDENCE_ROOT = path.join(process.cwd(), "data", "evidence");

export interface StoredEvidence extends EvidenceSnapshot {
  roomId: string;
  screenshotFile: string;
}

export function isValidRoomId(value: string) {
  return /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}

export function isValidEventId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getRoomDirectory(roomId: string) {
  return path.join(EVIDENCE_ROOT, roomId);
}

export async function readRoomEvidence(roomId: string): Promise<StoredEvidence[]> {
  try {
    const contents = await readFile(path.join(getRoomDirectory(roomId), "index.json"), "utf8");
    const entries: unknown = JSON.parse(contents);
    return Array.isArray(entries) ? (entries as StoredEvidence[]) : [];
  } catch {
    return [];
  }
}

export async function saveEvidence(snapshot: StoredEvidence, image: Buffer) {
  const directory = getRoomDirectory(snapshot.roomId);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, snapshot.screenshotFile), image);

  const entries = await readRoomEvidence(snapshot.roomId);
  const nextEntries = [snapshot, ...entries.filter((entry) => entry.eventId !== snapshot.eventId)];
  const temporaryIndexPath = path.join(directory, `index-${snapshot.eventId}.tmp`);
  await writeFile(temporaryIndexPath, JSON.stringify(nextEntries), "utf8");
  await rename(temporaryIndexPath, path.join(directory, "index.json"));
}

export function getScreenshotPath(roomId: string, eventId: string) {
  return path.join(getRoomDirectory(roomId), `${eventId}.jpg`);
}