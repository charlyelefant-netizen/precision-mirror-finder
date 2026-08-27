import fs from "node:fs";
import path from "node:path";
import { getSubmission, updateSubmission } from "@/lib/db";
import { augmentResearchWithEbay } from "@/lib/ebay";
import { researchMirrorWithGemini } from "@/lib/gemini";
import type { GeminiMirrorResearch, MirrorSubmission } from "@/lib/types";

function logResearch(id: number, message: string, details: Record<string, unknown> = {}) {
  const line = `${new Date().toISOString()} submission=${id} ${message} ${JSON.stringify(details)}\n`;
  console.info(line.trim());

  if (process.env.NODE_ENV !== "production") {
    const logPath = path.join(process.cwd(), "data", "research.log");
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, line);
  }
}

function isConfidentResearch(research: GeminiMirrorResearch) {
  const firstOption = research.supplier_options?.[0];
  const firstTypedOption = research.oem_option || research.aftermarket_option;

  return Boolean(
    research.confident_match &&
    (research.supplier_options?.length >= 1 || firstTypedOption) &&
    (research.likely_part_number || firstOption?.part_number || firstTypedOption?.part_number)
  );
}

async function saveResearch(submission: MirrorSubmission, research: GeminiMirrorResearch) {
  const firstOption = research.supplier_options?.[0];
  const firstTypedOption = research.oem_option || research.aftermarket_option;
  const confident = isConfidentResearch(research);

  await updateSubmission(submission.id, {
    status: confident ? "Ready to Quote" : "Manual Review",
    matched_part_number: confident ? research.likely_part_number || firstOption?.part_number || firstTypedOption?.part_number || "" : "",
    matched_part_price: confident ? research.recommended_price || firstOption?.price || firstTypedOption?.price || "" : "",
    supplier_name: confident ? research.recommended_supplier_name || firstOption?.supplier_name || firstTypedOption?.supplier_name || "" : "",
    supplier_link: confident ? research.recommended_product_link || firstOption?.product_link || firstTypedOption?.product_link || "" : "",
    estimated_shipping: confident ? research.recommended_estimated_shipping || firstOption?.estimated_shipping || firstTypedOption?.estimated_shipping || "" : "",
    quoted_price: "",
    notes: confident ? research.research_summary || "AI research completed." : research.manual_review_reason || "Manual review required.",
    internal_debug: JSON.stringify(research, null, 2),
    tracking_number: submission.tracking_number || "",
    receipt_supplier: submission.receipt_supplier || "",
    receipt_part_cost: submission.receipt_part_cost || "",
    receipt_shipping_cost: submission.receipt_shipping_cost || "",
    receipt_sales_tax: submission.receipt_sales_tax || "",
    receipt_total: submission.receipt_total || "",
    receipt_order_number: submission.receipt_order_number || "",
    receipt_debug: submission.receipt_debug || ""
  });

  logResearch(submission.id, "submission_research_saved", {
    final_status: confident ? "Ready to Quote" : "Manual Review",
    shipped_options: research.supplier_options?.length || 0,
    local_pickup_options: research.local_pickup_options?.length || 0
  });
}

export async function runResearchForSubmission(id: number) {
  const submission = await getSubmission(id);

  if (!submission) {
    logResearch(id, "submission_not_found");
    return;
  }

  logResearch(id, "submission_research_started");
  const geminiResearch = await researchMirrorWithGemini(submission, (message, details) => logResearch(id, message, details));
  const research = await augmentResearchWithEbay(submission, geminiResearch, (message, details) => logResearch(id, message, details));
  await saveResearch(submission, research);
}
