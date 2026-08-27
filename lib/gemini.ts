import type { GeminiMirrorResearch, MirrorSubmission } from "@/lib/types";

const PRIMARY_GEMINI_MODEL = "gemini-3.5-flash-lite";
const FALLBACK_GEMINI_MODEL = "gemini-3.7-flash";
const PRIMARY_MAX_ATTEMPTS = 4;
const INITIAL_RETRY_DELAY_MS = 750;
const REQUEST_TIMEOUT_MS = 18_000;

const researchSchema = {
  type: "object",
  properties: {
    confident_match: { type: "boolean" },
    manual_review_reason: { type: "string" },
    likely_part_number: { type: "string" },
    recommended_supplier_name: { type: "string" },
    recommended_price: { type: "string" },
    recommended_product_link: { type: "string" },
    recommended_estimated_shipping: { type: "string" },
    supplier_options: {
      type: "array",
      items: {
        type: "object",
        properties: {
          part_number: { type: "string" },
          part_type: { type: "string", enum: ["OEM", "Aftermarket"] },
          condition: { type: "string", enum: ["New", "Used", "Remanufactured", "Refurbished", "Unknown"] },
          supplier_name: { type: "string" },
          price: { type: "string" },
          shipping_cost: { type: "number" },
          product_link: { type: "string" },
          estimated_shipping: { type: "string" },
          tracking_offered: { type: "boolean" },
          availability: { type: "string" },
          option_labels: {
            type: "array",
            items: { type: "string", enum: ["cheapest", "fastest"] }
          }
        },
        required: ["part_number", "supplier_name", "price", "shipping_cost", "product_link", "estimated_shipping", "tracking_offered", "availability", "option_labels"]
      }
    },
    oem_option: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          properties: {
            part_type: { type: "string", enum: ["OEM"] },
            condition: { type: "string", enum: ["New", "Used", "Remanufactured", "Refurbished", "Unknown"] },
            part_number: { type: "string" },
            supplier_name: { type: "string" },
            price: { type: "string" },
            shipping_cost: { type: "number" },
            product_link: { type: "string" },
            estimated_shipping: { type: "string" },
            tracking_offered: { type: "boolean" },
            availability: { type: "string" },
            note: { type: "string" }
          },
          required: ["part_type", "part_number", "supplier_name", "price", "shipping_cost", "product_link", "estimated_shipping", "tracking_offered", "availability", "note"]
        }
      ]
    },
    aftermarket_option: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          properties: {
            part_type: { type: "string", enum: ["Aftermarket"] },
            condition: { type: "string", enum: ["New", "Used", "Remanufactured", "Refurbished", "Unknown"] },
            part_number: { type: "string" },
            supplier_name: { type: "string" },
            price: { type: "string" },
            shipping_cost: { type: "number" },
            product_link: { type: "string" },
            estimated_shipping: { type: "string" },
            tracking_offered: { type: "boolean" },
            availability: { type: "string" },
            note: { type: "string" }
          },
          required: ["part_type", "part_number", "supplier_name", "price", "shipping_cost", "product_link", "estimated_shipping", "tracking_offered", "availability", "note"]
        }
      ]
    },
    local_pickup_options: {
      type: "array",
      items: {
        type: "object",
        properties: {
          part_number: { type: "string" },
          store_name: { type: "string" },
          distance_from_location: { type: "string" },
          price: { type: "string" },
          product_link: { type: "string" },
          same_day_pickup_confirmed: { type: "boolean" },
          availability: { type: "string" }
        },
        required: ["part_number", "store_name", "distance_from_location", "price", "product_link", "same_day_pickup_confirmed", "availability"]
      }
    },
    places_to_call: {
      type: "array",
      items: {
        type: "object",
        properties: {
          chain_name: { type: "string" },
          store_name: { type: "string" },
          phone_number: { type: "string" },
          distance_from_location: { type: "string" },
          reason_to_call: { type: "string" }
        },
        required: ["chain_name", "store_name", "phone_number", "distance_from_location", "reason_to_call"]
      }
    },
    research_summary: { type: "string" }
  },
  required: [
    "confident_match",
    "manual_review_reason",
    "likely_part_number",
    "recommended_supplier_name",
    "recommended_price",
    "recommended_product_link",
    "recommended_estimated_shipping",
    "supplier_options",
    "oem_option",
    "aftermarket_option",
    "local_pickup_options",
    "places_to_call",
    "research_summary"
  ]
};

