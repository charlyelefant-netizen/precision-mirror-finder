import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NhtsaModel = {
  Model_Name?: string;
};

const commonFallbackModels: Record<string, string[]> = {
  Toyota: ["4Runner", "Avalon", "Camry", "Corolla", "Highlander", "Prius", "RAV4", "Sienna", "Tacoma", "Tundra", "Venza"],
  Honda: ["Accord", "Civic", "CR-V", "Fit", "HR-V", "Odyssey", "Passport", "Pilot", "Ridgeline"],
  Ford: ["Bronco", "Edge", "Escape", "Expedition", "Explorer", "F-150", "F-250", "Focus", "Fusion", "Mustang", "Ranger"],
  Chevrolet: ["Blazer", "Colorado", "Cruze", "Equinox", "Impala", "Malibu", "Silverado", "Suburban", "Tahoe", "Traverse"],
  Nissan: ["Altima", "Frontier", "Maxima", "Murano", "Pathfinder", "Rogue", "Sentra", "Titan", "Versa"],
  Hyundai: ["Accent", "Elantra", "Kona", "Palisade", "Santa Fe", "Sonata", "Tucson", "Venue"],
  Kia: ["Forte", "K5", "Optima", "Rio", "Sedona", "Sorento", "Soul", "Sportage", "Telluride"],
  Subaru: ["Ascent", "Crosstrek", "Forester", "Impreza", "Legacy", "Outback", "WRX"],
  Lexus: ["ES", "GS", "GX", "IS", "LS", "LX", "NX", "RC", "RX", "UX"]
};

function normalizeModels(models: string[]) {
  return Array.from(new Set(models.map((model) => model.trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export async function GET(request: NextRequest) {
  const year = request.nextUrl.searchParams.get("year")?.trim();
  const make = request.nextUrl.searchParams.get("make")?.trim();

  if (!year || !make || make === "Other") {
    return NextResponse.json({ models: [] });
  }

  const fallback = commonFallbackModels[make] || [];
  const endpoint = `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${encodeURIComponent(year)}?format=json`;

  try {
    const response = await fetch(endpoint, {
      next: { revalidate: 60 * 60 * 24 * 30 },
      signal: AbortSignal.timeout(8_000)
    });

    if (!response.ok) {
      return NextResponse.json({ models: fallback, source: "fallback" });
    }

    const payload = await response.json() as { Results?: NhtsaModel[] };
    const models = normalizeModels((payload.Results || []).map((item) => item.Model_Name || ""));

    return NextResponse.json({
      models: models.length ? models : fallback,
      source: models.length ? "nhtsa" : "fallback"
    });
  } catch {
    return NextResponse.json({ models: fallback, source: "fallback" });
  }
}
