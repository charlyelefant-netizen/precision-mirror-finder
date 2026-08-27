"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Filter, Loader2, LogOut } from "lucide-react";
import { logoutAdmin, updateAdminSubmission } from "@/app/actions";
import { AdminCallSheet } from "@/components/AdminCallSheet";
import { AdminQuoteTools } from "@/components/AdminQuoteTools";
import { DeleteRequestButton } from "@/components/DeleteRequestButton";
import { StatusTrackingFields } from "@/components/StatusTrackingFields";
import { STATUSES, type MirrorSubmission, type SubmissionStatus } from "@/lib/types";

type StatusFilter = "All" | SubmissionStatus;
type SortOrder = "newest" | "oldest";

function statusClass(status: string) {
  if (status === "New") return "bg-blue-50 text-brand border-blue-200";
  if (status === "Ready to Quote") return "bg-green-50 text-success border-green-200";
  if (status === "Quote Sent") return "bg-amber-50 text-warning border-amber-200";
  if (status === "Order Placed") return "bg-slate-900 text-white border-slate-900";
  if (status === "Completed") return "bg-slate-100 text-slate-700 border-slate-200";
  if (status === "Manual Review") return "bg-red-50 text-danger border-red-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function formatDate(value: string) {
  const normalized = value.includes("T") ? value : `${value}Z`;
  return new Date(normalized).toLocaleString();
}

function vehicleLabel(submission: MirrorSubmission) {
  const manualVehicle = [submission.year, submission.make, submission.model, submission.trim].filter(Boolean).join(" ");
  if (manualVehicle) return manualVehicle;

  const decodedMatch = submission.notes.match(/decodes to an? (.*?)(?:\. The|\. This|$)/i);
  if (decodedMatch?.[1]) return decodedMatch[1];

  return submission.vin ? `VIN ${submission.vin}` : "Vehicle details pending";
}

function isResearchInProgress(submission: MirrorSubmission) {
  return submission.status === "New" && submission.notes.toLowerCase().includes("research is in progress");
}

export function AdminDashboard({ submissions, taxRate }: { submissions: MirrorSubmission[]; taxRate: number }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  const visibleSubmissions = useMemo(() => {
    return submissions
      .filter((submission) => statusFilter === "All" || submission.status === statusFilter)
      .sort((a, b) => {
        const dateA = new Date(a.created_at.includes("T") ? a.created_at : `${a.created_at}Z`).getTime();
        const dateB = new Date(b.created_at.includes("T") ? b.created_at : `${b.created_at}Z`).getTime();
        return sortOrder === "newest" ? dateB - dateA || b.id - a.id : dateA - dateB || a.id - b.id;
      });
  }, [sortOrder, statusFilter, submissions]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-brand">Operations</p>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Admin dashboard</h1>
          <p className="mt-2 text-sm text-muted">{submissions.length} mirror request{submissions.length === 1 ? "" : "s"} in the queue.</p>
        </div>
        <form action={logoutAdmin}>
          <button className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand">
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </form>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 rounded-lg border border-line bg-panel p-4 shadow-soft sm:grid-cols-2 lg:grid-cols-[1fr_220px_220px] lg:items-end">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Filter size={17} aria-hidden="true" />
          Showing {visibleSubmissions.length} of {submissions.length} request{submissions.length === 1 ? "" : "s"}
        </div>
        <label className="space-y-2">
          <span className="field-label">Status filter</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="field-input">
            <option>All</option>
            {STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
        <label className="space-y-2">
          <span className="field-label">Sort</span>
          <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)} className="field-input">
            <option value="newest">Most recent first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>

      {submissions.length === 0 ? (
        <div className="rounded-lg border border-line bg-panel p-8 text-center shadow-soft">
          <h2 className="text-lg font-semibold text-ink">No submissions yet</h2>
          <p className="mt-2 text-sm text-muted">New customer requests will appear here after the root form is submitted.</p>
        </div>
      ) : visibleSubmissions.length === 0 ? (
        <div className="rounded-lg border border-line bg-panel p-8 text-center shadow-soft">
          <h2 className="text-lg font-semibold text-ink">No matching requests</h2>
          <p className="mt-2 text-sm text-muted">Change the status filter to see more of the queue.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleSubmissions.map((submission) => (
            <details key={submission.id} className="group rounded-lg border border-line bg-panel shadow-soft">
              <summary className="grid cursor-pointer list-none grid-cols-[1fr_auto] gap-3 p-4 marker:hidden sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:p-5">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-md border px-2 py-1 text-xs font-bold ${statusClass(submission.status)}`}>{submission.status}</span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">Request #{submission.id}</span>
                    {submission.tracking_number ? (
                      <span className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-bold text-ink">
                        Tracking: {submission.tracking_number}
                      </span>
                    ) : null}
                  </div>
                  <h2 className="truncate text-base font-bold text-ink sm:text-lg">{vehicleLabel(submission)}</h2>
                </div>
                <time className="self-start whitespace-nowrap text-sm text-muted sm:self-center">{formatDate(submission.created_at)}</time>
                <ChevronDown className="size-5 self-start text-muted transition group-open:rotate-180 sm:self-center" aria-hidden="true" />
              </summary>

              <div className="border-t border-line p-4 sm:p-5">
                <div className="mb-4 space-y-2">
                  <p className="text-sm text-muted">
                    {submission.side} side, {submission.color} • {submission.customer_name} • {submission.customer_phone}
                    {submission.customer_email ? ` • ${submission.customer_email}` : ""}
                  </p>
                  {submission.vin ? <p className="text-sm font-semibold text-muted">VIN: {submission.vin}</p> : null}
                  {isResearchInProgress(submission) ? (
                    <p className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-warning">
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      AI research is in progress. Supplier options will appear here when saved.
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {(submission.features.length ? submission.features : ["No feature selections"]).map((feature) => (
                      <span key={feature} className="rounded-md bg-brand-soft px-2 py-1 text-xs font-semibold text-brand">
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <AdminCallSheet submission={submission} />
                </div>

                <form action={updateAdminSubmission} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <input type="hidden" name="id" value={submission.id} />
                  <StatusTrackingFields status={submission.status} trackingNumber={submission.tracking_number} />
                  <AdminQuoteTools submission={submission} taxRate={taxRate} />
                  <label className="space-y-2 sm:col-span-2 lg:col-span-4">
                    <span className="field-label">Notes</span>
                    <textarea name="notes" defaultValue={submission.notes} className="field-textarea" />
                  </label>
                  <input type="hidden" name="internal_debug" value={submission.internal_debug} />
                  <div className="sm:col-span-2 lg:col-span-4">
                    <button className="h-11 w-full rounded-md bg-brand px-4 text-sm font-bold text-white transition hover:bg-blue-800 sm:w-auto">
                      Save admin updates
                    </button>
                  </div>
                </form>
                <div className="mt-5">
                  <DeleteRequestButton id={submission.id} />
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </main>
  );
}
