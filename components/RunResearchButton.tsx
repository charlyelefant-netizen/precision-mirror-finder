"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function RunResearchButton({ id }: { id: number }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function runResearch() {
    setRunning(true);
    setError("");

    try {
      const response = await fetch(`/api/research/process?job=${id}&force=1`, {
        method: "POST",
        cache: "no-store"
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || "AI research did not finish.");
      }

      router.refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "AI research did not finish.";
      setError(message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={runResearch}
        disabled={running}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-brand bg-white px-3 text-sm font-bold text-brand transition hover:bg-brand-soft disabled:cursor-wait disabled:opacity-70"
      >
        <RefreshCw className={`size-4 ${running ? "animate-spin" : ""}`} aria-hidden="true" />
        {running ? "Running AI research..." : "Run AI research now"}
      </button>
      {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
    </div>
  );
}
