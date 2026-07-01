// Canadian combined sales-tax rates by province/territory (GST/HST/PST/QST), 2026.
// Used for the business-level default and per-location branch tax presets.
export const CA_TAX: { code: string; label: string; rate: number }[] = [
  { code: "AB", label: "Alberta", rate: 5 },
  { code: "BC", label: "British Columbia", rate: 12 },
  { code: "MB", label: "Manitoba", rate: 12 },
  { code: "NB", label: "New Brunswick", rate: 15 },
  { code: "NL", label: "Newfoundland and Labrador", rate: 15 },
  { code: "NS", label: "Nova Scotia", rate: 14 },
  { code: "NT", label: "Northwest Territories", rate: 5 },
  { code: "NU", label: "Nunavut", rate: 5 },
  { code: "ON", label: "Ontario", rate: 13 },
  { code: "PE", label: "Prince Edward Island", rate: 15 },
  { code: "QC", label: "Quebec", rate: 14.975 },
  { code: "SK", label: "Saskatchewan", rate: 11 },
  { code: "YT", label: "Yukon", rate: 5 },
];

export function caRateForProvince(code: string | null | undefined): number | null {
  if (!code) return null;
  return CA_TAX.find((p) => p.code === code)?.rate ?? null;
}
