export type DecodedVin = {
  year: string;
  make: string;
  model: string;
  trim: string;
  bodyClass: string;
  series: string;
  errorCode: string;
  errorText: string;
};

type NhtsaVinResponse = {
  Results?: Array<Record<string, string>>;
};

export function normalizeVin(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function looksLikeVin(value: string) {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(value);
}

function clean(value: unknown) {
  return String(value || "").trim();
}

function titleCaseMake(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function decodeVin(vin: string): Promise<DecodedVin | null> {
  const normalizedVin = normalizeVin(vin);

  if (!looksLikeVin(normalizedVin)) {
    return null;
  }

  const response = await fetch(
    `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(normalizedVin)}?format=json`,
    {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000)
    }
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as NhtsaVinResponse;
  const result = payload.Results?.[0];

  if (!result) {
    return null;
  }

  const decoded = {
    year: clean(result.ModelYear),
    make: titleCaseMake(clean(result.Make)),
    model: clean(result.Model),
    trim: clean(result.Trim),
    bodyClass: clean(result.BodyClass),
    series: clean(result.Series),
    errorCode: clean(result.ErrorCode),
    errorText: clean(result.ErrorText)
  };

  if (!decoded.year || !decoded.make || !decoded.model) {
    return null;
  }

  return decoded;
}

export function decodedTrimLabel(decoded: DecodedVin) {
  return [decoded.trim, decoded.series, decoded.bodyClass]
    .filter(Boolean)
    .filter((value, index, values) => values.findIndex((candidate) => candidate.toLowerCase() === value.toLowerCase()) === index)
    .join(" ");
}
