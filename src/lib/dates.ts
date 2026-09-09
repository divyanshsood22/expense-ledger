const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

export function todayInIST(): string {
  const istTime = new Date(Date.now() + IST_OFFSET_MS);
  const year = istTime.getUTCFullYear();
  const month = String(istTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(istTime.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function currentMonthInIST(): string {
  return todayInIST().slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, m - 1, 1));
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function formatDayLabel(dateStr: string): string {
  const [year, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, m - 1, d));
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function currentYearInIST(): string {
  return todayInIST().slice(0, 4);
}

export function daysInMonth(month: string): number {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
}

