"use client";

import { type MouseEvent, useMemo, useState } from "react";
import { Check, Copy, ExternalLink, MessageSquare, Send } from "lucide-react";
import type { LocalPickupOption, MirrorSubmission, PartTypeOption, SupplierOption } from "@/lib/types";

type QuoteOption = {
  id: string;
  category: "shipped" | "local";
  part_type?: "OEM" | "Aftermarket";
  condition?: "New" | "Used" | "Remanufactured" | "Refurbished" | "Unknown";
  part_number: string;
  supplier_name: string;
  price: string;
  shipping_cost: number;
  product_link: string;
  estimated_shipping: string;
  badges: Array<"cheapest" | "fastest" | "same-day pickup">;
  detail: string;
};

function parsePrice(value: string) {
  const match = value.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function isProductPageUrl(value: string) {
  try {
    const url = new URL(value);
    const normalized = `${url.hostname}${url.pathname}`.toLowerCase();
    const assetFilePattern = /\.(?:avif|bmp|gif|ico|jpeg|jpg|png|svg|webp|css|js|mjs|map|pdf)(?:$|[?#])/i;
    const assetPathPattern = /(?:^|[./_-])(?:assets?|cdn|images?|img|media|static|illustrations?|cdn-illustrations)(?:[./_-]|$)/i;
    const listingPathPattern = /\/(?:catalog|search|category|categories|collections|browse)(?:\/|$)/i;

    return (url.protocol === "http:" || url.protocol === "https:") &&
      !assetFilePattern.test(url.pathname) &&
      !assetPathPattern.test(normalized) &&
      !listingPathPattern.test(url.pathname);
  } catch {
    return false;
  }
}

function vehicleLabel(submission: MirrorSubmission) {
  const manualVehicle = [submission.year, submission.make, submission.model].filter(Boolean).join(" ");
  if (manualVehicle) {
    return manualVehicle;
  }

  const decodedMatch = submission.notes.match(/decodes to an? (.*?)(?:\. The|\. This|$)/i);
  if (decodedMatch?.[1]) {
    return decodedMatch[1];
  }

  return submission.vin ? `VIN ${submission.vin}` : "vehicle";
}

function vehicleSearchLabel(submission: MirrorSubmission) {
  const manualVehicle = [submission.year, submission.make, submission.model, submission.trim].filter(Boolean).join(" ");
  if (manualVehicle) {
    return manualVehicle;
  }

  const decodedMatch = submission.notes.match(/decodes to an? (.*?)(?:\. The|\. This|$)/i);
  if (decodedMatch?.[1]) {
    return decodedMatch[1];
  }

  return submission.vin || "";
}

function normalizeShippedOption(option: SupplierOption): QuoteOption {
  return {
    id: `shipped:${option.supplier_name}:${option.product_link}`,
    category: "shipped",
    part_type: option.part_type,
    condition: option.condition || "Unknown",
    part_number: option.part_number,
    supplier_name: option.supplier_name,
    price: option.price,
    shipping_cost: Number.isFinite(Number(option.shipping_cost)) ? Number(option.shipping_cost) : 0,
    product_link: option.product_link,
    estimated_shipping: option.estimated_shipping,
    badges: option.option_labels,
    detail: option.tracking_offered ? "Tracking offered" : "Tracking not confirmed"
  };
}

function normalizePartTypeOption(option: PartTypeOption): QuoteOption {
  return {
    id: `part-type:${option.part_type}:${option.supplier_name}:${option.product_link}`,
    category: "shipped",
    part_type: option.part_type,
    condition: option.condition || "Unknown",
    part_number: option.part_number,
    supplier_name: option.supplier_name,
    price: option.price,
    shipping_cost: Number.isFinite(Number(option.shipping_cost)) ? Number(option.shipping_cost) : 0,
    product_link: option.product_link,
    estimated_shipping: option.estimated_shipping,
    badges: [],
    detail: option.note || (option.tracking_offered ? "Tracking offered" : "Tracking not confirmed")
  };
}

function normalizeLocalOption(option: LocalPickupOption): QuoteOption {
  return {
    id: `local:${option.store_name}:${option.product_link}`,
    category: "local",
    part_number: option.part_number,
    supplier_name: option.store_name,
    price: option.price,
    shipping_cost: 0,
    product_link: option.product_link,
    estimated_shipping: option.same_day_pickup_confirmed ? "Same-day pickup" : option.availability,
    badges: option.same_day_pickup_confirmed ? ["same-day pickup"] : [],
    detail: `${option.distance_from_location || "Distance not listed"} from 364 Ridge Ave`
  };
}

function parseResearchOptions(submission: MirrorSubmission) {
  if (!submission.internal_debug) {
    return { shippedOptions: [], localOptions: [] };
  }

  try {
    const parsed = JSON.parse(submission.internal_debug) as {
      supplier_options?: SupplierOption[];
      oem_option?: PartTypeOption | null;
      aftermarket_option?: PartTypeOption | null;
      local_pickup_options?: LocalPickupOption[];
    };
    const shippedOptions = Array.isArray(parsed.supplier_options)
      ? parsed.supplier_options.map(normalizeShippedOption).filter((option) => isProductPageUrl(option.product_link))
      : [];
    const oemOption = parsed.oem_option
      ? normalizePartTypeOption(parsed.oem_option)
      : shippedOptions.find((option) => option.part_type === "OEM");
    const aftermarketOption = parsed.aftermarket_option
      ? normalizePartTypeOption(parsed.aftermarket_option)
      : shippedOptions.find((option) => option.part_type === "Aftermarket");

    return {
      shippedOptions,
      oemOption: oemOption && isProductPageUrl(oemOption.product_link) ? oemOption : undefined,
      aftermarketOption: aftermarketOption && isProductPageUrl(aftermarketOption.product_link) ? aftermarketOption : undefined,
      localOptions: Array.isArray(parsed.local_pickup_options)
        ? parsed.local_pickup_options.map(normalizeLocalOption).filter((option) => isProductPageUrl(option.product_link))
        : []
    };
  } catch {
    return { shippedOptions: [], oemOption: undefined, aftermarketOption: undefined, localOptions: [] };
  }
}

function Badge({ children }: { children: string }) {
  const className = children === "cheapest"
    ? "border-green-200 bg-green-50 text-success"
    : children === "fastest"
      ? "border-blue-200 bg-blue-50 text-brand"
      : "border-amber-200 bg-amber-50 text-warning";

  return <span className={`rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase ${className}`}>{children}</span>;
}

function openSupplierLink(event: MouseEvent<HTMLAnchorElement>, url: string) {
  event.preventDefault();
  window.location.href = url;
}

function buildEbaySearchUrl(submission: MirrorSubmission, partNumber: string) {
  const query = [
    partNumber,
    vehicleSearchLabel(submission),
    submission.side,
    "side mirror"
  ].filter(Boolean).join(" ");
  const params = new URLSearchParams({
    _nkw: query,
    _sop: "15"
  });

  return `https://www.ebay.com/sch/i.html?${params}`;
}

function OptionCard({
  option,
  selected,
  onSelect
}: {
  option: QuoteOption;
  selected: boolean;
  onSelect: (option: QuoteOption) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(option)}
      className={`rounded-md border p-3 text-left transition ${
        selected ? "border-brand bg-brand-soft text-brand" : "border-line bg-field text-ink hover:border-brand"
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="font-bold">{option.part_type ? `${option.part_type} option` : option.supplier_name}</p>
          {option.part_type ? (
            <p className="text-sm font-semibold text-muted">
              {option.supplier_name}{option.condition && option.condition !== "Unknown" ? ` • ${option.condition}` : ""}
            </p>
          ) : null}
          {option.badges.length ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {option.badges.map((badge) => <Badge key={badge}>{badge}</Badge>)}
            </div>
          ) : null}
        </div>
        {selected ? <Check className="size-4 shrink-0" aria-hidden="true" /> : null}
      </div>
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Part</dt>
          <dd className="font-semibold">{option.part_number || "Not listed"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Price</dt>
          <dd className="font-semibold">{option.price || "Not listed"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">{option.category === "local" ? "Pickup" : "Shipping"}</dt>
          <dd className="font-semibold">{option.estimated_shipping || "Not listed"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Ship cost</dt>
          <dd className="font-semibold">{formatMoney(option.shipping_cost)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs font-medium text-muted">{option.detail}</p>
    </button>
  );
}

export function AdminQuoteTools({
  submission,
  taxRate
}: {
  submission: MirrorSubmission;
  taxRate: number;
}) {
  const { shippedOptions, oemOption, aftermarketOption, localOptions } = useMemo(() => parseResearchOptions(submission), [submission]);
  const partTypeOptions = [oemOption, aftermarketOption].filter(Boolean) as QuoteOption[];
  const allOptions = [...partTypeOptions, ...localOptions, ...shippedOptions];
  const initialSupplierLink = isProductPageUrl(submission.supplier_link) ? submission.supplier_link : "";
  const initialOption = allOptions.find((option) => option.product_link === initialSupplierLink) || allOptions[0];
  const useSavedSupplier = Boolean(initialSupplierLink);
  const initialPartNumber = useSavedSupplier ? submission.matched_part_number || initialOption?.part_number || "" : initialOption?.part_number || submission.matched_part_number || "";
  const initialPartPrice = useSavedSupplier ? submission.matched_part_price || initialOption?.price || "" : initialOption?.price || submission.matched_part_price || "";
  const initialShippingCost = initialOption?.shipping_cost || 0;
  const initialSupplierName = useSavedSupplier ? submission.supplier_name || initialOption?.supplier_name || "" : initialOption?.supplier_name || submission.supplier_name || "";
  const initialEstimatedShipping = useSavedSupplier ? submission.estimated_shipping || initialOption?.estimated_shipping || "" : initialOption?.estimated_shipping || submission.estimated_shipping || "";
  const initialQuote = initialPartPrice ? calculateQuote(initialPartPrice, initialShippingCost).totalText : "";
  const [partNumber, setPartNumber] = useState(initialPartNumber);
  const [partPrice, setPartPrice] = useState(initialPartPrice);
  const [shippingCost, setShippingCost] = useState(String(initialShippingCost));
  const [supplierName, setSupplierName] = useState(initialSupplierName);
  const [supplierLink, setSupplierLink] = useState(initialSupplierLink || initialOption?.product_link || "");
  const [estimatedShipping, setEstimatedShipping] = useState(initialEstimatedShipping);
  const [quotedPrice, setQuotedPrice] = useState(() => submission.quoted_price || initialQuote);
  const [quoteMessage, setQuoteMessage] = useState(() => initialOption ? buildQuoteMessage(submission.quoted_price || initialQuote, initialOption.estimated_shipping) : "");
  const [copied, setCopied] = useState(false);

  function calculateQuote(price: string, shipping = parsePrice(shippingCost)) {
    const part = parsePrice(price);
    const shippingAmount = Number.isFinite(shipping) ? shipping : 0;
    const taxable = part + shippingAmount;
    const tax = taxable * taxRate;
    const markup = 120;
    const total = taxable + tax + markup;

    return {
      part,
      shipping: shippingAmount,
      tax,
      markup,
      total,
      totalText: formatMoney(total)
    };
  }

  function recalculateQuote(price = partPrice, shipping = parsePrice(shippingCost)) {
    setQuotedPrice(calculateQuote(price, shipping).totalText);
  }

  function buildQuoteMessage(totalText: string, deliveryText: string) {
    const vehicle = vehicleLabel(submission);
    const oemChoice = oemOption;
    const aftermarketChoice = aftermarketOption;

    return oemChoice && aftermarketChoice
      ? `Hi ${submission.customer_name}, we found two options for your ${vehicle} mirror: OEM (manufacturer) part for ${calculateQuote(oemChoice.price, oemChoice.shipping_cost).totalText}, or a quality aftermarket option for ${calculateQuote(aftermarketChoice.price, aftermarketChoice.shipping_cost).totalText}. Let me know which you'd prefer!`
      : `Hi ${submission.customer_name}, your ${vehicle} mirror is ready to quote: ${totalText || calculateQuote(partPrice).totalText} total, estimated delivery in ${deliveryText || "the listed timeframe"}. Let me know if you'd like to move forward!`;
  }

  function selectOption(option: QuoteOption) {
    const price = option.price;
    const calculatedQuote = calculateQuote(price, option.shipping_cost).totalText;
    setPartNumber(option.part_number || submission.matched_part_number);
    setPartPrice(price);
    setShippingCost(String(option.shipping_cost || 0));
    setSupplierName(option.supplier_name);
    setSupplierLink(option.product_link);
    setEstimatedShipping(option.estimated_shipping);
    setQuotedPrice(calculatedQuote);
    setQuoteMessage(buildQuoteMessage(calculatedQuote, option.estimated_shipping));
    setCopied(false);
  }

  function generateMessage() {
    setQuoteMessage(buildQuoteMessage(quotedPrice || calculateQuote(partPrice).totalText, estimatedShipping));
    setCopied(false);
  }

  async function copyMessage() {
    await navigator.clipboard.writeText(quoteMessage);
    setCopied(true);
  }

  const quoteBreakdown = calculateQuote(partPrice);
  const smsHref = `sms:${submission.customer_phone.replace(/[^\d+]/g, "")}?body=${encodeURIComponent(quoteMessage)}`;
  const ebaySearchHref = buildEbaySearchUrl(submission, partNumber);

  return (
    <>
      {allOptions.length > 1 ? (
        <div className="space-y-3 sm:col-span-2 lg:col-span-4">
          {partTypeOptions.length ? (
            <div className="space-y-2">
              <span className="field-label">OEM vs Aftermarket</span>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {partTypeOptions.map((option) => (
                  <OptionCard
                    key={option.id}
                    option={option}
                    selected={supplierLink === option.product_link}
                    onSelect={selectOption}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {localOptions.length ? (
            <div className="space-y-2">
              <span className="field-label">Local pickup options</span>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                {localOptions.map((option) => (
                  <OptionCard
                    key={option.id}
                    option={option}
                    selected={supplierLink === option.product_link}
                    onSelect={selectOption}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {shippedOptions.length ? (
            <div className="space-y-2">
              <span className="field-label">Shipped supplier options</span>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                {shippedOptions.map((option) => (
                  <OptionCard
                    key={option.id}
                    option={option}
                    selected={supplierLink === option.product_link}
                    onSelect={selectOption}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {supplierLink ? (
        <div className="space-y-3 rounded-md border border-line bg-white p-4 sm:col-span-2 lg:col-span-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={generateMessage}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-brand bg-white px-3 text-sm font-bold text-brand transition hover:bg-brand-soft"
            >
              <MessageSquare size={16} aria-hidden="true" />
              Generate Quote Message
            </button>
            <a
              href={supplierLink}
              onClick={(event) => openSupplierLink(event, supplierLink)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand px-3 text-sm font-bold text-white transition hover:bg-blue-800"
            >
              Buy This Part <ExternalLink size={15} aria-hidden="true" />
            </a>
            <a
              href={ebaySearchHref}
              onClick={(event) => openSupplierLink(event, ebaySearchHref)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink transition hover:border-brand hover:text-brand"
            >
              Search eBay <ExternalLink size={15} aria-hidden="true" />
            </a>
          </div>
          {quoteMessage ? (
            <div className="space-y-2">
              <textarea className="field-textarea" value={quoteMessage} onChange={(event) => setQuoteMessage(event.target.value)} />
              <div className="flex flex-col gap-2 sm:flex-row">
                <a href={smsHref} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand px-3 text-sm font-bold text-white">
                  <Send size={16} aria-hidden="true" />
                  Text Customer
                </a>
                <button type="button" onClick={copyMessage} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink">
                  <Copy size={16} aria-hidden="true" />
                  {copied ? "Copied" : "Copy Text"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <label className="space-y-2">
        <span className="field-label">Matched part number</span>
        <input name="matched_part_number" value={partNumber} onChange={(event) => setPartNumber(event.target.value)} className="field-input" />
      </label>
      <label className="space-y-2">
        <span className="field-label">Part price</span>
        <input
          name="matched_part_price"
          value={partPrice}
          onChange={(event) => setPartPrice(event.target.value)}
          onBlur={() => recalculateQuote()}
          className="field-input"
          placeholder="$0.00"
        />
      </label>
      <label className="space-y-2">
        <span className="field-label">Shipping cost</span>
        <input
          value={shippingCost}
          onChange={(event) => setShippingCost(event.target.value)}
          onBlur={() => recalculateQuote()}
          className="field-input"
          inputMode="decimal"
          placeholder="0.00"
        />
      </label>
      <label className="space-y-2">
        <span className="field-label">Quoted price</span>
        <input name="quoted_price" value={quotedPrice} onChange={(event) => setQuotedPrice(event.target.value)} className="field-input" placeholder="$0.00" />
      </label>
      {partPrice ? (
        <div className="rounded-md border border-line bg-white p-3 text-sm text-ink sm:col-span-2 lg:col-span-4">
          <p className="font-bold">Quote breakdown</p>
          <p className="mt-1 text-muted">
            Part: {formatMoney(quoteBreakdown.part)} + Shipping: {formatMoney(quoteBreakdown.shipping)} + Tax: {formatMoney(quoteBreakdown.tax)} + Markup: {formatMoney(quoteBreakdown.markup)} = Total: {quoteBreakdown.totalText}
          </p>
        </div>
      ) : null}
      <label className="space-y-2">
        <span className="field-label">Supplier name</span>
        <input name="supplier_name" value={supplierName} onChange={(event) => setSupplierName(event.target.value)} className="field-input" />
      </label>
      <label className="space-y-2 sm:col-span-2">
        <span className="field-label">Supplier link</span>
        <input name="supplier_link" value={supplierLink} onChange={(event) => setSupplierLink(event.target.value)} className="field-input" type="url" placeholder="https://" />
        {supplierLink ? (
          <a href={supplierLink} onClick={(event) => openSupplierLink(event, supplierLink)} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand">
            Open supplier <ExternalLink size={12} aria-hidden="true" />
          </a>
        ) : null}
      </label>
      <label className="space-y-2">
        <span className="field-label">Estimated shipping</span>
        <input name="estimated_shipping" value={estimatedShipping} onChange={(event) => setEstimatedShipping(event.target.value)} className="field-input" placeholder="3-5 days" />
      </label>
    </>
  );
}
