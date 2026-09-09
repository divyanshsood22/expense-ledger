const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

export function todayInIST(): string {
  const istTime = new Date(Date.now() + IST_OFFSET_MS);
  const year = istTime.getUTCFullYear();
  const month = String(istTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(istTime.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/** True if today (Asia/Kolkata) is the last calendar day of its month. */
export function isLastDayOfMonthIST(): boolean {
  const today = todayInIST(); // 'YYYY-MM-DD'
  const [year, month, day] = today.split("-").map(Number);
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day === lastDayOfMonth;
}