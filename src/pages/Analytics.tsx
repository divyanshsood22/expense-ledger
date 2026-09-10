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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listExpenses, getHistoricalSummaries } from "@/lib/api";
import { formatPaise } from "@/lib/money";
import { currentMonthInIST, currentYearInIST, daysInMonth } from "@/lib/dates";
import type { Expense, HistoricalSummary } from "@/types/expense";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const BAR_COLOR = "#5B6B4C";
const GRID_COLOR = "#E4DECD";

export default function Analytics() {
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

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (loadError) return <p className="text-sm text-destructive">{loadError}</p>;

  return (
    <div className="flex flex-col gap-8">
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-lg font-normal text-foreground">
            Daily spending — this month
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: "#726C60" }}
                  axisLine={{ stroke: GRID_COLOR }}
                  tickLine={false}
                  interval={dailyData.length > 20 ? 4 : 2}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#726C60" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value: number) => formatPaise(value)}
                  width={60}
                />
                <Tooltip
                  cursor={{ fill: "#F1ECE1" }}
                  contentStyle={{
                    background: "#FFFFFF",
                    border: "1px solid #E4DECD",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value) => formatPaise(Number(value))}
                  labelFormatter={(day) => `Day ${day}`}
                />
                <Bar dataKey="amount_paise" fill={BAR_COLOR} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex justify-between border-t border-border pt-3 text-sm">
            <span className="text-muted-foreground">
              Avg/day <span className="ml-1 tabular-nums text-foreground">{formatPaise(averageDailyPaise)}</span>
            </span>
            {highestDay.amount_paise > 0 && (
              <span className="text-muted-foreground">
                Highest <span className="ml-1 tabular-nums text-foreground">Day {highestDay.day} · {formatPaise(highestDay.amount_paise)}</span>
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-lg font-normal text-foreground">
            Monthly spending — {currentYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "#726C60" }}
                  axisLine={{ stroke: GRID_COLOR }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#726C60" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value: number) => formatPaise(value)}
                  width={60}
                />
                <Tooltip
                  cursor={{ fill: "#F1ECE1" }}
                  contentStyle={{
                    background: "#FFFFFF",
                    border: "1px solid #E4DECD",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value) => formatPaise(Number(value))}
                />
                <Bar dataKey="amount_paise" fill={BAR_COLOR} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}