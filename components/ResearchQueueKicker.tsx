"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function ResearchQueueKicker({
  jobId,
  token,
  enabled = true,
  refreshOnComplete = false,
  showStatus = false
}: {
  jobId?: string;
  token?: string;
  enabled?: boolean;
  refreshOnComplete?: boolean;
  showStatus?: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function processQueuedResearch(attempt = 1) {
      const params = new URLSearchParams();
      if (jobId && token) {
        params.set("job", jobId);
        params.set("token", token);
      }

      try {
        await fetch(`/api/research/process${params.size ? `?${params}` : ""}`, {
          method: "POST",
          cache: "no-store",
          keepalive: !refreshOnComplete
        });
      } catch {
        if (!cancelled && attempt < 3) {
          window.setTimeout(() => processQueuedResearch(attempt + 1), attempt * 3000);
          return;
        }
      }

      if (!cancelled && refreshOnComplete) {
        router.refresh();
      }
    }

    processQueuedResearch();

    return () => {
      cancelled = true;
    };
  }, [enabled, jobId, refreshOnComplete, router, token]);

  if (!showStatus) {
    return null;
  }

  return (
    <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-warning">
      Checking queued AI research. This page will refresh automatically when the worker responds.
    </p>
  );
}
