import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "pmf_admin_session";
const TRIAL_PREVIEW_PASSWORD = "MirrorTrial2026!";

function isTrialPreview() {
  return process.env.VERCEL_ENV === "preview" && process.env.VERCEL_GIT_COMMIT_REF === "trial-workflow-improvements";
}

export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD?.trim() || (isTrialPreview() ? TRIAL_PREVIEW_PASSWORD : "");
}

export function hasAdminPasswordConfigured() {
  return getAdminPassword().length > 0;
}

function sessionSecret() {
  return process.env.AUTH_SECRET || getAdminPassword();
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function expectedSessionValue() {
  return digest(`${getAdminPassword()}:${sessionSecret()}`);
}

export function isValidPassword(password: string) {
  const adminPassword = getAdminPassword();
  if (!adminPassword) {
    return false;
  }

  const actual = Buffer.from(digest(password));
  const expected = Buffer.from(digest(adminPassword));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function setAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, expectedSessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function hasAdminSession() {
  if (!hasAdminPasswordConfigured()) {
    return false;
  }

  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;
  return value === expectedSessionValue();
}
