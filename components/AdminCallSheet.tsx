"use client";

import { useMemo, useState } from "react";
import { Copy, Phone } from "lucide-react";
import type { GeminiMirrorResearch, MirrorSubmission, PlaceToCall } from "@/lib/types";

function vehicleLabel(submission: MirrorSubmission) {
  const manualVehicle = [submission.year, submission.make, submission.model, submission.trim].filter(Boolean).join(" ");
  if (manualVehicle) return manualVehicle;

  const decodedMatch = submission.notes.match(/decodes to an? (.*?)(?:\. The|\. This|$)/i);
  if (decodedMatch?.[1]) return decodedMatch[1];

  return submission.vin ? `VIN ${submission.vin}` : "Vehicle details pending";
}

function parseResearch(submission: MirrorSubmission) {
  if (!submission.internal_debug) {
    return { oemPart: "", aftermarketPart: "", placesToCall: [] as PlaceToCall[] };
  }

  try {
    const parsed = JSON.parse(submission.internal_debug) as Partial<GeminiMirrorResearch>;
    const oemPart = parsed.oem_option?.part_number || parsed.supplier_options?.find((option) => option.part_type === "OEM")?.part_number || "";
    const aftermarketPart = parsed.aftermarket_option?.part_number || parsed.supplier_options?.find((option) => option.part_type === "Aftermarket")?.part_number || "";
    const placesToCall = Array.isArray(parsed.places_to_call) ? parsed.places_to_call.slice(0, 3) : [];

    return { oemPart, aftermarketPart, placesToCall };
  } catch {
    return { oemPart: "", aftermarketPart: "", placesToCall: [] as PlaceToCall[] };
  }
}

function majorFeatures(features: string[]) {
  const normalized = features.map((feature) => feature.toLowerCase());
  const labels = [
    { label: "Heated", patterns: ["heated"] },
    { label: "Blind spot", patterns: ["blind spot"] },
    { label: "Turn signal", patterns: ["turn signal"] },
    { label: "Memory", patterns: ["memory"] },
    { label: "Power adjustment", patterns: ["power"] }
  ];

  return labels
    .filter(({ patterns }) => patterns.some((pattern) => normalized.some((feature) => feature.includes(pattern))))
    .map(({ label }) => label);
}

function phoneHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function AdminCallSheet({ submission }: { submission: MirrorSubmission }) {
  const [copied, setCopied] = useState(false);
  const research = useMemo(() => parseResearch(submission), [submission]);
  const featureSummary = majorFeatures(submission.features).join(", ") || "None specified";
  const partLines = [
    research.oemPart ? `OEM part: ${research.oemPart}` : "",
    research.aftermarketPart ? `Aftermarket part: ${research.aftermarketPart}` : "",
    !research.oemPart && !research.aftermarketPart && submission.matched_part_number ? `Matched part: ${submission.matched_part_number}` : ""
  ].filter(Boolean);

  const callSheet = [
    `Vehicle: ${vehicleLabel(submission)}`,
    `Side: ${submission.side}`,
    `Color: ${submission.color}`,
    `Key features: ${featureSummary}`,
    partLines.length ? partLines.join("\n") : "Matched part: Not confirmed yet"
  ].join("\n");

  async function copyCallSheet() {
    await navigator.clipboard.writeText(callSheet);
    setCopied(true);
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
      <section className="rounded-md border border-line bg-white p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wide text-ink">Call Sheet</h3>
          <button
            type="button"
            onClick={copyCallSheet}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink transition hover:border-brand hover:text-brand"
          >
            <Copy size={15} aria-hidden="true" />
            {copied ? "Copied" : "Copy Call Sheet"}
          </button>
        </div>
        <pre className="whitespace-pre-wrap rounded-md bg-field p-3 text-sm leading-6 text-ink">{callSheet}</pre>
      </section>

      <section className="rounded-md border border-line bg-white p-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-ink">Places to Call</h3>
        {research.placesToCall.length ? (
          <div className="mt-3 space-y-2">
            {research.placesToCall.map((place) => (
              <div key={`${place.store_name}-${place.phone_number}`} className="rounded-md border border-line bg-field p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-ink">{place.store_name}</p>
                    <p className="text-xs font-semibold text-muted">{place.chain_name} • {place.distance_from_location}</p>
                  </div>
                  <a href={phoneHref(place.phone_number)} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md bg-brand px-3 text-sm font-bold text-white">
                    <Phone size={15} aria-hidden="true" />
                    Call
                  </a>
                </div>
                <p className="mt-2 text-sm text-muted">{place.phone_number}</p>
                {place.reason_to_call ? <p className="mt-1 text-xs font-medium text-muted">{place.reason_to_call}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-md bg-field p-3 text-sm text-muted">No major-chain call targets returned yet.</p>
        )}
      </section>
    </div>
  );
}
