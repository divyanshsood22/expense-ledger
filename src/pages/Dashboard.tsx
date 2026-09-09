import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "../components/ui/dialog";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogAction,
    AlertDialogCancel,
} from "../components/ui/alert-dialog";
import { addExpense, listExpenses, updateExpense, deleteExpense, ApiError } from "../lib/api";
import { formatPaise, parseRupeesToPaise } from "../lib/money";
import { todayInIST, currentMonthInIST } from "../lib/dates";
import type { Expense } from "../types/expense";
import NotificationSettings from "@/components/NotificationSettings";

interface DashboardProps {
    onViewHistory: () => void;
    onViewAnalytics: () => void;
}

export default function Dashboard({ onViewHistory, onViewAnalytics }: DashboardProps) {
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
        <div className="mx-auto flex max-w-md flex-col gap-4 p-4">
            <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={onViewAnalytics}>
                    Analytics →
                </Button>
                <Button variant="ghost" size="sm" onClick={onViewHistory}>
                    History →
                </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-normal text-muted-foreground">
                            Today
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-semibold">{formatPaise(todayTotalPaise)}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-normal text-muted-foreground">
                            This month
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-semibold">{formatPaise(monthTotalPaise)}</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Add expense</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleAddExpense} className="flex flex-col gap-3">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="amount">Amount (₹)</Label>
                            <Input
                                id="amount"
                                type="text"
                                inputMode="decimal"
                                placeholder="150"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                disabled={isSubmitting}
                                autoFocus
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="description">Description (optional)</Label>
                            <Input
                                id="description"
                                type="text"
                                placeholder="Lunch"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                disabled={isSubmitting}
                            />
                        </div>

                        {formError && (
                            <p role="alert" className="text-sm text-destructive">
                                {formError}
                            </p>
                        )}

                        <Button type="submit" disabled={!amount || isSubmitting}>
                            {isSubmitting ? "Adding..." : "Add expense"}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Today's expenses</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <p className="text-sm text-muted-foreground">Loading...</p>
                    ) : loadError ? (
                        <p className="text-sm text-destructive">{loadError}</p>
                    ) : todayExpenses.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No expenses yet today.</p>
                    ) : (
                        <ul className="flex flex-col gap-1">
                            {todayExpenses.map((expense) => (
                                <li
                                    key={expense.id}
                                    className="flex items-center justify-between gap-2 py-1 text-sm"
                                >
                                    <span className="truncate">{expense.description || "—"}</span>
                                    <div className="flex shrink-0 items-center gap-3">
                                        <span className="font-medium">{formatPaise(expense.amount_paise)}</span>
                                        <button
                                            type="button"
                                            onClick={() => openEdit(expense)}
                                            className="text-muted-foreground underline-offset-2 hover:underline"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDeletingExpense(expense)}
                                            className="text-destructive underline-offset-2 hover:underline"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>

            <NotificationSettings />

            <Dialog open={editingExpense !== null} onOpenChange={closeEdit}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit expense</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleEditSubmit} className="flex flex-col gap-3">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="edit-amount">Amount (₹)</Label>
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

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="edit-description">Description (optional)</Label>
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
                                {isEditSubmitting ? "Saving..." : "Save changes"}
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
                        <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
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
                        <AlertDialogAction onClick={handleDeleteConfirm} disabled={isDeleting}>
                            {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>

    );
}