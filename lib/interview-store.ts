import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { INTEGRITY_VIOLATION_TYPES, type IntegrityViolationCounts, type InterviewReport } from "@/types/telemetry";
import { calculateIntegrityScore } from "@/lib/scoreCalculator";

const INTERVIEW_REPORT_ROOT = path.join(process.cwd(), "data", "interviews");

function getReportPath(roomId: string) {
  return path.join(INTERVIEW_REPORT_ROOT, `${roomId}.json`);
}

export async function readInterviewReport(roomId: string): Promise<InterviewReport | null> {
  try {
    const contents = await readFile(getReportPath(roomId), "utf8");
    const report = JSON.parse(contents) as InterviewReport & {
      violationCounts: Record<string, number>;
    };
    const legacyFocusAlertCount = report.violationCounts.AI_LISTENING_DETECTED ?? 0;
    const hasLegacyFocusEvents = report.events.some((event) => event.type === "AI_LISTENING_DETECTED");
    if (legacyFocusAlertCount === 0 && !hasLegacyFocusEvents) return report;

    const events = report.events.filter((event) => event.type !== "AI_LISTENING_DETECTED");
    const countsForScoring = Object.fromEntries(
      INTEGRITY_VIOLATION_TYPES.map((type) => [type, report.violationCounts[type] ?? 0])
    ) as IntegrityViolationCounts;

    return {
      ...report,
      events,
      violationCounts: countsForScoring,
      ...calculateIntegrityScore(countsForScoring, report.awaySeconds),
    };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function saveInterviewReport(report: InterviewReport) {
  await mkdir(INTERVIEW_REPORT_ROOT, { recursive: true });
  const reportPath = getReportPath(report.roomId);
  const temporaryPath = `${reportPath}.${process.pid}.tmp`;

  try {
    await writeFile(temporaryPath, JSON.stringify(report), { encoding: "utf8", flag: "wx" });
    await rename(temporaryPath, reportPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}