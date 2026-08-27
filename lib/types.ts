export const STATUSES = ["New", "Ready to Quote", "Quote Sent", "Order Placed", "Completed", "Manual Review"] as const;

export type SubmissionStatus = (typeof STATUSES)[number];

export type MirrorSubmission = {
  id: number;
  created_at: string;
  vin: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  features: string[];
  side: string;
  color: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  status: SubmissionStatus;
  matched_part_number: string;
  matched_part_price: string;
  supplier_name: string;
  supplier_link: string;
  estimated_shipping: string;
  quoted_price: string;
  notes: string;
  internal_debug: string;
  tracking_number: string;
};

export type SubmissionRow = Omit<MirrorSubmission, "created_at" | "features"> & {
  created_at: string | Date;
  features: string | string[];
};

export type SupplierOption = {
  part_type?: "OEM" | "Aftermarket";
  condition?: "New" | "Used" | "Remanufactured" | "Refurbished" | "Unknown";
  part_number: string;
  supplier_name: string;
  price: string;
  shipping_cost: number;
  product_link: string;
  estimated_shipping: string;
  tracking_offered: boolean;
  availability: string;
  option_labels: Array<"cheapest" | "fastest">;
};

export type PartTypeOption = Omit<SupplierOption, "option_labels"> & {
  part_type: "OEM" | "Aftermarket";
  condition?: "New" | "Used" | "Remanufactured" | "Refurbished" | "Unknown";
  note: string;
};

export type LocalPickupOption = {
  part_number: string;
  store_name: string;
  distance_from_location: string;
  price: string;
  product_link: string;
  same_day_pickup_confirmed: boolean;
  availability: string;
};

export type PlaceToCall = {
  chain_name: string;
  store_name: string;
  phone_number: string;
  distance_from_location: string;
  reason_to_call: string;
};

export type GeminiMirrorResearch = {
  confident_match: boolean;
  manual_review_reason: string;
  likely_part_number: string;
  recommended_supplier_name: string;
  recommended_price: string;
  recommended_product_link: string;
  recommended_estimated_shipping: string;
  supplier_options: SupplierOption[];
  oem_option: PartTypeOption | null;
  aftermarket_option: PartTypeOption | null;
  local_pickup_options: LocalPickupOption[];
  places_to_call: PlaceToCall[];
  research_summary: string;
};
