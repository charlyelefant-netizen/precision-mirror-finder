"use client";

import { Download } from "lucide-react";
import type { MirrorSubmission } from "@/lib/types";

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function AdminExportButton({ submissions }: { submissions: MirrorSubmission[] }) {
  function exportCsv() {
    const rows = [
      [
        "id",
        "created_at",
        "vehicle",
        "status",
        "customer_name",
        "customer_phone",
        "quoted_price",
        "supplier_name",
        "matched_part_number",
        "tracking_number"
      ],
      ...submissions.map((submission) => [
        submission.id,
        submission.created_at,
        [submission.year, submission.make, submission.model, submission.trim].filter(Boolean).join(" "),
        submission.status,
        submission.customer_name,
        submission.customer_phone,
        submission.quoted_price,
        submission.supplier_name,
        submission.matched_part_number,
        submission.tracking_number
      ])
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mirror-maven-requests.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={exportCsv}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand"
    >
      <Download size={16} aria-hidden="true" />
      Export
    </button>
  );
}