function emptyResearch(reason: string): GeminiMirrorResearch {
  return {
    confident_match: false,
    manual_review_reason: reason,
    likely_part_number: "",
    recommended_supplier_name: "",
    recommended_price: "",
    recommended_product_link: "",
    recommended_estimated_shipping: "",
    supplier_options: [],
    oem_option: null,
    aftermarket_option: null,
    local_pickup_options: [],
    places_to_call: [],
    research_summary: reason
  };
}

function isProductPageUrl(value: string) {
  try {
    const url = new URL(value);
    const normalized = `${url.hostname}${url.pathname}`.toLowerCase();
    const assetFilePattern = /\.(?:avif|bmp|gif|ico|jpeg|jpg|png|svg|webp|css|js|mjs|map|pdf)(?:$|[?#])/i;
    const assetPathPattern = /(?:^|[./_-])(?:assets?|cdn|images?|img|media|static|illustrations?|cdn-illustrations)(?:[./_-]|$)/i;
    const listingPathPattern = /\/(?:catalog|search|category|categories|collections|browse|parts-list|part-list|parts-catalog|diagram|diagrams|schematic|schematics)(?:\/|$)/i;

    return (url.protocol === "http:" || url.protocol === "https:") &&
      !assetFilePattern.test(url.pathname) &&
      !assetPathPattern.test(normalized) &&
      !listingPathPattern.test(url.pathname);
  } catch {
    return false;
  }
}

function normalizePartTypeOption(option: Partial<NonNullable<GeminiMirrorResearch["oem_option"]>> | undefined, partType: "OEM" | "Aftermarket") {
  if (!option || !isProductPageUrl(String(option.product_link || ""))) {
    return null;
  }

  return {
    part_type: partType,
    condition: normalizeCondition(option.condition),
    part_number: String(option.part_number || ""),
    supplier_name: String(option.supplier_name || ""),
    price: String(option.price || ""),
    shipping_cost: Number.isFinite(Number(option.shipping_cost)) ? Number(option.shipping_cost) : 0,
    product_link: String(option.product_link || ""),
    estimated_shipping: String(option.estimated_shipping || ""),
    tracking_offered: Boolean(option.tracking_offered),
    availability: String(option.availability || ""),
    note: String(option.note || "")
  };
}

function normalizeCondition(condition: unknown): "New" | "Used" | "Remanufactured" | "Refurbished" | "Unknown" {
  return condition === "New" ||
    condition === "Used" ||
    condition === "Remanufactured" ||
    condition === "Refurbished" ||
    condition === "Unknown"
    ? condition
    : "Unknown";
}

function totalOptionCost(option: { price: string; shipping_cost: number }) {
  const price = Number(String(option.price || "").replace(/,/g, "").match(/\d+(?:\.\d+)?/)?.[0] || 0);
  const shipping = Number.isFinite(Number(option.shipping_cost)) ? Number(option.shipping_cost) : 0;
  return price + shipping;
}

function earliestDeliveryDays(value: string) {
  const normalized = value.toLowerCase();

  if (/same[-\s]?day|today|pickup/.test(normalized)) return 0;
  if (/next[-\s]?day|tomorrow|overnight/.test(normalized)) return 1;

  const numbers = normalized.match(/\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) || [];
  return numbers.length ? Math.min(...numbers) : Number.POSITIVE_INFINITY;
}

function finalizeResearchLinks(research: GeminiMirrorResearch): GeminiMirrorResearch {
  const sortedOptions = [...research.supplier_options].sort((a, b) => totalOptionCost(a) - totalOptionCost(b));
  const cheapest = sortedOptions[0];
  const fastest = [...research.supplier_options].sort(
    (a, b) => earliestDeliveryDays(a.estimated_shipping || a.availability) - earliestDeliveryDays(b.estimated_shipping || b.availability)
  )[0];
  const supplierOptions = research.supplier_options.map((option) => {
    const optionLabels = new Set<"cheapest" | "fastest">(
      option.option_labels.filter((label) => label !== "cheapest" && label !== "fastest")
    );
    if (cheapest && option.product_link === cheapest.product_link) {
      optionLabels.add("cheapest");
    }
    if (fastest && option.product_link === fastest.product_link) {
      optionLabels.add("fastest");
    }

    return { ...option, option_labels: Array.from(optionLabels) as Array<"cheapest" | "fastest"> };
  });

  const recommendedOption = cheapest ||
    research.oem_option ||
    research.aftermarket_option;

  if (!recommendedOption) {
    return {
      ...research,
      confident_match: false,
      manual_review_reason: research.manual_review_reason || "Gemini did not return any valid direct product-page supplier links.",
      recommended_supplier_name: "",
      recommended_price: "",
      recommended_product_link: "",
      recommended_estimated_shipping: ""
    };
  }

  return {
    ...research,
    supplier_options: supplierOptions,
    recommended_supplier_name: recommendedOption.supplier_name,
    recommended_price: recommendedOption.price,
    recommended_product_link: recommendedOption.product_link,
    recommended_estimated_shipping: recommendedOption.estimated_shipping
  };
}

async function productUrlStatus(value: string) {
  try {
    const response = await fetch(value, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 PrecisionMirrorFinder/1.0",
        "Accept": "text/html,application/xhtml+xml"
      },
      signal: AbortSignal.timeout(7_000)
    });

    return response.status;
  } catch {
    return 0;
  }
}

