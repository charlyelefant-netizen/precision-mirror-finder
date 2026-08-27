export const vehicleMakes = [
  "Toyota",
  "Honda",
  "Ford",
  "Chevrolet",
  "Nissan",
  "Hyundai",
  "Kia",
  "Subaru",
  "BMW",
  "Mercedes-Benz",
  "Audi",
  "Lexus",
  "Volkswagen",
  "Mazda",
  "Jeep",
  "Ram",
  "GMC",
  "Dodge",
  "Acura",
  "Infiniti",
  "Volvo",
  "Mitsubishi",
  "Chrysler",
  "Cadillac",
  "Buick",
  "Lincoln",
  "Porsche",
  "Tesla",
  "Mini",
  "Other"
];

const sharedTrims = [
  "Base",
  "S",
  "SE",
  "SEL",
  "Sport",
  "EX",
  "EX-L",
  "LX",
  "XLE",
  "Limited",
  "Touring",
  "Premium",
  "Platinum",
  "SR",
  "SR5",
  "TRD",
  "LT",
  "LTZ",
  "Premier",
  "SL",
  "SV",
  "Denali"
];

const trimsByMake: Record<string, string[]> = {
  Toyota: ["L", "LE", "SE", "XLE", "XSE", "Limited", "Platinum", "SR", "SR5", "TRD Sport", "TRD Off-Road", "TRD Pro"],
  Honda: ["LX", "Sport", "EX", "EX-L", "Touring", "Elite", "TrailSport", "Si", "Type R"],
  Ford: ["S", "SE", "SEL", "Titanium", "ST", "XL", "XLT", "Lariat", "King Ranch", "Platinum", "Limited"],
  Chevrolet: ["LS", "LT", "RS", "Premier", "LTZ", "High Country", "Work Truck", "Custom", "Z71"],
  Nissan: ["S", "SV", "SR", "SL", "Platinum", "PRO-X", "PRO-4X"],
  Hyundai: ["SE", "SEL", "XRT", "N Line", "Limited", "Calligraphy"],
  Kia: ["LX", "S", "EX", "SX", "SX Prestige", "X-Line", "GT-Line"],
  Subaru: ["Base", "Premium", "Sport", "Limited", "Touring", "Wilderness"],
  Lexus: ["Base", "Premium", "Luxury", "F Sport", "Ultra Luxury"],
  Jeep: ["Sport", "Latitude", "Limited", "Overland", "Trailhawk", "Rubicon", "Sahara", "Summit"]
};

export function getTrimOptions(make: string) {
  const options = trimsByMake[make] || sharedTrims;
  return Array.from(new Set([...options, "I'm not sure", "Other / not listed"]));
}
