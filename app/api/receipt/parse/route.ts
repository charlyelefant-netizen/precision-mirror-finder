import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const receiptSchema = {
  type: "object",
  properties: {
    supplier: { type: "string" },
    merchant_name: { type: "string" },
    supplier_evidence: { type: "string" },
    part_cost: { type: "number" },
    shipping_cost: { type: "number" },
    sales_tax: { type: "number" },
    order_total: { type: "number" },
    order_number: { type: "string" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    notes: { type: "string" }
  },
  required: ["supplier", "merchant_name", "supplier_evidence", "part_cost", "shipping_cost", "sales_tax", "order_total", "order_number", "confidence", "notes"]
};

const RECEIPT_PRIMARY_MODEL = "gemini-3.5-flash-lite";
const RECEIPT_FALLBACK_MODEL = "gemini-3.7-flash";
const RECEIPT_MAX_ATTEMPTS = 3;
const RECEIPT_TIMEOUT_MS = 25_000;

const supplierAliases = [
  { name: "Amazon", patterns: [/amazon/i, /amazon\.com/i] },
  { name: "eBay", patterns: [/\bebay\b/i, /ebay\.com/i] },
  { name: "Walmart", patterns: [/walmart/i, /walmart\.com/i] },
  { name: "RockAuto", patterns: [/rockauto/i, /rockauto\.com/i] },
  { name: "AutoZone", patterns: [/autozone/i, /autozone\.com/i] },
  { name: "O'Reilly Auto Parts", patterns: [/o'?reilly/i, /oreillyauto/i] },
  { name: "Advance Auto Parts", patterns: [/advance auto/i, /advanceautoparts/i] },
  { name: "NAPA", patterns: [/\bnapa\b/i, /napaonline/i] },
  { name: "LKQ", patterns: [/\blkq\b/i, /lkqonline/i] },
  { name: "Parts Geek", patterns: [/parts geek/i, /partsgeek/i] },
  { name: "CarParts.com", patterns: [/carparts\.com/i, /\bcarparts\b/i] },
  { name: "1A Auto", patterns: [/\b1a auto\b/i, /1aauto/i] },
  { name: "TRQ", patterns: [/\btrq\b/i] },
  { name: "PayPal", patterns: [/paypal/i] }
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function emptyResult(reason: string) {
  return {
    supplier: "",
    merchant_name: "",
    supplier_evidence: "",
    part_cost: "",
    shipping_cost: "",
    sales_tax: "",
    order_total: "",
    order_number: "",
    confidence: "low",
    notes: reason
  };
}

function normalizeSupplier(value: unknown, evidence: unknown, notes: unknown) {
  const rawText = [value, evidence, notes].map((item) => String(item || "")).join(" ");

  for (const supplier of supplierAliases) {
    if (supplier.patterns.some((pattern) => pattern.test(rawText))) {
      return supplier.name;
    }
  }

  const cleaned = String(value || "").trim();
  if (!cleaned || /^unknown$/i.test(cleaned) || /^not visible$/i.test(cleaned)) {
    return "";
  }

  return cleaned;
}

function normalizeNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(String(value || "").replace(/[$,]/g, ""));
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : 0;
}

function normalizeParsedReceipt(parsed: Record<string, unknown>) {
  const partCost = normalizeNumber(parsed.part_cost);
  const shippingCost = normalizeNumber(parsed.shipping_cost);
  const salesTax = normalizeNumber(parsed.sales_tax);
  const orderTotal = normalizeNumber(parsed.order_total);

  const supplier = normalizeSupplier(parsed.supplier, parsed.supplier_evidence, parsed.notes);
  const merchantName = String(parsed.merchant_name || "").trim();
  const supplierEvidence = String(parsed.supplier_evidence || "").trim();

  return {
    supplier,
    merchant_name: merchantName,
    supplier_evidence: supplierEvidence,
    part_cost: partCost ? formatMoney(partCost) : "",
    shipping_cost: formatMoney(shippingCost),
    sales_tax: formatMoney(salesTax),
    order_total: orderTotal ? formatMoney(orderTotal) : "",
    order_number: String(parsed.order_number || ""),
    confidence: parsed.confidence === "high" || parsed.confidence === "medium" ? parsed.confidence : "low",
    notes: String(parsed.notes || ""),
    raw: {
      supplier,
      original_supplier: parsed.supplier || "",
      merchant_name: merchantName,
      supplier_evidence: supplierEvidence,
      part_cost: partCost,
      shipping_cost: shippingCost,
      sales_tax: salesTax,
      order_total: orderTotal,
      order_number: parsed.order_number || "",
      confidence: parsed.confidence || "low",
      notes: parsed.notes || ""
    }
  };
}

function extractJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseReceiptWithGemini({
  apiKey,
  mimeType,
  data,
  model
}: {
  apiKey: string;
  mimeType: string;
  data: string;
  model: string;
}) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    signal: AbortSignal.timeout(RECEIPT_TIMEOUT_MS),
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: [
                "Read this checkout/order receipt screenshot for an auto mirror purchase.",
                "Return only JSON.",
                "Identify the receipt source/store from visible logo, app header, email sender, domain, checkout page, or order confirmation text.",
                "For supplier, return the canonical marketplace or retailer name, not the individual seller name or product brand.",
                "Use exactly Amazon for Amazon/Amazon.com receipts and exactly eBay for eBay/eBay.com receipts.",
                "Other examples: Walmart, RockAuto, AutoZone, O'Reilly Auto Parts, Advance Auto Parts, NAPA, LKQ, Parts Geek, CarParts.com, 1A Auto.",
                "If an eBay seller or Amazon third-party seller is visible, put that seller in merchant_name while keeping supplier as eBay or Amazon.",
                "Put the visible clue used to identify supplier in supplier_evidence.",
                "Extract part_cost before shipping/tax, shipping_cost, sales_tax, order_total, and order_number.",
                "Use 0 for missing shipping or tax only when the receipt clearly shows free shipping/no tax.",
                "Do not include customer quote markup."
              ].join(" ")
            },
            {
              inlineData: {
                mimeType,
                data
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: receiptSchema
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini receipt parsing failed with HTTP ${response.status}.`);
  }

  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "";
  const parsed = extractJson(text);

  if (!parsed) {
    throw new Error("Gemini did not return receipt JSON.");
  }

  return parsed;
}

export async function POST(request: NextRequest) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(emptyResult("GEMINI_API_KEY is not configured."), { status: 500 });
  }

  const formData = await request.formData();
  const file = formData.get("receipt");

  if (!(file instanceof File)) {
    return NextResponse.json(emptyResult("Upload a receipt or checkout screenshot."), { status: 400 });
  }

  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json(emptyResult("Receipt image is too large. Use an image under 8MB."), { status: 400 });
  }

  const supportedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
  if (!supportedTypes.includes(file.type)) {
    return NextResponse.json(emptyResult("Use a JPG, PNG, WebP, HEIC, or PDF receipt."), { status: 400 });
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  let lastError = "Receipt could not be read.";

  try {
    for (let attempt = 1; attempt <= RECEIPT_MAX_ATTEMPTS; attempt += 1) {
      try {
        const parsed = await parseReceiptWithGemini({ apiKey, mimeType: file.type, data: base64, model: RECEIPT_PRIMARY_MODEL });
        return NextResponse.json(normalizeParsedReceipt(parsed));
      } catch (error) {
        lastError = error instanceof Error ? error.message : lastError;
        console.info(JSON.stringify({ message: "receipt_parse_attempt_failed", model: RECEIPT_PRIMARY_MODEL, attempt, error: lastError }));
        if (attempt < RECEIPT_MAX_ATTEMPTS) {
          await wait(750 * 2 ** (attempt - 1));
        }
      }
    }

    const parsed = await parseReceiptWithGemini({ apiKey, mimeType: file.type, data: base64, model: RECEIPT_FALLBACK_MODEL });
    return NextResponse.json(normalizeParsedReceipt(parsed));
  } catch (error) {
    lastError = error instanceof Error ? error.message : lastError;
    return NextResponse.json(emptyResult(lastError), { status: 502 });
  }
}
