export function formatPaise(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
  }).format(rupees);
}


export function parseRupeesToPaise(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;

  const [rupeesPart, paisePart = ""] = trimmed.split(".");
  const paddedPaise = (paisePart + "00").slice(0, 2);
  const paise = Number(rupeesPart) * 100 + Number(paddedPaise);

  return paise > 0 ? paise : null;
}