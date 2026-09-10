import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import NotificationSettings from "@/components/NotificationSettings";
import { addExpense, listExpenses, updateExpense, deleteExpense, ApiError } from "@/lib/api";
import { formatPaise, parseRupeesToPaise } from "@/lib/money";
import { todayInIST, currentMonthInIST } from "@/lib/dates";
import type { Expense } from "@/types/expense";

export default function Dashboard() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchExpenses = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { expenses } = await listExpenses();
      setExpenses(expenses);
    } catch {
      setLoadError("Couldn't load expenses. Please refresh the page.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const today = todayInIST();
  const currentMonth = currentMonthInIST();

  const todayExpenses = expenses.filter((e) => e.expense_date === today);
  const todayTotalPaise = todayExpenses.reduce((sum, e) => sum + e.amount_paise, 0);
  const monthTotalPaise = expenses
    .filter((e) => e.expense_date.startsWith(currentMonth))
    .reduce((sum, e) => sum + e.amount_paise, 0);

  async function handleAddExpense(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const amountPaise = parseRupeesToPaise(amount);
    if (amountPaise === null) {
      setFormError("Enter a valid amount, e.g. 150 or 150.50.");
      return;
    }

    setIsSubmitting(true);
    try {
      await addExpense({
        amount_paise: amountPaise,
        description: description.trim() || undefined,
      });
      setAmount("");
      setDescription("");
      await fetchExpenses();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn't add expense. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function openEdit(expense: Expense) {
    setEditingExpense(expense);
    setEditAmount((expense.amount_paise / 100).toString());
    setEditDescription(expense.description ?? "");
    setEditError(null);
  }

  function closeEdit(open: boolean) {
    if (!open) {
      setEditingExpense(null);
      setEditError(null);
    }
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editingExpense) return;
    setEditError(null);

    const amountPaise = parseRupeesToPaise(editAmount);
    if (amountPaise === null) {
      setEditError("Enter a valid amount, e.g. 150 or 150.50.");
      return;
    }

    setIsEditSubmitting(true);
    try {
      await updateExpense(editingExpense.id, {
        amount_paise: amountPaise,
        description: editDescription.trim() || undefined,
      });
      setEditingExpense(null);
      await fetchExpenses();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Couldn't save changes. Try again.");
    } finally {
      setIsEditSubmitting(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingExpense) return;
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await deleteExpense(deletingExpense.id);
      setDeletingExpense(null);
      await fetchExpenses();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Couldn't delete expense. Try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <section className="flex items-start gap-10 sm:gap-16">
        <div>
          <p className="text-sm text-muted-foreground">Today</p>
          <p className="mt-1 font-serif text-4xl tabular-nums text-foreground sm:text-5xl">
            {formatPaise(todayTotalPaise)}
          </p>
        </div>
        <div className="border-l border-border pl-10 sm:pl-16">
          <p className="text-sm text-muted-foreground">This month</p>
          <p className="mt-1 font-serif text-4xl tabular-nums text-foreground sm:text-5xl">
            {formatPaise(monthTotalPaise)}
          </p>
        </div>
      </section>

      <section>
        <form
          onSubmit={handleAddExpense}
          className="flex flex-col gap-4 sm:flex-row sm:items-end"
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="amount" className="text-xs text-muted-foreground">
              Amount
            </Label>
            <Input
              id="amount"
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isSubmitting}
              autoFocus
              className="h-12 rounded-none border-0 border-b border-border bg-transparent px-0 font-serif text-2xl tabular-nums shadow-none focus-visible:border-accent focus-visible:ring-0"
            />
          </div>
          <div className="flex flex-[1.4] flex-col gap-1.5">
            <Label htmlFor="description" className="text-xs text-muted-foreground">
              Description <span className="text-muted-foreground/70">(optional)</span>
            </Label>
            <Input
              id="description"
              type="text"
              placeholder="Lunch"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              className="h-12 rounded-none border-0 border-b border-border bg-transparent px-0 shadow-none focus-visible:border-accent focus-visible:ring-0"
            />
          </div>
          <Button type="submit" disabled={!amount || isSubmitting} className="h-12 sm:w-28">
            {isSubmitting ? "Adding…" : "Add"}
          </Button>
        </form>
        {formError && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {formError}
          </p>
        )}
      </section>

      <section>
        <h2 className="text-sm text-muted-foreground">Today's expenses</h2>
        <div className="mt-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : loadError ? (
            <p className="text-sm text-destructive">{loadError}</p>
          ) : todayExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expenses yet today.</p>
          ) : (
            <ul className="divide-y divide-border">
              {todayExpenses.map((expense) => (
                <li key={expense.id} className="flex items-center justify-between gap-4 py-3">
                  <span className="truncate text-foreground">
                    {expense.description || "—"}
                  </span>
                  <div className="flex shrink-0 items-center gap-4">
                    <span className="tabular-nums text-foreground">
                      {formatPaise(expense.amount_paise)}
                    </span>
                    <span className="flex gap-3 text-xs text-muted-foreground">
                      <button type="button" onClick={() => openEdit(expense)} className="hover:text-foreground">
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingExpense(expense)}
                        className="hover:text-destructive"
                      >
                        Delete
                      </button>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <NotificationSettings />

      <Dialog open={editingExpense !== null} onOpenChange={closeEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-normal">Edit expense</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-amount" className="text-xs text-muted-foreground">
                Amount
              </Label>
              <Input
                id="edit-amount"
                type="text"
                inputMode="decimal"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                disabled={isEditSubmitting}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-description" className="text-xs text-muted-foreground">
                Description
              </Label>
              <Input
                id="edit-description"
                type="text"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                disabled={isEditSubmitting}
              />
            </div>
            {editError && (
              <p role="alert" className="text-sm text-destructive">
                {editError}
              </p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={!editAmount || isEditSubmitting}>
                {isEditSubmitting ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deletingExpense !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingExpense(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-xl font-normal">
              Delete this expense?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deletingExpense &&
                `${deletingExpense.description || "This expense"} — ${formatPaise(
                  deletingExpense.amount_paise,
                )}. This can't be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}