"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearAdminSession, isValidPassword, setAdminSession } from "@/lib/auth";
import { createSubmission, deleteSubmission, enqueueResearchJob, updateSubmission } from "@/lib/db";
import { STATUSES, type SubmissionStatus } from "@/lib/types";

function requiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim();
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function optionalString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function submitMirrorRequest(formData: FormData) {
  const vin = optionalString(formData, "vin").toUpperCase();
  const year = optionalString(formData, "year");
  const make = optionalString(formData, "make");
  const model = optionalString(formData, "model");
  const trim = optionalString(formData, "trim");
  const hasManualDetails = Boolean(year && make && model && trim);

  if (!vin && !hasManualDetails) {
    throw new Error("Enter a VIN or complete the manual vehicle details.");
  }

  const id = await createSubmission({
    vin,
    year,
    make,
    model,
    trim,
    features: formData.getAll("features").map(String),
    side: requiredString(formData, "side"),
    color: requiredString(formData, "color"),
    customer_name: requiredString(formData, "customer_name"),
    customer_phone: requiredString(formData, "customer_phone"),
    customer_email: optionalString(formData, "customer_email")
  });

  await updateSubmission(id, {
    status: "New",
    matched_part_number: "",
    matched_part_price: "",
    supplier_name: "",
    supplier_link: "",
    estimated_shipping: "",
    quoted_price: "",
    notes: "AI research is in progress...",
    internal_debug: "",
    tracking_number: ""
  });

  await enqueueResearchJob(id);

  revalidatePath("/admin");
  redirect("/?submitted=1");
}

export async function loginAdmin(formData: FormData) {
  const password = requiredString(formData, "password");

  if (!isValidPassword(password)) {
    redirect("/admin?error=1");
  }

  await setAdminSession();
  redirect("/admin");
}

export async function logoutAdmin() {
  await clearAdminSession();
  redirect("/admin");
}

export async function updateAdminSubmission(formData: FormData) {
  const id = Number(requiredString(formData, "id"));
  const status = requiredString(formData, "status") as SubmissionStatus;

  if (!Number.isInteger(id) || id < 1 || !STATUSES.includes(status)) {
    throw new Error("Invalid submission update");
  }

  await updateSubmission(id, {
    status,
    matched_part_number: optionalString(formData, "matched_part_number"),
    matched_part_price: optionalString(formData, "matched_part_price"),
    supplier_name: optionalString(formData, "supplier_name"),
    supplier_link: optionalString(formData, "supplier_link"),
    estimated_shipping: optionalString(formData, "estimated_shipping"),
    quoted_price: optionalString(formData, "quoted_price"),
    notes: optionalString(formData, "notes"),
    internal_debug: optionalString(formData, "internal_debug"),
    tracking_number: optionalString(formData, "tracking_number")
  });

  revalidatePath("/admin");
}

export async function deleteAdminSubmission(formData: FormData) {
  const id = Number(requiredString(formData, "id"));

  if (!Number.isInteger(id) || id < 1) {
    throw new Error("Invalid submission delete");
  }

  await deleteSubmission(id);
  revalidatePath("/admin");
}
