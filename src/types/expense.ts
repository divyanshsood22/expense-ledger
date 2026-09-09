export interface Expense {
  id: string;
  amount_paise: number;
  description: string | null;
  expense_date: string; // 'YYYY-MM-DD', server-assigned
  created_at: string;
  updated_at: string;
}

export interface HistoricalSummary {
  year: number;
  month: number; // 1-12
  total_paise: number;
}