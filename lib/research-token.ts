import { createHmac, timingSafeEqual } from "node:crypto";

function tokenSecret() {
  return process.env.AUTH_SECRET || process.env.ADMIN_PASSWORD || "precision-mirror-finder-dev";
}

export function createResearchToken(submissionId: number) {
  return createHmac("sha256", tokenSecret()).update(String(submissionId)).digest("hex");
}

export function isValidResearchToken(submissionId: number, token: string) {
  const expected = Buffer.from(createResearchToken(submissionId));
  const actual = Buffer.from(token || "");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
