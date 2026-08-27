import type { GeminiMirrorResearch, MirrorSubmission, SupplierOption } from "@/lib/types";

type EbayEnvironment = "production" | "sandbox";

type EbayItemSummary = {
  itemId?: string;
  title?: string;
  itemWebUrl?: string;
  price?: { value?: string; currency?: string };
  shippingOptions?: Array<{
    shippingCost?: { value?: string; currency?: string };
    minEstimatedDeliveryDate?: string;
    maxEstimatedDeliveryDate?: string;
  }>;
  condition?: string;
  itemLocation?: {
    postalCode?: string;
    country?: string;
  };
};

type EbayToken = {
  access_token?: string;
  expires_in?: number;
};

const EBAY_SCOPE = "https://api.ebay.com/oauth/api_scope";
let cachedToken: { value: string; expiresAt: number } | undefined;

function apiRoot() {
  return process.env.EBAY_ENVIRONMENT === "sandbox" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
}

function marketplaceId() {
  return process.env.EBAY_MARKETPLACE_ID || "EBAY_US";
}

function credentialsConfigured() {
  return Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
}

function basicAuth(clientId: string, clientSecret: string) {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

function moneyValue(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function normalizeCondition(condition: string | undefined): SupplierOption["condition"] {
  const normalized = String(condition || "").toLowerCase();
  if (normalized.includes("new")) return "New";
  if (normalized.includes("reman")) return "Remanufactured";
  if (normalized.includes("refurb")) return "Refurbished";
  if (normalized.includes("used") || normalized.includes("pre-owned")) return "Used";
  return "Unknown";
}

function shippingCost(item: EbayItemSummary) {
  const costs = (item.shippingOptions || [])
    .map((option) => moneyValue(option.shippingCost?.value))
    .filter((value) => value >= 0);
  return costs.length ? Math.min(...costs) : 0;
}

function estimatedShipping(item: EbayItemSummary) {
  const estimates = (item.shippingOptions || [])
    .map((option) => option.maxEstimatedDeliveryDate || option.minEstimatedDeliveryDate)
    .filter(Boolean);

  if (!estimates.length) return "See eBay listing";
  return `Estimated by ${new Date(estimates.sort()[0] as string).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  })}`;
}

function vehicleLabel(submission: MirrorSubmission, research: GeminiMirrorResearch) {
  const manualVehicle = [submission.year, submission.make, submission.model, submission.trim].filter(Boolean).join(" ");
  if (manualVehicle) return manualVehicle;

  const text = `${research.research_summary} ${submission.notes}`;
  const decodedMatch = text.match(/decodes to an? (.*?)(?:\.|, assembled| manufactured| with|$)/i);
  if (decodedMatch?.[1]) return decodedMatch[1];

  return submission.vin;
}

function sideTerms(side: string) {
  return side.toLowerCase().includes("passenger")
    ? { wanted: ["passenger", "right", "rh"], opposite: ["driver", "left", "lh"] }
    : { wanted: ["driver", "left", "lh"], opposite: ["passenger", "right", "rh"] };
}

function titleLooksRelevant(title: string, side: string) {
  const normalized = title.toLowerCase();
  const { wanted, opposite } = sideTerms(side);
  const hasMirror = normalized.includes("mirror");
  const badPartOnly = [
    "glass only",
    "mirror glass",
    "replacement glass",
    "cover only",
    "cap only",
    "switch",
    "motor only"
  ].some((term) => normalized.includes(term));
  const hasWantedSide = wanted.some((term) => normalized.includes(term));
  const hasOppositeSide = opposite.some((term) => normalized.includes(term));

  return hasMirror && !badPartOnly && (hasWantedSide || !hasOppositeSide);
}

function isDirectEbayItemUrl(value: string | undefined) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return /(^|\.)ebay\.com$/i.test(url.hostname) && /\/itm\//i.test(url.pathname);
  } catch {
    return false;
  }
}

