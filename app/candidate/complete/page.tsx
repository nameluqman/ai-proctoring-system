"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import Header from "@/components/shared/Header";

function CandidateCompletion() {
  const roomId = useSearchParams().get("room") ?? "";
  const [status, setStatus] = useState<"loading" | "complete" | "error">(roomId ? "loading" : "error");

  useEffect(() => {
    let active = true;
    if (!roomId) {
      return;
    }

    void fetch(`/api/interview/finish?roomId=${encodeURIComponent(roomId)}&status=1`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("No completed report was found for this session.");
        if (active) setStatus("complete");
      })
      .catch((error: unknown) => {
        console.warn("Could not confirm candidate interview completion:", error);
        if (active) setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [roomId]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header
        title="Interview Complete"
        role="candidate"
        badgeText={status === "complete" ? "Report submitted" : status === "loading" ? "Verifying..." : "Not verified"}
        badgeType={status === "complete" ? "success" : status === "loading" ? "warning" : "warning"}
        roomId={roomId || undefined}
      />
      <main className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center p-6">
        <section className="w-full rounded-2xl border border-emerald-800/60 bg-slate-900 p-8 text-center">
          {status === "complete" ? (
            <>
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
              <h1 className="mt-4 text-xl font-bold text-white">Interview submitted</h1>
              <p className="mt-2 text-sm text-slate-300">
                Monitoring has stopped. Your session events, away time, scorecard, and available screenshots were sent
                to the proctor.
              </p>
              <p className="mt-4 text-xs text-slate-500">
                The integrity score is an automated review signal, not a finding that misconduct occurred.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-white">
                {status === "loading" ? "Verifying interview submission" : "Report not available"}
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                {status === "loading"
                  ? "Checking that the session report was saved."
                  : "The session report could not be confirmed. Ask the proctor to check the session."}
              </p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default function CandidateCompletionPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-400">Loading completion status...</div>}>
      <CandidateCompletion />
    </Suspense>
  );
}