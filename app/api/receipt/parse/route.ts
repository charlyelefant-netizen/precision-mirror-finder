import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const receiptSchema = {
  type: "object",
  properties: {
    supplier: { type: "string" },
    part_cost: { type: "number" },
    shipping_cost: { type: "number" },
    sales_tax: { type: "number" },
    order_total: { type: "number" },
    order_number: { type: "string" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    notes: { type: "string" }
  },
  required: ["supplier", "part_cost", "shipping_cost", "sales_tax", "order_total", "order_number", "confidence", "notes"]
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function emptyResult(reason: string) {
  return {
    supplier: "",
    part_cost: "",
    shipping_cost: "",
    sales_tax: "",
    order_total: "",
    order_number: "",
    confidence: "low",
    notes: reason
  };
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

  return {
    supplier: String(parsed.supplier || ""),
    part_cost: partCost ? formatMoney(partCost) : "",
    shipping_cost: formatMoney(shippingCost),
    sales_tax: formatMoney(salesTax),
    order_total: orderTotal ? formatMoney(orderTotal) : "",
    order_number: String(parsed.order_number || ""),
    confidence: parsed.confidence === "high" || parsed.confidence === "medium" ? parsed.confidence : "low",
    notes: String(parsed.notes || ""),
    raw: {
      supplier: parsed.supplier || "",
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
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: [
                "Read this checkout/order receipt screenshot for an auto mirror purchase.",
                "Return only JSON.",
                "Extract supplier, part_cost before shipping/tax, shipping_cost, sales_tax, order_total, and order_number.",
                "Use 0 for missing shipping or tax only when the receipt clearly shows free shipping/no tax.",
                "If a field is not visible, use 0 for numeric fields, empty string for order_number/supplier, confidence low, and explain in notes.",
                "Do not include customer quote markup."
              ].join(" ")
            },
            {
              inlineData: {
                mimeType: file.type,
                data: base64
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
    return NextResponse.json(emptyResult(`Gemini receipt parsing failed with HTTP ${response.status}.`), { status: 502 });
  }

  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "";

  try {
    const parsed = extractJson(text);
    if (!parsed) {
      return NextResponse.json(emptyResult("Gemini did not return receipt JSON."), { status: 422 });
    }

    return NextResponse.json(normalizeParsedReceipt(parsed));
  } catch {
    return NextResponse.json(emptyResult("Gemini returned malformed receipt JSON."), { status: 422 });
  }
}
