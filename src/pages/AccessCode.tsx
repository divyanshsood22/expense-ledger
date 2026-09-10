import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifyAccessCode, ApiError } from "@/lib/api";

interface AccessCodeProps {
  onSuccess: () => void;
}

export default function AccessCode({ onSuccess }: AccessCodeProps) {
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!code || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await verifyAccessCode(code);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Incorrect access code. Try again.");
      } else if (err instanceof ApiError && err.status === 429) {
        setError("Too many attempts. Please wait a few minutes and try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-xs">
        <p className="text-center font-serif text-3xl text-foreground">Ledger</p>
        <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="access-code" className="text-xs text-muted-foreground">
              Access code
            </Label>
            <Input
              id="access-code"
              type="password"
              autoComplete="off"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={isSubmitting}
              className="h-12"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" disabled={!code || isSubmitting} className="h-12">
            {isSubmitting ? "Verifying…" : "Enter"}
          </Button>
        </form>
      </div>
    </div>
  );
}