function isUnverifiedMarketplaceLink(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    const ebayConfigured = Boolean(process.env.EBAY_CLIENT_ID?.trim() && process.env.EBAY_CLIENT_SECRET?.trim());

    return host.includes("ebay.") && !ebayConfigured;
  } catch {
    return true;
  }
}

async function validateReturnedProductLinks(research: GeminiMirrorResearch, log: ResearchLogger) {
  const statuses = new Map<string, number>();
  const links = new Set<string>();

  for (const option of research.supplier_options) links.add(option.product_link);
  if (research.oem_option?.product_link) links.add(research.oem_option.product_link);
  if (research.aftermarket_option?.product_link) links.add(research.aftermarket_option.product_link);
  for (const option of research.local_pickup_options) links.add(option.product_link);

  await Promise.all([...links].map(async (link) => {
    if (isUnverifiedMarketplaceLink(link)) {
      statuses.set(link, 0);
      log("supplier_link_rejected", { link, status: "unverified_marketplace_without_api" });
      return;
    }

    const status = await productUrlStatus(link);
    statuses.set(link, status);
    if (status === 404 || status === 410 || status === 0) {
      log("supplier_link_rejected", { link, status });
    }
  }));

  function isLive(link: string) {
    const status = statuses.get(link);
    return status !== 404 && status !== 410 && status !== 0;
  }

  const validated = {
    ...research,
    supplier_options: research.supplier_options.filter((option) => isLive(option.product_link)),
    oem_option: research.oem_option && isLive(research.oem_option.product_link) ? research.oem_option : null,
    aftermarket_option: research.aftermarket_option && isLive(research.aftermarket_option.product_link) ? research.aftermarket_option : null,
    local_pickup_options: research.local_pickup_options.filter((option) => isLive(option.product_link))
  };

  return finalizeResearchLinks(validated);
}

function extractOutputText(payload: unknown): string {
  const response = payload as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  return response.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "";
}

