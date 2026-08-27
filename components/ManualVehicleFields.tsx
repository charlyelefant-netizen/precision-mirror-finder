"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { getTrimOptions, vehicleMakes } from "@/lib/vehicle-options";

const years = Array.from({ length: 31 }, (_, index) => String(new Date().getFullYear() + 1 - index));

export function ManualVehicleFields() {
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [trim, setTrim] = useState("");
  const [customTrim, setCustomTrim] = useState("");
  const [customMake, setCustomMake] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [loadingModels, setLoadingModels] = useState(false);

  const trimOptions = useMemo(() => getTrimOptions(make), [make]);
  const selectedMake = make === "Other" ? customMake : make;
  const selectedModel = model === "Other / not listed" ? customModel : model;
  const selectedTrim = trim === "Other / not listed" ? customTrim : trim;

  useEffect(() => {
    let cancelled = false;

    async function loadModels() {
      if (!year || !make || make === "Other") {
        setModels([]);
        setModel("");
        return;
      }

      setLoadingModels(true);
      setModels([]);
      setModel("");

      try {
        const params = new URLSearchParams({ year, make });
        const response = await fetch(`/api/vehicles/models?${params}`);
        const data = await response.json() as { models?: string[] };

        if (!cancelled) {
          setModels([...(data.models || []), "Other / not listed"]);
        }
      } catch {
        if (!cancelled) {
          setModels(["Other / not listed"]);
        }
      } finally {
        if (!cancelled) {
          setLoadingModels(false);
        }
      }
    }

    loadModels();

    return () => {
      cancelled = true;
    };
  }, [year, make]);

  useEffect(() => {
    setTrim("");
    setCustomTrim("");
  }, [make, model]);

  return (
    <section className="mt-4 space-y-4">
      <input type="hidden" name="make" value={selectedMake} />
      <input type="hidden" name="model" value={selectedModel} />
      <input type="hidden" name="trim" value={selectedTrim} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="field-label">Year</span>
          <select name="year" value={year} onChange={(event) => setYear(event.target.value)} className="field-input bg-white">
            <option value="">Select year</option>
            {years.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>

        <label className="space-y-2">
          <span className="field-label">Make</span>
          <select value={make} onChange={(event) => setMake(event.target.value)} className="field-input bg-white">
            <option value="">Select make</option>
            {vehicleMakes.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>

        {make === "Other" ? (
          <label className="space-y-2">
            <span className="field-label">Make name</span>
            <input value={customMake} onChange={(event) => setCustomMake(event.target.value)} className="field-input bg-white" placeholder="Enter make" />
          </label>
        ) : null}

        <label className="space-y-2">
          <span className="field-label">Model</span>
          <span className="relative block">
            <select
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className="field-input bg-white pr-10"
              disabled={!make || make === "Other" || !year || loadingModels}
            >
              <option value="">{loadingModels ? "Loading models..." : "Select model"}</option>
              {models.map((option) => <option key={option}>{option}</option>)}
            </select>
            {loadingModels ? <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted" aria-hidden="true" /> : null}
          </span>
        </label>

        {make === "Other" || model === "Other / not listed" ? (
          <label className="space-y-2">
            <span className="field-label">Model name</span>
            <input value={customModel} onChange={(event) => setCustomModel(event.target.value)} className="field-input bg-white" placeholder="Enter model" />
          </label>
        ) : null}

        <label className="space-y-2">
          <span className="field-label">Trim</span>
          <select value={trim} onChange={(event) => setTrim(event.target.value)} className="field-input bg-white" disabled={!selectedModel}>
            <option value="">Select trim</option>
            {trimOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>

        {trim === "Other / not listed" ? (
          <label className="space-y-2">
            <span className="field-label">Trim name</span>
            <input value={customTrim} onChange={(event) => setCustomTrim(event.target.value)} className="field-input bg-white" placeholder="Enter trim" />
          </label>
        ) : null}
      </div>

      <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm leading-6 text-brand">
        We&apos;ll identify the mirror features from the vehicle details during research. Choose “I&apos;m not sure” for trim if needed.
      </div>
    </section>
  );
}