async function getAccessToken(log: (message: string, details?: Record<string, unknown>) => void) {
  if (!credentialsConfigured()) {
    log("ebay_skipped", { reason: "EBAY_CLIENT_ID and EBAY_CLIENT_SECRET are not configured." });
    return null;
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }

  const response = await fetch(`${apiRoot()}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth(process.env.EBAY_CLIENT_ID!, process.env.EBAY_CLIENT_SECRET!)}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: EBAY_SCOPE
    })
  });

  if (!response.ok) {
    log("ebay_token_failed", { status: response.status, body: (await response.text()).slice(0, 200) });
    return null;
  }

  const token = (await response.json()) as EbayToken;
  if (!token.access_token) {
    log("ebay_token_failed", { reason: "Token response missing access_token." });
    return null;
  }

  cachedToken = {
    value: token.access_token,
    expiresAt: now + (token.expires_in || 7200) * 1000
  };
  log("ebay_token_success", { marketplace: marketplaceId(), environment: process.env.EBAY_ENVIRONMENT || "production" });
  return cachedToken.value;
}

function buildQueries(submission: MirrorSubmission, research: GeminiMirrorResearch) {
  const parts = [
    research.likely_part_number,
    research.oem_option?.part_number,
    research.aftermarket_option?.part_number,
    ...research.supplier_options.map((option) => option.part_number)
  ].filter(Boolean);
  const uniqueParts = Array.from(new Set(parts));
  const vehicle = vehicleLabel(submission, research);
  const side = submission.side;

  return [
    ...uniqueParts.map((part) => `${part} ${side} side mirror assembly`),
    `${vehicle} ${side} side mirror assembly used OEM`,
    `${vehicle} ${side} side mirror assembly`
  ].filter(Boolean).slice(0, 5);
}

async function searchEbay(query: string, token: string) {
  const url = new URL(`${apiRoot()}/buy/browse/v1/item_summary/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "10");
  url.searchParams.set("filter", "buyingOptions:{FIXED_PRICE},conditions:{NEW|USED|SELLER_REFURBISHED|CERTIFIED_REFURBISHED}");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": marketplaceId()
    }
  });

  if (!response.ok) {
    throw new Error(`eBay search failed for "${query}" with HTTP ${response.status}: ${(await response.text()).slice(0, 160)}`);
  }

  const body = (await response.json()) as { itemSummaries?: EbayItemSummary[] };
  return body.itemSummaries || [];
}

function toSupplierOption(item: EbayItemSummary, submission: MirrorSubmission): SupplierOption | null {
  if (!item.title || !isDirectEbayItemUrl(item.itemWebUrl) || !titleLooksRelevant(item.title, submission.side)) {
    return null;
  }

  const price = moneyValue(item.price?.value);
  if (!price) return null;

  const shipping = shippingCost(item);
  const condition = normalizeCondition(item.condition);

  return {
    part_type: condition === "Used" ? "OEM" : "Aftermarket",
    condition,
    part_number: item.itemId || "eBay listing",
    supplier_name: "eBay",
    price: formatMoney(price),
    shipping_cost: shipping,
    product_link: item.itemWebUrl!,
    estimated_shipping: estimatedShipping(item),
    tracking_offered: true,
    availability: item.condition || "Active eBay fixed-price listing",
    option_labels: []
  };
}

function optionKey(option: SupplierOption) {
  return option.product_link || `${option.supplier_name}:${option.part_number}:${option.price}`;
}

function deliveredCost(option: SupplierOption) {
  return moneyValue(option.price.replace(/[$,]/g, "")) + option.shipping_cost;
}

function relabelOptions(options: SupplierOption[]) {
  const cheapest = [...options].sort((a, b) => deliveredCost(a) - deliveredCost(b))[0];
  const fastest = options.find((option) => option.option_labels.includes("fastest")) || options[0];

  return options.map((option) => {
    const labels = new Set(option.option_labels);
    if (cheapest && optionKey(option) === optionKey(cheapest)) labels.add("cheapest");
    if (fastest && optionKey(option) === optionKey(fastest)) labels.add("fastest");
    return { ...option, option_labels: Array.from(labels) as Array<"cheapest" | "fastest"> };
  });
}

export async function augmentResearchWithEbay(
  submission: MirrorSubmission,
  research: GeminiMirrorResearch,
  log: (message: string, details?: Record<string, unknown>) => void = () => {}
): Promise<GeminiMirrorResearch> {
  const token = await getAccessToken(log);
  if (!token) return research;

  const queries = buildQueries(submission, research);
  const found: SupplierOption[] = [];

  for (const query of queries) {
    try {
      const items = await searchEbay(query, token);
      found.push(...items.map((item) => toSupplierOption(item, submission)).filter(Boolean) as SupplierOption[]);
      log("ebay_search_success", { query, results: items.length });
    } catch (error) {
      log("ebay_search_failed", { query, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const existingKeys = new Set(research.supplier_options.map(optionKey));
  const ebayOptions = found
    .filter((option) => !existingKeys.has(optionKey(option)))
    .sort((a, b) => deliveredCost(a) - deliveredCost(b))
    .slice(0, 3);

  if (!ebayOptions.length) {
    log("ebay_no_relevant_options", { queries });
    return research;
  }

  const supplierOptions = relabelOptions([...ebayOptions, ...research.supplier_options].sort((a, b) => deliveredCost(a) - deliveredCost(b)).slice(0, 5));
  const recommended = supplierOptions[0];

  log("ebay_options_merged", {
    count: ebayOptions.length,
    cheapest: `${recommended.supplier_name} ${recommended.price} + ${formatMoney(recommended.shipping_cost)} shipping`
  });

  return {
    ...research,
    confident_match: research.confident_match || supplierOptions.length > 0,
    manual_review_reason: research.confident_match ? research.manual_review_reason : "",
    supplier_options: supplierOptions,
    recommended_supplier_name: recommended.supplier_name,
    recommended_price: recommended.price,
    recommended_product_link: recommended.product_link,
    recommended_estimated_shipping: recommended.estimated_shipping,
    research_summary: `${research.research_summary} eBay Browse API found ${ebayOptions.length} additional active fixed-price listing${ebayOptions.length === 1 ? "" : "s"} sorted by delivered cost.`.trim()
  };
}
