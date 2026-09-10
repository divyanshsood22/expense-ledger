import { useEffect, useState } from "react";
import { listExpenses, getHistoricalSummaries } from "@/lib/api";
import { formatPaise } from "@/lib/money";
import { currentMonthInIST, shiftMonth, formatMonthLabel, formatDayLabel } from "@/lib/dates";
import type { Expense, HistoricalSummary } from "@/types/expense";

export default function History() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summaries, setSummaries] = useState<HistoricalSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [month, setMonth] = useState(currentMonthInIST());

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    Promise.all([listExpenses(), getHistoricalSummaries()])
      .then(([expensesRes, summariesRes]) => {
        if (!cancelled) {
          setExpenses(expensesRes.expenses);
          setSummaries(summariesRes.summaries);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError("Couldn't load history. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [selectedYear, selectedMonthNum] = month.split("-").map(Number);
  const matchingSummary = summaries.find(
    (s) => s.year === selectedYear && s.month === selectedMonthNum,
  );

  const monthExpenses = expenses.filter((e) => e.expense_date.startsWith(month));
  const monthTotalPaise = matchingSummary
    ? matchingSummary.total_paise
    : monthExpenses.reduce((sum, e) => sum + e.amount_paise, 0);

  const days = Array.from(new Set(monthExpenses.map((e) => e.expense_date))).sort((a, b) =>
    b.localeCompare(a),
  );

  const isCurrentMonth = month === currentMonthInIST();

  return (
    <div className="flex flex-col gap-8">
      <section className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
          className="px-2 py-1 text-lg text-muted-foreground hover:text-foreground"
          aria-label="Previous month"
        >
          ‹
        </button>
        <div className="text-center">
          <p className="text-sm text-muted-foreground">{formatMonthLabel(month)}</p>
          <p className="mt-1 font-serif text-3xl tabular-nums text-foreground">
            {formatPaise(monthTotalPaise)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          disabled={isCurrentMonth}
          className="px-2 py-1 text-lg text-muted-foreground hover:text-foreground disabled:opacity-30"
          aria-label="Next month"
        >
          ›
        </button>
      </section>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : loadError ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : matchingSummary ? (
        <p className="text-sm text-muted-foreground">
          Summary only — no individual expenses recorded for this month.
        </p>
      ) : days.length === 0 ? (
        <p className="text-sm text-muted-foreground">No expenses recorded this month.</p>
      ) : (
        <div className="flex flex-col">
          {days.map((day) => {
            const dayExpenses = monthExpenses.filter((e) => e.expense_date === day);
            const dayTotalPaise = dayExpenses.reduce((sum, e) => sum + e.amount_paise, 0);

            return (
              <div key={day} className="border-t border-border py-4 first:border-t-0 first:pt-0">
                <div className="flex items-baseline justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {formatDayLabel(day)}
                  </p>
                  <p className="text-sm font-medium tabular-nums text-foreground">
                    {formatPaise(dayTotalPaise)}
                  </p>
                </div>
                <ul className="mt-3">
                  {dayExpenses.map((expense) => (
                    <li key={expense.id} className="flex items-center justify-between gap-4 py-2.5">
                      <span className="truncate text-foreground">
                        {expense.description || "—"}
                      </span>
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {formatPaise(expense.amount_paise)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}