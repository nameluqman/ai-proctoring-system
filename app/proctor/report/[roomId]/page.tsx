import { notFound } from "next/navigation";
import Header from "@/components/shared/Header";
import InterviewReportView from "@/components/proctor/InterviewReport";
import { readInterviewReport } from "@/lib/interview-store";
import { isValidRoomId } from "@/lib/evidence-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ProctorReportPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  if (!isValidRoomId(roomId)) notFound();

  const report = await readInterviewReport(roomId);
  if (!report) notFound();

  return (
    <div className="min-h-screen bg-slate-950">
      <Header title="Session Integrity Report" role="proctor" badgeText="Interview complete" badgeType="success" roomId={roomId} />
      <InterviewReportView report={report} />
    </div>
  );
}