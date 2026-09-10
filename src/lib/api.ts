import type { Expense, HistoricalSummary } from "@/types/expense";

const FUNCTIONS_URL = "/functions/v1";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`${FUNCTIONS_URL}${path}`, {
    method: options.method ?? "GET",
    credentials: "include", // required so the session cookie is sent and stored
    headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // No JSON body — leave data as null (e.g. some error responses).
  }

  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Request failed with status ${res.status}`;
    throw new ApiError(message, res.status);
  }

  return data as T;
}

// --- Auth ---

export function verifyAccessCode(code: string): Promise<{ success: true }> {
  return request<{ success: true }>("/verify-access", { method: "POST", body: { code } });
}

export function checkSession(): Promise<{ authenticated: true }> {
  return request<{ authenticated: true }>("/check-session", { method: "POST", body: {} });
}

// --- Expenses ---

export function listExpenses(): Promise<{ expenses: Expense[] }> {
  return request<{ expenses: Expense[] }>("/expenses");
}

export function addExpense(input: {
  amount_paise: number;
  description?: string;
}): Promise<Expense> {
  return request<Expense>("/expenses", { method: "POST", body: input });
}

export function updateExpense(
  id: string,
  input: { amount_paise?: number; description?: string },
): Promise<Expense> {
  return request<Expense>(`/expenses?id=${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteExpense(id: string): Promise<{ deleted: true; id: string }> {
  return request<{ deleted: true; id: string }>(`/expenses?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function getHistoricalSummaries(): Promise<{ summaries: HistoricalSummary[] }> {
  return request<{ summaries: HistoricalSummary[] }>("/historical-summaries");
}

export function savePushSubscription(sub: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<{ success: true }> {
  return request<{ success: true }>("/save-push-subscription", {
    method: "POST",
    body: sub,
  });
}

export function removePushSubscription(
  endpoint: string,
): Promise<{ success: true }> {
  return request<{ success: true }>(
    `/save-push-subscription?endpoint=${encodeURIComponent(endpoint)}`,
    { method: "DELETE" },
  );
}