function parseJsonObject(text: string): GeminiMirrorResearch {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start < 0 || end < start) {
    return emptyResearch("Gemini did not return a JSON object.");
  }

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Partial<GeminiMirrorResearch>;
    const research = {
      confident_match: Boolean(parsed.confident_match),
      manual_review_reason: String(parsed.manual_review_reason || ""),
      likely_part_number: String(parsed.likely_part_number || ""),
      recommended_supplier_name: String(parsed.recommended_supplier_name || ""),
      recommended_price: String(parsed.recommended_price || ""),
      recommended_product_link: String(parsed.recommended_product_link || ""),
      recommended_estimated_shipping: String(parsed.recommended_estimated_shipping || ""),
      supplier_options: Array.isArray(parsed.supplier_options)
        ? parsed.supplier_options.slice(0, 5).map((option) => ({
            part_number: String(option.part_number || parsed.likely_part_number || ""),
            part_type: option.part_type === "OEM" || option.part_type === "Aftermarket" ? option.part_type : undefined,
            condition: normalizeCondition(option.condition),
            supplier_name: String(option.supplier_name || ""),
            price: String(option.price || ""),
            shipping_cost: Number.isFinite(Number(option.shipping_cost)) ? Number(option.shipping_cost) : 0,
            product_link: String(option.product_link || ""),
            estimated_shipping: String(option.estimated_shipping || ""),
            tracking_offered: Boolean(option.tracking_offered),
            availability: String(option.availability || ""),
            option_labels: Array.isArray(option.option_labels)
              ? option.option_labels.filter((label) => label === "cheapest" || label === "fastest")
              : []
          })).filter((option) => isProductPageUrl(option.product_link))
        : [],
      oem_option: normalizePartTypeOption(parsed.oem_option || undefined, "OEM"),
      aftermarket_option: normalizePartTypeOption(parsed.aftermarket_option || undefined, "Aftermarket"),
      local_pickup_options: Array.isArray(parsed.local_pickup_options)
        ? parsed.local_pickup_options.map((option) => ({
            part_number: String(option.part_number || parsed.likely_part_number || ""),
            store_name: String(option.store_name || ""),
            distance_from_location: String(option.distance_from_location || ""),
            price: String(option.price || ""),
            product_link: String(option.product_link || ""),
            same_day_pickup_confirmed: Boolean(option.same_day_pickup_confirmed),
            availability: String(option.availability || "")
          })).filter((option) => isProductPageUrl(option.product_link))
        : [],
      places_to_call: Array.isArray(parsed.places_to_call)
        ? parsed.places_to_call.slice(0, 3).map((place) => ({
            chain_name: String(place.chain_name || ""),
            store_name: String(place.store_name || ""),
            phone_number: String(place.phone_number || ""),
            distance_from_location: String(place.distance_from_location || ""),
            reason_to_call: String(place.reason_to_call || "")
          })).filter((place) => place.store_name && place.phone_number)
        : [],
      research_summary: String(parsed.research_summary || "")
    };

    return finalizeResearchLinks(research);
  } catch {
    return emptyResearch("Gemini returned malformed JSON.");
  }
}

