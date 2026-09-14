"use client";

import { CheckCircle2, LockKeyhole, Workflow } from "lucide-react";
import { STATUSES, type MirrorSubmission } from "@/lib/types";

function statusTone(status: string, currentStatus: string) {
  if (status === currentStatus) return "border-brand bg-brand-soft text-brand";
  return "border-line bg-white text-muted";
}

export function AdminWorkflowPanel({ submission }: { submission: MirrorSubmission }) {
  const workflowStatuses = STATUSES.filter((status) => status !== "Manual Review");

  return (
    <div className="space-y-3 rounded-md border border-line bg-white p-4 sm:col-span-2 lg:col-span-4">
      <div className="flex items-center gap-2">
        <Workflow size={16} aria-hidden="true" className="text-brand" />
        <h3 className="text-sm font-bold uppercase tracking-wide text-ink">Workflow</h3>
      </div>

      <div className="flex flex-wrap gap-2">
        {workflowStatuses.map((status) => (
          <span key={status} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold ${statusTone(status, submission.status)}`}>
            {status === submission.status ? <CheckCircle2 size={13} aria-hidden="true" /> : null}
            {status}
          </span>
        ))}
        {submission.status === "Manual Review" ? (
          <span className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-bold text-danger">Manual Review</span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="space-y-2">
          <span className="field-label">Quote source</span>
          <select name="selected_quote_source" defaultValue={submission.selected_quote_source} className="field-input">
            <option value="">AI suggestion</option>
            <option value="Selected supplier link">Selected supplier link</option>
            <option value="Uploaded receipt">Uploaded receipt</option>
            <option value="Manual">Manual</option>
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 rounded-md border border-line bg-field px-3 text-sm font-bold text-ink">
          <input
            type="checkbox"
            name="verified_part_locked"
            value="true"
            defaultChecked={submission.verified_part_locked === "true"}
            className="size-4 rounded border-line text-brand"
          />
          <LockKeyhole size={15} aria-hidden="true" className="text-muted" />
          Lock verified part
        </label>
      </div>
    </div>
  );
}
