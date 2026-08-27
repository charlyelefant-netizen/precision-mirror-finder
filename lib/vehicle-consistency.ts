import { vehicleMakes } from "@/lib/vehicle-options";
import type { GeminiMirrorResearch, MirrorSubmission, SupplierOption } from "@/lib/types";

const makeAliases: Record<string, string[]> = {
  "Mercedes-Benz": ["Mercedes-Benz", "Mercedes", "Benz"],
  BMW: ["BMW"],
  GMC: ["GMC"]
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function termsForMake(make: string) {
  return makeAliases[make] || [make];
}

function hasTerm(text: string, term: string) {
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(term.toLowerCase())}([^a-z0-9]|$)`, "i").test(text);
}

export function conflictingVehicleMakes(submission: Pick<MirrorSubmission, "make">, text: string) {
  const expectedMake = submission.make.trim();

  if (!expectedMake) return [];

  const normalized = text.toLowerCase();
  const expectedTerms = new Set(termsForMake(expectedMake).map((term) => term.toLowerCase()));

  return vehicleMakes
    .filter((make) => make !== "Other" && make.toLowerCase() !== expectedMake.toLowerCase())
    .filter((make) => termsForMake(make).some((term) => !expectedTerms.has(term.toLowerCase()) && hasTerm(normalized, term)));
}

export function optionVehicleConflict(submission: Pick<MirrorSubmission, "make">, option: SupplierOption) {
  return conflictingVehicleMakes(
    submission,
    [
      option.part_number,
      option.supplier_name,
      option.product_link,
      option.availability,
      option.estimated_shipping
    ].join(" ")
  );
}

export function enforceResearchVehicleConsistency(
  submission: Pick<MirrorSubmission, "make" | "model">,
  research: GeminiMirrorResearch
) {
  const conflicts = new Set<string>();
  const textToCheck = [
    research.likely_part_number,
    research.recommended_supplier_name,
    research.recommended_product_link,
    research.manual_review_reason,
    research.research_summary,
    JSON.stringify(research.supplier_options),
    JSON.stringify(research.oem_option),
    JSON.stringify(research.aftermarket_option),
    JSON.stringify(research.local_pickup_options)
  ].join(" ");

  conflictingVehicleMakes(submission, textToCheck).forEach((make) => conflicts.add(make));

  if (!conflicts.size) {
    return research;
  }

  const conflictList = Array.from(conflicts).join(", ");

  return {
    ...research,
    confident_match: false,
    manual_review_reason: `Manual review required: research result mentioned ${conflictList}, which conflicts with decoded vehicle ${submission.make} ${submission.model}.`,
    recommended_supplier_name: "",
    recommended_price: "",
    recommended_product_link: "",
    recommended_estimated_shipping: "",
    supplier_options: [],
    oem_option: null,
    aftermarket_option: null,
    local_pickup_options: [],
    research_summary: `Blocked conflicting vehicle research. Expected ${submission.make} ${submission.model}; found ${conflictList}.`
  };
}
