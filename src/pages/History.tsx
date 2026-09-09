import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listExpenses, getHistoricalSummaries } from "@/lib/api";
import { formatPaise } from "@/lib/money";
import { currentMonthInIST, shiftMonth, formatMonthLabel, formatDayLabel } from "@/lib/dates";
import type { Expense, HistoricalSummary } from "@/types/expense";

interface HistoryProps {
  onBack: () => void;
}

export default function History({ onBack }: HistoryProps) {
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
    <div className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Dashboard
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
          >
            ←
          </Button>
          <CardTitle className="text-base">{formatMonthLabel(month)}</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            disabled={isCurrentMonth}
          >
            →
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Month total</p>
          <p className="text-2xl font-semibold">{formatPaise(monthTotalPaise)}</p>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : loadError ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : matchingSummary ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Summary only — no individual expenses recorded for this month.
            </p>
          </CardContent>
        </Card>
      ) : days.length === 0 ? (
        <p className="text-sm text-muted-foreground">No expenses recorded this month.</p>
      ) : (
        days.map((day) => {
          const dayExpenses = monthExpenses.filter((e) => e.expense_date === day);
          const dayTotalPaise = dayExpenses.reduce((sum, e) => sum + e.amount_paise, 0);

          return (
            <Card key={day}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-normal">{formatDayLabel(day)}</CardTitle>
                <span className="text-sm font-medium">{formatPaise(dayTotalPaise)}</span>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-1">
                  {dayExpenses.map((expense) => (
                    <li key={expense.id} className="flex items-center justify-between text-sm">
                      <span className="truncate text-muted-foreground">
                        {expense.description || "—"}
                      </span>
                      <span>{formatPaise(expense.amount_paise)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}