function buildPrompt(submission: MirrorSubmission) {
  const hasVin = Boolean(submission.vin.trim());

  return `
Find the correct replacement side mirror assembly using Google Search grounding.
Prioritize the lowest real total part cost without sacrificing exact fit.

Vehicle:
- VIN: ${hasVin ? submission.vin : "not provided"}
- Year: ${submission.year || "not provided"}
- Make: ${submission.make || "not provided"}
- Model: ${submission.model || "not provided"}
- Trim: ${submission.trim || "not provided"}
- Side: ${submission.side}
- Color: ${submission.color}
- Customer-selected mirror features: ${submission.features.length ? submission.features.join(", ") : "not provided; infer from vehicle year/make/model/trim"}
- Ship-to / local search location: 364 Ridge Ave, Lakewood, NJ 08701

Rules:
- Use VIN first when provided.
- Return only schema-valid JSON.
- When VIN is missing, infer mirror features from year/make/model/trim using reliable fitment or OEM catalog pages. If multiple incompatible mirror packages remain likely, set confident_match false and explain briefly.
- Match vehicle/body, side, trim/features, color or paint status, connector notes, and fitment years.
- Return up to four shipped supplier options with current price, numeric shipping_cost to 364 Ridge Ave, Lakewood, NJ 08701, delivery timeframe, tracking availability, part_type, condition, and direct product URL.
- Search eBay Motors/direct eBay item pages for low-cost used OEM mirrors. Include eBay only when the direct item page appears to match exact side/features/fitment and shows price plus shipping.
- Return oem_option and aftermarket_option when both exist. OEM may be new, used, refurbished, or remanufactured. Use null for unavailable types and explain in research_summary.
- Mark the cheapest delivered option (price + shipping_cost) with "cheapest" and the soonest delivery with "fastest", even if the cheapest option is used/eBay.
- Include local pickup options only when a real direct inventory/product URL exists near Lakewood, NJ.
- Return places_to_call with the closest 2-3 relevant major chains within 15 miles: LKQ, AutoZone, O'Reilly Auto Parts, Advance Auto Parts, or NAPA. Include store name, phone number, distance, and reason_to_call.
- Set confident_match false only when exact fitment is genuinely uncertain or no direct purchasable product URL is confirmed.
- Every product_link/recommended_product_link must be a direct retailer or marketplace item page where the exact part can be purchased. Do not return image URLs, CDN URLs, illustration/asset URLs, PDF links, static files, or media resources.
- Do not return catalog, search result, category, browse, or generic mirror listing pages. The URL must identify the specific purchasable part.
- Do not invent part numbers, prices, suppliers, links, shipping timeframes, or tracking availability.
`.trim();
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ResearchLogger = (message: string, details?: Record<string, unknown>) => void;

export async function researchMirrorWithGemini(submission: MirrorSubmission, log: ResearchLogger = () => {}): Promise<GeminiMirrorResearch> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return emptyResearch("GEMINI_API_KEY is not configured.");
  }
  const geminiApiKey = apiKey;

  let lastError = "Gemini request failed.";

  async function callModel(model: string, attempt: number, maxAttempts: number) {
    const phase = model === FALLBACK_GEMINI_MODEL ? "fallback" : "primary";
    log("gemini_attempt_start", { phase, model, attempt, max_attempts: maxAttempts });
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiApiKey
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: buildPrompt(submission) }]
          }
        ],
        tools: [{ googleSearch: {} }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: researchSchema
        }
      })
    });

    if (response.ok) {
      const payload = (await response.json()) as unknown;
      log("gemini_attempt_success", { phase, model, attempt, status: response.status });
      return validateReturnedProductLinks(parseJsonObject(extractOutputText(payload)), log);
    }

    lastError = `Gemini ${model} request failed with HTTP ${response.status}.`;
    log("gemini_attempt_failed", { phase, model, attempt, status: response.status });
    throw new Error(`${lastError} Attempt ${attempt} of ${maxAttempts}.`);
  }

  for (let attempt = 1; attempt <= PRIMARY_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await callModel(PRIMARY_GEMINI_MODEL, attempt, PRIMARY_MAX_ATTEMPTS);
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Gemini request failed.";
      log("gemini_attempt_error", { phase: "primary", model: PRIMARY_GEMINI_MODEL, attempt, error: lastError });
    }

    if (attempt < PRIMARY_MAX_ATTEMPTS) {
      const delayMs = INITIAL_RETRY_DELAY_MS * 2 ** (attempt - 1);
      log("gemini_retry_wait", { model: PRIMARY_GEMINI_MODEL, attempt, next_attempt: attempt + 1, delay_ms: delayMs });
      await wait(delayMs);
    }
  }

  log("gemini_retries_exhausted", { model: PRIMARY_GEMINI_MODEL, retries: PRIMARY_MAX_ATTEMPTS - 1, last_error: lastError });

  try {
    return await callModel(FALLBACK_GEMINI_MODEL, 1, 1);
  } catch (error) {
    lastError = error instanceof Error ? error.message : lastError;
    log("gemini_fallback_failed", { model: FALLBACK_GEMINI_MODEL, error: lastError });
  }

  return emptyResearch(`${lastError} Retried ${PRIMARY_MAX_ATTEMPTS - 1} times on ${PRIMARY_GEMINI_MODEL}, then tried ${FALLBACK_GEMINI_MODEL} once before falling back to manual review.`);
}
