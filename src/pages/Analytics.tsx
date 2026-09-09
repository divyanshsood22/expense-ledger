import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listExpenses, getHistoricalSummaries } from "@/lib/api";
import { formatPaise } from "@/lib/money";
import { currentMonthInIST, currentYearInIST, daysInMonth } from "@/lib/dates";
import type { Expense, HistoricalSummary } from "@/types/expense";

interface AnalyticsProps {
  onBack: () => void;
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const BAR_COLOR = "#2563eb";

export default function Analytics({ onBack }: AnalyticsProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summaries, setSummaries] = useState<HistoricalSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
        if (!cancelled) setLoadError("Couldn't load analytics. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentMonth = currentMonthInIST();
  const currentYear = currentYearInIST();

  const dailyData = useMemo(() => {
    const totalDays = daysInMonth(currentMonth);
    const byDay = new Map<number, number>();
    for (const e of expenses) {
      if (!e.expense_date.startsWith(currentMonth)) continue;
      const dayNum = Number(e.expense_date.slice(8, 10));
      byDay.set(dayNum, (byDay.get(dayNum) ?? 0) + e.amount_paise);
    }
    return Array.from({ length: totalDays }, (_, i) => {
      const day = i + 1;
      return { day, amount_paise: byDay.get(day) ?? 0 };
    });
  }, [expenses, currentMonth]);

  const monthlyData = useMemo(() => {
    const yearNum = Number(currentYear);
    return MONTH_LABELS.map((label, i) => {
      const monthNum = i + 1;
      const summary = summaries.find((s) => s.year === yearNum && s.month === monthNum);
      if (summary) {
        return { month: label, amount_paise: summary.total_paise };
      }
      const monthStr = `${currentYear}-${String(monthNum).padStart(2, "0")}`;
      const total = expenses
        .filter((e) => e.expense_date.startsWith(monthStr))
        .reduce((sum, e) => sum + e.amount_paise, 0);
      return { month: label, amount_paise: total };
    });
  }, [expenses, summaries, currentYear]);

  const highestDay = useMemo(
    () => dailyData.reduce((max, d) => (d.amount_paise > max.amount_paise ? d : max), dailyData[0]),
    [dailyData],
  );

  const daysWithSpending = dailyData.filter((d) => d.amount_paise > 0);
  const averageDailyPaise =
    daysWithSpending.length > 0
      ? Math.round(
        daysWithSpending.reduce((sum, d) => sum + d.amount_paise, 0) / daysWithSpending.length,
      )
      : 0;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Dashboard
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : loadError ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Daily spending — this month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11 }}
                      interval={dailyData.length > 20 ? 4 : 2}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value: number) => formatPaise(value)}
                      width={60}
                    />
                    <Tooltip
                      formatter={(value) => formatPaise(Number(value))}
                      labelFormatter={(day) => `Day ${day}`}
                    />
                    <Bar dataKey="amount_paise" fill={BAR_COLOR} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex justify-between text-sm text-muted-foreground">
                <span>Avg/day: {formatPaise(averageDailyPaise)}</span>
                {highestDay.amount_paise > 0 && (
                  <span>Highest: Day {highestDay.day} ({formatPaise(highestDay.amount_paise)})</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Monthly spending — {currentYear}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value: number) => formatPaise(value)}
                      width={60}
                    />
                    <Tooltip formatter={(value) => formatPaise(Number(value))} />
                    <Bar dataKey="amount_paise" fill={BAR_COLOR} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}