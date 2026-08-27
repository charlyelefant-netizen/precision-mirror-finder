"use client";

import { useEffect } from "react";

export function ResearchQueueKicker({
  jobId,
  token,
  enabled = true
}: {
  jobId?: string;
  token?: string;
  enabled?: boolean;
}) {
  useEffect(() => {
    if (!enabled) return;

    const params = new URLSearchParams();
    if (jobId && token) {
      params.set("job", jobId);
      params.set("token", token);
    }

    fetch(`/api/research/process${params.size ? `?${params}` : ""}`, {
      method: "POST",
      keepalive: true
    }).catch(() => {
      // The queued job remains durable; admin or a later retry can process it.
    });
  }, [enabled, jobId, token]);

  return null;
}
