"use client";

import { useState } from "react";
import { STATUSES, type SubmissionStatus } from "@/lib/types";

export function StatusTrackingFields({
  status,
  trackingNumber
}: {
  status: SubmissionStatus;
  trackingNumber: string;
}) {
  const [selectedStatus, setSelectedStatus] = useState<SubmissionStatus>(status);

  return (
    <>
      <label className="space-y-2">
        <span className="field-label">Status</span>
        <select
          name="status"
          value={selectedStatus}
          onChange={(event) => setSelectedStatus(event.target.value as SubmissionStatus)}
          className="field-input"
        >
          {STATUSES.map((statusOption) => <option key={statusOption}>{statusOption}</option>)}
        </select>
      </label>
      {selectedStatus === "Order Placed" ? (
        <label className="space-y-2">
          <span className="field-label">Tracking Number</span>
          <input name="tracking_number" defaultValue={trackingNumber} className="field-input" placeholder="Paste supplier tracking number" />
        </label>
      ) : (
        <input type="hidden" name="tracking_number" value={trackingNumber} />
      )}
    </>
  );
}
